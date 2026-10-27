// GET /api/lote/latest
// Localiza o arquivo mais recente em lote/<data>.json, lê e devolve JSON
// com o array de clientes. Responde 200 quando encontrado, 404 caso não
// haja lotes e 500 em caso de erro interno.

import type { NextApiRequest, NextApiResponse } from 'next';
import { lerLoteMaisRecente } from '@/lib/loteHelper';

export default function handler(
  _req: NextApiRequest,
  res: NextApiResponse<any[] | { erro: string }>
) {
  try {
    const clientes = lerLoteMaisRecente();
    if (!clientes) {
      return res.status(404).json({ erro: 'Nenhum lote encontrado' });
    }
    return res.status(200).json(clientes);
  } catch {
    return res.status(500).json({ erro: 'Erro ao ler lote mais recente' });
  }
}
