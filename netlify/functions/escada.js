// @ts-check
import { verifyBearerToken } from './_shared.js';
import { db } from './_firebase.js';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Validação de autenticação para proteger o acesso a dados sensíveis do Firestore
  try {
    const user = await verifyBearerToken(req);
    if (!user) {
      return res.status(401).json({ error: 'Não autorizado' });
    }
  } catch (err) {
    return res.status(401).json({ error: 'Não autorizado' });
  }

  try {
    // Busca dados da Escada do Firestore com tratamento de erros
    let data = {
      faseB: false,
      fila: 0,
      julesHoje: 0,
      semana: {
        cortex: 0,
        iasGratis: 0,
        claude: 0
      }
    };

    if (db) {
      const docRef = db.collection('config').doc('escada');
      const docSnap = await docRef.get();
      if (docSnap.exists) {
        const stored = docSnap.data();
        if (stored && typeof stored === 'object') {
          const semana = stored.semana && typeof stored.semana === 'object' ? stored.semana : {};
          data = {
            faseB: stored.faseB === true,
            fila: Number.isFinite(Number(stored.fila)) ? Math.max(0, Math.floor(Number(stored.fila))) : 0,
            julesHoje: Number.isFinite(Number(stored.julesHoje)) ? Math.max(0, Math.floor(Number(stored.julesHoje))) : 0,
            semana: {
              cortex: Number.isFinite(Number(semana.cortex)) ? Math.max(0, Math.min(100, Math.floor(Number(semana.cortex)))) : 0,
              iasGratis: Number.isFinite(Number(semana.iasGratis)) ? Math.max(0, Math.min(100, Math.floor(Number(semana.iasGratis)))) : 0,
              claude: Number.isFinite(Number(semana.claude)) ? Math.max(0, Math.min(100, Math.floor(Number(semana.claude)))) : 0
            }
          };
        }
      }
    }

    return res.status(200).json(data);
  } catch (error) {
    // Não expõe detalhes internos do erro
    return res.status(500).json({ error: 'Erro interno ao carregar dados da escada' });
  }
}
