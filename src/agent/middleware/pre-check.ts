import { Octokit } from "@octokit/rest";
import { Context } from "hono";

export interface PreCheckResult {
  allowed: boolean;
  reason?: string;
  issueFiles: string[];
  prFiles: string[];
  matchedFiles: string[];
}

/**
 * Extrai todos os caminhos de arquivos contidos entre crases (`) no texto.
 * Suporta caminhos relativos, absolutos e com extensão.
 */
export function extractFilePathsFromBackticks(text: string): string[] {
  const backtickRegex = /`([^`
]+)`/g;
  const matches = text.matchAll(backtickRegex);
  const paths: string[] = [];
  
  for (const match of matches) {
    const content = match[1].trim();
    // Filtra apenas o que parece ser caminho de arquivo (contém / ou . ou termina com extensão conhecida)
    if (
      content.includes('/') ||
      content.includes('\\') ||
      /\.(ts|tsx|js|jsx|json|md|yml|yaml|toml|css|html|py|go|rs|java|kt|swift|php|rb|sh|sql|proto|graphql|prisma|dockerfile|makefile|gradle|cmake|bazel|toml|ini|conf|config|env|lock)$/i.test(content)
    ) {
      paths.push(content);
    }
  }
  
  // Remove duplicatas mantendo ordem
  return [...new Set(paths)];
}

/***
 * Normaliza caminho para comparação consistente
 */
export function normalizePath(path: string): string {
  return path
    .replace(/\\/g, '/')
    .replace(/^\.\//, '')
    .replace(/^\//, '')
    .toLowerCase();
}

/***
 * Verifica se há interseção entre arquivos do Issue e arquivos do PR
 */
export function hasMatchingFiles(issueFiles: string[], prFiles: string[]): {
  matched: boolean;
  matchedFiles: string[];
} {
  const normalizedIssueFiles = new Set(issueFiles.map(normalizePath));
  const matchedFiles: string[] = [];
  
  for (const prFile of prFiles) {
    const normalized = normalizePath(prFile);
    if (normalizedIssueFiles.has(normalized)) {
      matchedFiles.push(prFile);
    }
  }
  
  return {
    matched: matchedFiles.length > 0,
    matchedFiles
  };
}

/***
 * Busca arquivos alterados no Pull Request via GitHub API
 */
export async function getPullRequestFiles(
  octokit: Octokit,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<string[]> {
  const files: string[] = [];
  let page = 1;
  const perPage = 100;
  
  while (true) {
    const { data } = await octokit.pulls.listFiles({
      owner,
      repo,
      pull_number: pullNumber,
      page,
      per_page: perPage
    });
    
    if (data.length === 0) break;
    
    files.push(...data.map(f => f.filename));
    
    if (data.length < perPage) break;
    page++;
  }
  
  return files;
}

/***
 * Middleware principal de pre-check para validação de consistência
 * Antes de enviar patch de status 'cortex-feito', verifica se o PR altera
 * pelo menos um dos arquivos mencionados no Issue original.
 */
export async function consistencyPreCheck(
  c: Context,
  octokit: Octokit,
  params: {
    issueBody: string;
    owner: string;
    repo: string;
    pullNumber: number;
  }
): Promise<PreCheckResult> {
  const { issueBody, owner, repo, pullNumber } = params;
  
  // 1. Extrai caminhos de arquivos do Issue original (entre crases)
  const issueFiles = extractFilePathsFromBackticks(issueBody);
  
  // 2. Busca arquivos alterados no PR
  const prFiles = await getPullRequestFiles(octokit, owner, repo, pullNumber);
  
  // 3. Compara as duas listas
  const { matched, matchedFiles } = hasMatchingFiles(issueFiles, prFiles);
  
  // 4. Se não há correspondência, bloqueia o cortex-feito
  if (!matched && issueFiles.length > 0) {
    return {
      allowed: false,
      reason: `Nenhum dos arquivos mencionados no Issue (${issueFiles.join(', ')}) foi alterado no PR. Arquivos do PR: ${prFiles.join(', ')}`,
      issueFiles,
      prFiles,
      matchedFiles: []
    };
  }
  
  // Se o Issue não menciona arquivos específicos, permite (compatibilidade)
  if (issueFiles.length === 0) {
    return {
      allowed: true,
      reason: 'Issue não menciona arquivos específicos entre crases; validação de consistência ignorada.',
      issueFiles: [],
      prFiles,
      matchedFiles: []
    };
  }
  
  return {
    allowed: true,
    reason: `Validação de consistência passou. Arquivos correspondentes: ${matchedFiles.join(', ')}`,
    issueFiles,
    prFiles,
    matchedFiles
  };
}

/***
 * Handler para integração com rota de finalização de PR
 * Retorna resposta padronizada para o fluxo do Cortex
 */
export async function handleConsistencyCheck(
  c: Context,
  octokit: Octokit,
  issueBody: string,
  owner: string,
  repo: string,
  pullNumber: number
): Promise<Response> {
  const result = await consistencyPreCheck(c, octokit, {
    issueBody,
    owner,
    repo,
    pullNumber
  });
  
  if (!result.allowed) {
    return c.json({
      success: false,
      error: 'CONSISTENCY_CHECK_FAILED',
      message: result.reason,
      details: {
        issueFiles: result.issueFiles,
        prFiles: result.prFiles
      }
    }, 400);
  }
  
  return c.json({
    success: true,
    message: result.reason,
    details: {
      issueFiles: result.issueFiles,
      prFiles: result.prFiles,
      matchedFiles: result.matchedFiles
    }
  });
}

export default {
  extractFilePathsFromBackticks,
  normalizePath,
  hasMatchingFiles,
  getPullRequestFiles,
  consistencyPreCheck,
  handleConsistencyCheck
};
