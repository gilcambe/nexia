/**
 * NEXIA OS — Pre-check Middleware for Pull Requests & Issues consistency.
 * Valida a consistência entre os arquivos citados na Issue original e os alterados no PR.
 */

export interface PreCheckOptions {
  issueBody: string;
  prFiles: string[];
  status?: string;
}

export function validateIssuePRConsistency(options: PreCheckOptions): { valid: boolean; error?: string; mentionedFiles?: string[]; prFiles?: string[] } {
  const issueBody = options.issueBody || '';
  const prFiles = options.prFiles || [];
  
  if (!issueBody) {
    return { valid: true };
  }

  // Extrair caminhos de arquivos contidos entre crases (`) no corpo original da Issue
  const matchFiles = issueBody.match(/`([^`]+)`/g) || [];
  const mentionedFiles = matchFiles
    .map(s => s.replace(/`/g, '').trim())
    .filter(f => f.includes('/') || f.includes('.') || f.includes('src/') || f.includes('lib/'));

  if (mentionedFiles.length === 0 || prFiles.length === 0) {
    return { valid: true, mentionedFiles, prFiles };
  }

  const hasIntersection = mentionedFiles.some(mf => 
    prFiles.some(pf => pf.includes(mf) || mf.includes(pf) || pf === mf)
  );

  if (!hasIntersection && options.status === 'cortex-feito') {
    return {
      valid: false,
      error: 'Inconsistência detectada: nenhum dos arquivos mencionados entre crases na Issue foi alterado no PR.',
      mentionedFiles,
      prFiles
    };
  }

  return { valid: true, mentionedFiles, prFiles };
}
