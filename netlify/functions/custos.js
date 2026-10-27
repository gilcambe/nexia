// netlify/functions/custos.js
// Endpoint /api/custos - agregados de custo para o painel central.
// Formato Netlify (req, res). Usado pelo Worker do Cloudflare via lib/routes.js.
import {
  calcularCustoTotalMes,
  calcularCustoMedioPorPlano,
  top10ClientesQueMaisGastam,
  percentualCustoSobreReceita,
  tetoGlobalExcedido,
} from '../../lib/cortex-custo.js';

export default async function handler(req, res) {
  try {
    const body = req.body || {};
    const { lancamentos = [], receitaTotal = 0, config = {} } = body;

    const custoTotal = calcularCustoTotalMes(lancamentos);
    const custoMedioPorPlano = calcularCustoMedioPorPlano(lancamentos);
    const top10 = top10ClientesQueMaisGastam(lancamentos);
    const percentual = percentualCustoSobreReceita(custoTotal, receitaTotal);
    const alerta = tetoGlobalExcedido(custoTotal, config);

    return res.status(200).json({
      ok: true,
      custoTotal,
      custoMedioPorPlano,
      top10Clientes: top10,
      percentualCustoReceita: percentual,
      circuitoGlobalAtivo: config.circuitoGlobal === true,
      alertaTetoGlobal: alerta,
    });
  } catch (erro) {
    return res.status(500).json({ ok: false, erro: 'Falha ao calcular custos' });
  }
}
