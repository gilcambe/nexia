// src/api/custos.js
// Endpoint /api/custos - agregados de custo para o painel central.
import {
  calcularCustoTotalMes,
  calcularCustoMedioPorPlano,
  calcularCustoMedioGeral,
  top10ClientesQueMaisGastam,
  percentualCustoSobreReceita,
  tetoGlobalExcedido,
} from '../../lib/cortex-custo.js';

function verificarAutorizacao(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  return token === (process.env.NEXIA_JOBS_TOKEN || '');
}

export default async function handler(req, res) {
  try {
    if (!verificarAutorizacao(req)) {
      return res.status(401).json({ ok: false, erro: 'Não autorizado' });
    }

    // Se body não existir ou for vazio, usar valores padrão
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
      custoMedioGeral: calcularCustoMedioGeral(lancamentos),
    });
  } catch (erro) {
    return res.status(500).json({ ok: false, erro: 'Falha ao calcular custos' });
  }
}
