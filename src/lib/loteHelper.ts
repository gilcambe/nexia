// Helper para localizar e ler o arquivo de lote mais recente.
// O nome do arquivo segue o padrão lote/<data>.json, onde <data> é
// uma string comparável alfabeticamente (ex: 2026-10-27).

import { readdirSync, readFileSync } from 'fs';
import { join, resolve, sep } from 'path';

export interface LoteArquivo {
  nome: string;
  caminho: string;
  data: string;
}

/** Diretório base permitido para leitura de lotes. */
const LOTE_BASE_DIR = resolve('lote');

/**
 * Valida que um caminho não escapa do diretório base de lotes
 * (prevenção de path traversal). Retorna o caminho resolvido se válido,
 * ou null se não for.
 */
function validarCaminhoLote(caminho: string): string | null {
  const resolvido = resolve(caminho);
  // Garante que o caminho resolvido está dentro de lote/
  const dentro = resolvido === LOTE_BASE_DIR ||
    resolvido.startsWith(LOTE_BASE_DIR + sep);
  return dentro ? resolvido : null;
}

/**
 * Lista arquivos JSON dentro do diretório de lotes, ordenados do mais
 * recente para o mais antigo com base no nome do arquivo.
 */
export function listarLotes(dir = 'lote'): LoteArquivo[] {
  const baseValido = validarCaminhoLote(dir);
  if (!baseValido) {
    throw new Error('Diretório de lotes inválido.');
  }
  let arquivos: string[];
  try {
    arquivos = readdirSync(baseValido);
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw new Error('Falha ao listar arquivos de lote.');
  }
  return arquivos
    .filter((arquivo) => arquivo.endsWith('.json'))
    .map((arquivo) => {
      const data = arquivo.replace('.json', '');
      const caminhoCompleto = join(baseValido, arquivo);
      const caminhoValidado = validarCaminhoLote(caminhoCompleto);
      if (!caminhoValidado) {
        throw new Error(`Arquivo fora do diretório permitido: ${arquivo}`);
      }
      return {
        nome: arquivo,
        caminho: caminhoValidado,
        data,
      };
    })
    .sort((a, b) => (a.data > b.data ? -1 : a.data < b.data ? 1 : 0));
}

/**
 * Seleciona o arquivo de lote mais recente (maior data no nome).
 * Retorna null se não houver arquivos.
 */
export function selecionarMaisRecente(dir = 'lote'): LoteArquivo | null {
  const lotes = listarLotes(dir);
  return lotes.length > 0 ? lotes[0] : null;
}

/**
 * Lê o conteúdo JSON do lote mais recente.
 * Retorna null se não encontrar ou falhar ao ler/parsear.
 * Erros de leitura/parse são tratados de forma específica.
 */
export function lerLoteMaisRecente(dir = 'lote'): any[] | null {
  const arquivo = selecionarMaisRecente(dir);
  if (!arquivo) return null;
  try {
    const conteudo = readFileSync(arquivo.caminho, 'utf-8');
    const dados = JSON.parse(conteudo);
    return Array.isArray(dados) ? dados : null;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      return null;
    }
    if (err instanceof SyntaxError) {
      return null;
    }
    throw new Error('Erro ao ler lote mais recente.');
  }
}
