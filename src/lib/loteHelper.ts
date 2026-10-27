// Helper para localizar e ler o arquivo de lote mais recente.
// O nome do arquivo segue o padrão lote/<data>.json, onde <data> é
// uma string comparável alfabeticamente (ex: 2026-10-27).

import { readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export interface LoteArquivo {
  nome: string;
  caminho: string;
  data: string;
}

/**
 * Lista arquivos JSON dentro do diretório de lotes, ordenados do mais
 * recente para o mais antigo com base no nome do arquivo.
 */
export function listarLotes(dir = 'lote'): LoteArquivo[] {
  try {
    const arquivos = readdirSync(dir);
    return arquivos
      .filter((arquivo) => arquivo.endsWith('.json'))
      .map((arquivo) => {
        const data = arquivo.replace('.json', '');
        return {
          nome: arquivo,
          caminho: join(dir, arquivo),
          data,
        };
      })
      .sort((a, b) => (a.data > b.data ? -1 : a.data < b.data ? 1 : 0));
  } catch {
    return [];
  }
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
 */
export function lerLoteMaisRecente(dir = 'lote'): any[] | null {
  const arquivo = selecionarMaisRecente(dir);
  if (!arquivo) return null;
  try {
    const conteudo = readFileSync(arquivo.caminho, 'utf-8');
    const dados = JSON.parse(conteudo);
    return Array.isArray(dados) ? dados : null;
  } catch {
    return null;
  }
}
