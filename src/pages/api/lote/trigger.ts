import { triggerWorkflow } from '../../lib/workflowTrigger';

function getBearerToken(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) return null;
  return auth.slice(7).trim();
}

function isAdmin(role) {
  return ['admin', 'master'].includes(role);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const token = getBearerToken(req);
    if (!token) {
      return res.status(401).json({ error: 'Token de autenticação ausente.' });
    }

    // Verifica token Firebase e perfil do usuário
    const { admin } = require('../../lib/firebase');
    let decoded;
    try {
      decoded = await admin.auth().verifyIdToken(token);
    } catch (e) {
      return res.status(401).json({ error: 'Token inválido ou expirado.' });
    }

    const profileRef = admin.firestore().collection('users').doc(decoded.uid);
    const profileSnap = await profileRef.get();
    if (!profileSnap.exists) {
      return res.status(403).json({ error: 'Usuário não encontrado.' });
    }
    const profile = profileSnap.data();
    if (!isAdmin(profile.role)) {
      return res.status(403).json({ error: 'Apenas administradores podem disparar o lote de sites.' });
    }

    const { slugs, publicar } = req.body;
    
    if (!slugs || !publicar) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await triggerWorkflow({
      slugs,
      publicar
    });

    console.log('Disparando workflow lote-sites.yml:', { slugs, publicar, jobId: result.jobId, url: result.url });

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error triggering workflow:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}