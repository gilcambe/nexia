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

    // Converter slugs string para array e validar
    let slugsArray: string[];
    if (typeof slugs === 'string') {
      if (!slugs.trim()) {
        return res.status(400).json({ error: 'slugs cannot be empty string.' });
      }
      // Se for uma única slug sem vírgula, trata como array com um item
      if (slugs.includes(',')) {
        slugsArray = slugs.split(',').map(s => s.trim()).filter(s => s);
      } else {
        slugsArray = [slugs.trim()];
      }
    } else if (Array.isArray(slugs)) {
      slugsArray = slugs.map(s => typeof s === 'string' ? s.trim() : String(s)).filter(s => s);
    } else {
      return res.status(400).json({ error: 'slugs must be a string or array of strings.' });
    }

    if (slugsArray.length === 0) {
      return res.status(400).json({ error: 'slugs must contain at least one non-empty slug.' });
    }

    // Remover duplicatas e validar caracteres inválidos
    const uniqueSlugs = [...new Set(slugsArray)];
    if (uniqueSlugs.length !== slugsArray.length) {
      return res.status(400).json({ error: 'slugs contains duplicates.' });
    }

    // Validação de caracteres permitidos (apenas alfanumérico, hífens, underlines e espaços)
    const slugRegex = /^[\w\s-]+$/;
    for (const s of uniqueSlugs) {
      if (!slugRegex.test(s)) {
        return res.status(400).json({ error: `Invalid character in slug: ${s}` });
      }
    }

    const result = await triggerWorkflow({
      slugs: uniqueSlugs,
      publicar
    });

    console.log('Workflow lote-sites.yml disparado:', { slugCount: uniqueSlugs.length, jobId: result.jobId });

    if (!result.success) {
      return res.status(500).json(result);
    }

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error triggering workflow:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}