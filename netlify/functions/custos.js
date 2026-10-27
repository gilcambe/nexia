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

function verificarAutorizacao(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || !auth.startsWith('Bearer ')) return false;
  const token = auth.slice(7).trim();
  return token === (process.env.NEXIA_JOBS_TOKEN || '');
}

function validarEntrada(body) {
  const erros = [];
  const b = body || {};
  if (b.lancamentos !== undefined && !Array.isArray(b.lancamentos)) {
    erros.push('lancamentos deve ser um array');
  }
  if (b.receitaTotal !== undefined && (typeof b.receitaTotal !== 'number' || !Number.isFinite(b.receitaTotal))) {
    erros.push('receitaTotal deve ser um número');
  }
  if (b.config !== undefined && (typeof b.config !== 'object' || b.config === null || Array.isArray(b.config))) {
    erros.push('config deve ser um objeto');
  }
  return erros;
}

export default async function handler(req, res) {
  try {
    if (!verificarAutorizacao(req)) {
      return res.status(401).json({ ok: false, erro: 'Não autorizado' });
    }

    const body = req.body || {};
    const errosValidacao = validarEntrada(body);
    if (errosValidacao.length > 0) {
      return res.status(400).json({ ok: false, erro: 'Entrada inválida: ' + errosValidacao.join(', ') });
    }

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
