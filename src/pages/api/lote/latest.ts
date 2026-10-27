// GET /api/lote/latest
// Localiza o arquivo mais recente em lote/<data>.json, lê e devolve JSON
// com o array de clientes. Responde 200 quando encontrado, 404 caso não
// haja lotes e 500 em caso de erro interno.
// Requer autenticação via Bearer token (Firebase ID token).

import type { NextApiRequest, NextApiResponse } from 'next';
import { lerLoteMaisRecente } from '@/lib/loteHelper';

function extrairToken(req: NextApiRequest): string | null {
  const auth = req.headers?.authorization || req.headers?.Authorization || '';
  if (!auth || typeof auth !== 'string') return null;
  const partes = auth.trim().split(/\s+/);
  if (partes.length !== 2 || partes[0].toLowerCase() !== 'bearer') return null;
  return partes[1];
}

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<any[] | { erro: string }>
) {
  // Validação de entrada: só aceita GET
  if (req.method !== 'GET') {
    return res.status(405).json({ erro: 'Método não permitido. Use GET.' });
  }

  // Autenticação: exige Bearer token
  const token = extrairToken(req);
  if (!token) {
    return res.status(401).json({ erro: 'Token de autenticação ausente.' });
  }

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
