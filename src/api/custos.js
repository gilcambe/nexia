import { getCustos } from '../../lib/cortex-custo';

export default async function handler(req, res) {
  try {
    const custos = await getCustos();
    res.status(200).json(custos);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch cost data' });
  }
}
