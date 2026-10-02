'use strict';
// Pipeline modelo de GitHub Actions por projeto (spec §11 "Pipeline recomendado", §12).
// Gera .github/workflows/nexia-pipeline.yml para o repositório do CLIENTE:
//   CI (push/PR): install → lint → testes → build → npm audit → gitleaks
//   workflow_dispatch target=staging:    CI → deploy staging → smoke/health
//   workflow_dispatch target=production: CI → staging → smoke → produção (environment
//     "production" protegido por revisores no GitHub) → health check
// O NEXIA não roda deploy fora daqui: deploy.staging só dispara este workflow.
// Segredos ficam nos environments do GitHub (staging/production separados); para o
// Firebase, OIDC (Workload Identity Federation) em vez de chave de service account.
const { GatewayError, CODES } = require('../tool-gateway/errors');

const PIPELINE_PATH = '.github/workflows/nexia-pipeline.yml';
const PROVIDERS = ['firebase', 'cloudflare', 'render'];
const GITLEAKS = { version: '8.24.3', sha256: '9991e0b2903da4c8f6122b5c3186448b927a5da4deef1fe45271c3793f4ee29c' };
const SCRIPT_RE = /^[A-Za-z0-9:_-]{1,50}$/;
const DIR_RE = /^(?!\/)(?!.*\.\.)[A-Za-z0-9._/-]{1,100}$/;
const PATH_RE = /^\/[A-Za-z0-9._~/-]{0,100}$/;

const step = (name, o) => ({ name, ...o });
const vars = k => `\${{ vars.${k} }}`;
const secrets = k => `\${{ secrets.${k} }}`;

function deploySteps(provider, target, outputDir) {
  if (provider === 'firebase') {
    return [
      step('Autenticar no Google por OIDC (sem chave)', { uses: 'google-github-actions/auth@v2', with: { workload_identity_provider: vars('GCP_WORKLOAD_IDENTITY_PROVIDER'), service_account: vars('GCP_SERVICE_ACCOUNT') } }),
      step(`Deploy Firebase Hosting (${target})`, { run: `npx -y firebase-tools@13.35.1 deploy --only hosting --project "${vars('FIREBASE_PROJECT_ID')}" --non-interactive` }),
    ];
  }
  if (provider === 'cloudflare') {
    const branch = target === 'production' ? vars('CLOUDFLARE_PRODUCTION_BRANCH') : 'staging';
    return [step(`Deploy Cloudflare Pages (${target})`, {
      run: `npx -y wrangler@3 pages deploy "${outputDir}" --project-name "${vars('CLOUDFLARE_PAGES_PROJECT')}" --branch "${branch}"`,
      env: { CLOUDFLARE_API_TOKEN: secrets('CLOUDFLARE_API_TOKEN'), CLOUDFLARE_ACCOUNT_ID: vars('CLOUDFLARE_ACCOUNT_ID') },
    })];
  }
  if (provider === 'render') {
    return [step(`Deploy Render (${target})`, { run: 'curl -fsS -X POST "$RENDER_DEPLOY_HOOK" -o /dev/null', env: { RENDER_DEPLOY_HOOK: secrets('RENDER_DEPLOY_HOOK') } })];
  }
  throw new GatewayError(CODES.INVALID_INPUT, `Provedor "${provider}" ainda não é suportado pelo pipeline modelo (${PROVIDERS.join(', ')}).`);
}

function healthStep(name, url, healthPath) {
  return step(name, {
    run: [
      'for i in $(seq 1 30); do',
      '  code=$(curl -s -o /dev/null -w "%{http_code}" "$URL$HEALTH_PATH" || true)',
      '  if [ -n "$code" ] && [ "$code" -ge 200 ] && [ "$code" -lt 400 ]; then echo "ok $code"; exit 0; fi',
      '  sleep 10',
      'done',
      'echo "health check falhou em $URL$HEALTH_PATH"; exit 1',
    ].join('\n'),
    env: { URL: url, HEALTH_PATH: healthPath },
  });
}

/**
 * @param {{ defaultBranch: string, node?: string, scripts?: { lint?, test?, build? }, outputDir?: string, healthPath?: string,
 *           staging?: { provider, url? }, production?: { provider, url? } }} o
 * @returns {object} workflow (objeto pronto para toYaml)
 */
function buildPipeline(o) {
  const node = String(o.node || '20');
  if (!/^\d{2}$/.test(node)) throw new GatewayError(CODES.INVALID_INPUT, 'node deve ser a versão major (ex.: 20).');
  const scripts = { lint: 'lint', test: 'test', build: 'build', ...(o.scripts || {}) };
  for (const [k, v] of Object.entries(scripts)) if (v !== null && !SCRIPT_RE.test(String(v))) throw new GatewayError(CODES.INVALID_INPUT, `script ${k} inválido.`);
  const outputDir = o.outputDir || 'dist';
  const healthPath = o.healthPath || '/';
  if (!DIR_RE.test(outputDir) || !PATH_RE.test(healthPath)) throw new GatewayError(CODES.INVALID_INPUT, 'outputDir/healthPath inválidos.');
  if (!/^[A-Za-z0-9._/-]{1,200}$/.test(String(o.defaultBranch))) throw new GatewayError(CODES.INVALID_INPUT, 'branch padrão inválida.');

  const setup = [
    step('Checkout', { uses: 'actions/checkout@v4' }),
    step('Node', { uses: 'actions/setup-node@v4', with: { 'node-version': node, cache: 'npm' } }),
    step('Instalar dependências', { run: 'npm ci' }),
  ];
  const run = s => (s === 'test' ? 'npm test' : `npm run ${s}`);
  const ci = [
    ...setup,
    ...(scripts.lint ? [step('Lint', { run: run(scripts.lint) })] : []),
    ...(scripts.test ? [step('Testes', { run: run(scripts.test) })] : []),
    ...(scripts.build ? [step('Build', { run: run(scripts.build) })] : []),
    step('Dependências (vulnerabilidade alta ou crítica falha)', { run: 'npm audit --omit=dev --audit-level=high' }),
    step('Secret scan (gitleaks, checksum verificado)', { run: [
      `curl -sSL -o gl.tgz "https://github.com/gitleaks/gitleaks/releases/download/v${GITLEAKS.version}/gitleaks_${GITLEAKS.version}_linux_x64.tar.gz"`,
      `echo "${GITLEAKS.sha256}  gl.tgz" | sha256sum -c -`,
      'tar -xzf gl.tgz gitleaks && rm gl.tgz',
      './gitleaks dir . --redact --no-banner',
    ].join('\n') }),
  ];

  const jobs = { ci: { name: 'CI', 'runs-on': 'ubuntu-latest', steps: ci } };
  const deployJob = (target, cfg, needs) => {
    const url = cfg.url || vars(`${target.toUpperCase()}_URL`);
    return {
      name: target === 'production' ? 'Produção (aprovação no environment)' : 'Staging',
      needs,
      if: target === 'production' ? "github.event_name == 'workflow_dispatch' && inputs.target == 'production'"
        : "github.event_name == 'workflow_dispatch' && (inputs.target == 'staging' || inputs.target == 'production')",
      'runs-on': 'ubuntu-latest',
      environment: { name: target, url },
      concurrency: { group: `deploy-${target}`, 'cancel-in-progress': false },
      permissions: { contents: 'read', ...(cfg.provider === 'firebase' ? { 'id-token': 'write' } : {}) },
      steps: [...setup, ...(scripts.build ? [step('Build', { run: run(scripts.build) })] : []), ...deploySteps(cfg.provider, target, outputDir),
        healthStep(target === 'production' ? 'Health check' : 'Smoke / health check', url, healthPath)],
    };
  };
  if (o.staging) jobs['deploy-staging'] = deployJob('staging', o.staging, 'ci');
  if (o.production) {
    if (!o.staging) throw new GatewayError(CODES.INVALID_INPUT, 'Produção exige um ambiente de staging antes (spec §11).');
    jobs['deploy-production'] = deployJob('production', o.production, 'deploy-staging');
  }

  return {
    name: 'NEXIA Pipeline',
    on: {
      pull_request: null,
      push: { branches: [o.defaultBranch] },
      workflow_dispatch: { inputs: { target: { description: 'Ambiente de deploy', type: 'choice', options: ['none', 'staging', 'production'], default: 'none' } } },
    },
    permissions: { contents: 'read' },
    concurrency: { group: "nexia-pipeline-${{ github.ref }}-${{ inputs.target || 'ci' }}", 'cancel-in-progress': false },
    jobs,
  };
}

// ── YAML ─────────────────────────────────────────────────────────────────────
// Emissor mínimo para o formato acima (sem dependência): chaves simples, strings sempre
// entre aspas duplas (JSON), textos com quebra de linha em bloco literal "|-".
const KEY_RE = /^[A-Za-z_][A-Za-z0-9_-]*$/;
function scalar(v) {
  if (v === null) return '';
  if (typeof v === 'boolean' || typeof v === 'number') return String(v);
  return JSON.stringify(String(v));
}
function toYaml(v, indent = 0) {
  const pad = ' '.repeat(indent);
  if (Array.isArray(v)) {
    return v.map(item => {
      if (item && typeof item === 'object') {
        const inner = toYaml(item, indent + 2).replace(/^\s+/, '');
        return `${pad}- ${inner}`;
      }
      return `${pad}- ${scalar(item)}`;
    }).join('\n');
  }
  return Object.entries(v).map(([k, val]) => {
    if (!KEY_RE.test(k)) throw new Error(`chave YAML inválida: ${k}`);
    if (typeof val === 'string' && val.includes('\n')) return `${pad}${k}: |-\n${val.split('\n').map(l => `${pad}  ${l}`).join('\n')}`;
    if (val && typeof val === 'object') {
      if (Array.isArray(val) && val.every(x => typeof x !== 'object')) return `${pad}${k}: [${val.map(scalar).join(', ')}]`;
      return `${pad}${k}:\n${toYaml(val, indent + 2)}`;
    }
    return `${pad}${k}:${val === null ? '' : ` ${scalar(val)}`}`;
  }).join('\n');
}

function renderPipeline(o) {
  const wf = buildPipeline(o);
  const header = '# Gerado pelo NEXIA AI (pipeline modelo, Fase 9). Deploy só por workflow_dispatch;\n'
    + '# produção exige revisores no environment "production" (Settings → Environments).\n';
  return { path: PIPELINE_PATH, content: `${header}${toYaml(wf)}\n`, workflow: wf };
}

module.exports = { buildPipeline, renderPipeline, toYaml, PIPELINE_PATH, PROVIDERS };
