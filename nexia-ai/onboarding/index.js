'use strict';
// Onboarding de projeto (spec §20) em modo leitura externa (autonomia 0):
// lê o repositório, detecta stack/scripts/Firebase/Cloudflare/hosting, registra
// Repository, Environments, documentação (Artifacts) e um ProjectSnapshot no Vault.
// Não executa nada do repositório, não grava fora do Vault, não faz deploy.
const crypto = require('crypto');
const { detect } = require('./detect');
const { CODES } = require('../vault/errors');

const sha = s => crypto.createHash('sha256').update(s).digest('hex');
const OPEN_TASK = ['todo', 'in_progress', 'blocked'];
const OPEN_ERROR = ['open', 'investigating'];
const STORE_BY_PROVIDER = { render: 'render', netlify: 'netlify', vercel: 'vercel', cloudflare: 'cloudflare', firebase: 'firebase' };

async function listAll(repo, ctx, where) {
  return repo.list(ctx, { where, limit: 200 });
}

/**
 * @param {{ vault, ctx, projectId: string, source, repositoryId?: string }} o
 *   source: createGithubSource(...) ou createLocalSource(...)
 *   repositoryId: obrigatório quando a fonte não traz metadados (pasta local)
 */
async function onboardProject({ vault, ctx, projectId, source, repositoryId }) {
  const project = await vault.Project.get(ctx, projectId);
  const steps = [];

  // 3. Repositório GitHub
  let repository;
  const meta = await source.meta();
  if (meta) {
    const existing = (await listAll(vault.Repository, ctx, { project_id: projectId }))
      .find(r => r.provider === meta.provider && r.owner.toLowerCase() === meta.owner.toLowerCase() && r.repo.toLowerCase() === meta.repo.toLowerCase());
    if (existing) {
      repository = existing;
      steps.push({ step: 'repository', result: 'existing' });
    } else {
      try {
        ({ record: repository } = await vault.Repository.create(ctx, { project_id: projectId, ...meta }));
        steps.push({ step: 'repository', result: 'created' });
      } catch (e) {
        // O mesmo repositório já está ligado a OUTRO projeto deste tenant.
        if (e.code === CODES.UNIQUE) e.details = { ...e.details, hint: 'repository_linked_to_other_project' };
        throw e;
      }
    }
  } else {
    repository = await vault.Repository.get(ctx, repositoryId);
    if (repository.project_id !== projectId) {
      const err = new Error('Repositório de outro projeto.'); err.code = CODES.REFERENCE; throw err;
    }
    steps.push({ step: 'repository', result: 'existing' });
  }

  // 5–8, 10. Detecção pelos arquivos
  const files = await source.files();
  const d = await detect(files, p => source.read(p));
  steps.push({ step: 'detect', result: 'ok', files: d.fileCount, truncated: !!files.truncated });

  // 9. Ambientes detectados (só cria os que ainda não existem; nunca altera os existentes)
  const envs = await listAll(vault.Environment, ctx, { project_id: projectId });
  const envResult = { created: [], existing: [] };
  for (const e of d.environments) {
    const found = envs.find(x => x.name === e.name);
    if (found) { envResult.existing.push(found.id); continue; }
    const store = STORE_BY_PROVIDER[e.provider] || 'env';
    const { record } = await vault.Environment.create(ctx, {
      project_id: projectId, name: e.name, provider: e.provider,
      urls: e.urls.slice(0, 20), branch: e.branch || undefined,
      secret_refs: d.secretNames.slice(0, 100).map(name => ({ name, store, description: `Declarada em ${d.envFile}` })),
      notes: `Detectado pelo onboarding a partir de ${e.source}.`,
    });
    envs.push(record);
    envResult.created.push(record.id);
  }
  steps.push({ step: 'environments', result: 'ok', created: envResult.created.length, existing: envResult.existing.length });

  // 10. Documentação: um Artifact por arquivo (idempotente por projeto + caminho)
  let docCount = 0;
  for (const p of d.docs) {
    const r = await vault.Artifact.create(ctx, {
      project_id: projectId, kind: 'document', title: p.split('/').pop().slice(0, 200), uri: p,
      repository_id: repository.id, mime_type: 'text/markdown',
    }, { idempotencyKey: `onb:doc:${sha(`${projectId}|${repository.id}|${p}`).slice(0, 48)}` });
    if (!r.replayed) docCount++;
  }
  steps.push({ step: 'docs', result: 'ok', indexed: d.docs.length, new: docCount });

  // 11. Snapshot com o estado atual do Vault
  const [deployments, errors, tasks, decisions] = await Promise.all([
    listAll(vault.Deployment, ctx, { project_id: projectId }),
    listAll(vault.Error, ctx, { project_id: projectId }),
    listAll(vault.Task, ctx, { project_id: projectId }),
    listAll(vault.Decision, ctx, { project_id: projectId }),
  ]);
  const lastDeployment = deployments.slice().sort((a, b) => (b.started_at || '').localeCompare(a.started_at || ''))[0];
  const snapshotData = {
    project_id: projectId,
    generated_at: new Date().toISOString(),
    stack: d.stack.slice(0, 50),
    frameworks: d.frameworks.slice(0, 50),
    directory_structure: d.directoryStructure,
    commands: Object.keys(d.commands).length ? d.commands : undefined,
    repository_id: repository.id,
    default_branch: repository.default_branch,
    environment_ids: envs.map(e => e.id).slice(0, 20),
    deploy_target: d.deployTarget || undefined,
    firebase_project: d.firebaseProject || undefined,
    cloudflare_ref: d.cloudflareRef || undefined,
    architecture: d.architecture || undefined,
    patterns: d.patterns.slice(0, 50),
    last_deployment_id: lastDeployment ? lastDeployment.id : undefined,
    recent_error_ids: errors.filter(e => OPEN_ERROR.includes(e.status)).map(e => e.id).slice(0, 20),
    open_task_ids: tasks.filter(t => OPEN_TASK.includes(t.status)).map(t => t.id).slice(0, 50),
    key_decision_ids: decisions.filter(x => x.status === 'accepted').map(x => x.id).slice(0, 30),
  };
  const { record: snapshot } = await vault.ProjectSnapshot.create(ctx, snapshotData);
  steps.push({ step: 'snapshot', result: 'created' });

  // Repositório principal do projeto, se ainda não definido
  if (!project.primary_repository_id) {
    await vault.Project.update(ctx, projectId, { primary_repository_id: repository.id }, { expectedVersion: project.version });
    steps.push({ step: 'primary_repository', result: 'set' });
  }

  // 12. Smoke tests: não executados nesta fase (modo leitura; execução depende da Bridge/CI por projeto)
  steps.push({ step: 'smoke_tests', result: 'not_run', reason: 'read_only_onboarding' });

  return {
    execution_id: ctx.executionId,
    project_id: projectId,
    repository_id: repository.id,
    snapshot,
    environments: envResult,
    detection: {
      languages: d.languages, node_engine: d.nodeEngine, firebase: d.firebase, workflows: d.workflows,
      docs: d.docs, secret_names: d.secretNames, evidence: d.evidence,
    },
    steps,
  };
}

module.exports = { onboardProject };
