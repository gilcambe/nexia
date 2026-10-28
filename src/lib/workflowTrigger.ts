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
const OWNER = 'gilcambe';
const REPO = 'nexia';
const WORKFLOW_FILE = '.github/workflows/lote-sites.yml';
const JOB_NAME = 'lote-sites';

if (!GITHUB_TOKEN) {
  throw new Error('NEXIA_GITHUB_TOKEN not configured');
}

const octokit = new Octokit({ auth: GITHUB_TOKEN });

export async function triggerWorkflow({ slugs, publicar }: TriggerWorkflowParams): Promise<TriggerWorkflowResult> {
  try {
    // Validar input
    if (!Array.isArray(slugs) || slugs.length === 0) {
      throw new Error('slugs must be a non-empty array');
    }

    if (typeof publicar !== 'string' || (publicar !== 'true' && publicar !== 'false')) {
      throw new Error('publicar must be a string "true" or "false"');
    }

    // Validar tamanho máximo de slugs
    const MAX_SLUGS = 50;
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

    // Criar ref para o job
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const ref = `refs/tags/trigger-lote-sites-${timestamp}`;

    // Criar tag
    await octokit.rest.git.createRef({
      owner: OWNER,
      repo: REPO,
      ref,
      object: 'HEAD',
      type: 'commit',
    });

    // Disparar workflow
    const runs = await octokit.rest.actions.createWorkflowDispatch({
      owner: OWNER,
      repo: REPO,
      workflow_id: 'lote-sites.yml',
      ref,
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
    console.error('Error triggering workflow:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
