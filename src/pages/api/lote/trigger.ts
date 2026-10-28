import { triggerWorkflow } from '../../lib/workflowTrigger';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { slugs, publicar } = req.body;
    
    if (!slugs || !publicar) {
      return res.status(400).json({ error: 'Missing required parameters' });
    }

    const result = await triggerWorkflow({
      slugs,
      publicar
    });

    return res.status(200).json(result);
  } catch (error) {
    console.error('Error triggering workflow:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}