// functions/src/cortex.ts (Exemplo simplificado de como as APIs seriam protegidas)
// Este arquivo provavelmente seria um Cloudflare Worker ou uma função Firebase.

import { getAuth } from 'firebase-admin/auth';
import { Request, Response } from 'express'; // Assumindo Express para o exemplo, pode ser adaptado para Cloudflare Workers

// Helper para verificar se o usuário é master
async function isMasterUser(req: Request): Promise<boolean> {
  const idToken = req.headers.authorization?.split('Bearer ')[1];

  if (!idToken) {
    return false;
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(idToken);
    // ADR-F1-02: custom claim role=master, ou users/{uid}.role=master, ou MASTER_EMAIL
    // Aqui verificamos o custom claim
    return decodedToken.role === 'master';
  } catch (error) {
    console.error('Erro ao verificar token de autenticação:', error);
    return false;
  }
}

// Middleware de autenticação para rotas do Cortex
export const authenticateCortexAccess = async (req: Request, res: Response, next: () => void) => {
  if (await isMasterUser(req)) {
    next(); // Usuário master, permite acesso
  } else {
    res.status(403).send('Acesso negado. Apenas usuários master podem acessar o Cortex.');
  }
};

// Exemplo de rota Cortex protegida
export const cortexAppHandler = (req: Request, res: Response) => {
  res.status(200).json({ message: 'Bem-vindo ao Cortex (API, acesso Master)' });
};

// Exemplo de rota Cortex Agent protegida
export const cortexAgentHandler = (req: Request, res: Response) => {
  res.status(200).json({ message: 'API do Agente Cortex (acesso Master)' });
};

// Em um sistema real, você integraria este middleware nas rotas Express ou no Cloudflare Worker.
// Ex: router.get('/api/cortex', authenticateCortexAccess, cortexAppHandler);
// Ex: router.post('/api/cortex-agent', authenticateCortexAccess, cortexAgentHandler);
