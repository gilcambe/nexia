import { Octokit } from '@octokit/rest';

interface TriggerWorkflowParams {
  slugs: string[];
  publicar: string;
}

interface TriggerWorkflowResult {
  success: boolean;
  jobId?: string;
  url?: string;
  error?: string;
}

const GITHUB_TOKEN = process.env.NEXIA_GITHUB_TOKEN;
const GITHUB_REPO = process.env.GITHUB_REPO || 'gilcambe/nexia';
const OWNER = process.env.GITHUB_OWNER || 'gilcambe';
const REPO = process.env.GITHUB_REPO_NAME || 'nexia';
const WORKFLOW_FILE = process.env.LOTE_WORKFLOW_FILE || '.github/workflows/lote-sites.yml';
const GITHUB_REF = process.env.GITHUB_REF || 'develop';

const MAX_SLUGS = 50;
const MAX_CALLS_PER_WINDOW = 10;
const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

if (!GITHUB_TOKEN) {
  throw new Error('NEXIA_GITHUB_TOKEN not configured');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

// Rate limit simples em memória (reseta em cold start)
const callTimes: number[] = [];
function checkRateLimit(): { ok: boolean; retryAfter?: number } {
  const now = Date.now();
  const cutoff = now - WINDOW_MS;
  while (callTimes.length > 0 && callTimes[0] < cutoff) {
    callTimes.shift();
  }
  if (callTimes.length >= MAX_CALLS_PER_WINDOW) {
    const retryAfter = Math.ceil((callTimes[0] + WINDOW_MS - now) / 1000);
    return { ok: false, retryAfter: Math.max(1, retryAfter) };
  }
  callTimes.push(now);
  return { ok: true };
}

function sanitizeError(error: unknown): string {
  return 'Falha ao disparar o workflow de lote de sites.';
}

export async function triggerWorkflow({ slugs, publicar }: TriggerWorkflowParams): Promise<TriggerWorkflowResult> {
  // Rate limiting
  const rl = checkRateLimit();
  if (!rl.ok) {
    return {
      success: false,
      error: 'Muitas chamadas. Tente novamente em alguns minutos.',
    };
  }

  try {
    // Validar input
    if (!Array.isArray(slugs) || slugs.length === 0) {
      throw new Error('slugs must be a non-empty array');
    }

    // Validar que cada item de slugs é uma string
    for (const s of slugs) {
      if (typeof s !== 'string') {
        throw new Error('Cada item de slugs deve ser uma string.');
      }
    }

    if (typeof publicar !== 'string' || (publicar !== 'true' && publicar !== 'false')) {
      throw new Error('publicar must be a string "true" or "false"');
    }

    // Validar tamanho máximo de slugs
    if (slugs.length > MAX_SLUGS) {
      throw new Error(`slugs must not exceed ${MAX_SLUGS} items`);
    }

    // Verificar workflow existe
    try {
      await octokit.rest.actions.getWorkflowByFileName({
        owner: OWNER,
        repo: REPO,
        workflow_name: 'lote-sites.yml',
      });
    } catch (error) {
      throw new Error('Workflow lote-sites.yml not found');
    }

    // Disparar workflow diretamente na branch padrão (sem criar tag)
    const runs = await octokit.rest.actions.createWorkflowDispatch({
      owner: OWNER,
      repo: REPO,
      workflow_id: 'lote-sites.yml',
      ref: GITHUB_REF,
      inputs: {
        slugs: slugs.join(','),
        publicar,
      },
    });

    const run = runs.data;
    const jobId = run.id;
    const url = run.html_url;

    return {
      success: true,
      jobId,
      url,
    };
  } catch (error) {
    return {
      success: false,
      error: sanitizeError(error),
    };
  }
}
