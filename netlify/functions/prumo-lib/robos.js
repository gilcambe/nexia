// netlify/functions/prumo-lib/robos.js
// Exporta duas funções puras: validarRegra(o) e avaliarRegras(regras, viva, agoraIso)

const TZ_BRT = 'America/Sao_Paulo'; // Brasília timezone

function validarRegra(o) {
  if (!o || typeof o !== 'object') {
    return { ok: false, erro: 'Objeto inválido' };
  }
  const { tipo } = o;
  const tipos = [
    'preco_abaixo',
    'preco_acima',
    'queda_dia',
    'dy_minimo',
    'rebalancear',
    'concentracao',
  ];
  if (!tipos.includes(tipo)) {
    return { ok: false, erro: `Tipo desconhecido: ${tipo}` };
  }

  // helpers
  const upperTicker = (t) => (typeof t === 'string' ? t.toUpperCase() : '');
  const tickerValido = (t) => /^[A-Z]{4}\d+$/.test(t);
  const numPositivo = (n) => typeof n === 'number' && n > 0;
  const pctValido = (p) => typeof p === 'number' && p > 0 && p <= 100;

  const item = {};

  // regras que precisam de ticker
  if (['preco_abaixo', 'preco_acima', 'queda_dia', 'dy_minimo'].includes(tipo)) {
    if (!o.ticker) {
      return { ok: false, erro: 'Campo ticker é obrigatório' };
    }
    const t = upperTicker(o.ticker);
    if (!tickerValido(t)) {
      return { ok: false, erro: 'Ticker inválido (4 letras + número)' };
    }
    item.ticker = t;
  }

  // validações específicas
  switch (tipo) {
    case 'preco_abaixo':
    case 'preco_acima':
      if (!numPositivo(o.valor)) {
        return { ok: false, erro: 'Valor deve ser número positivo' };
      }
      item.valor = o.valor;
      break;
    case 'queda_dia':
    case 'dy_minimo':
      if (!pctValido(o.pct)) {
        return { ok: false, erro: 'Pct deve ser entre 0% e 100%' };
      }
      item.pct = o.pct;
      break;
    case 'rebalancear':
      if (!pctValido(o.desvio_pct) || o.desvio_pct < 1 || o.desvio_pct > 50) {
        return { ok: false, erro: 'desvio_pct deve estar entre 1% e 50%' };
      }
      item.desvio_pct = o.desvio_pct;
      break;
    case 'concentracao':
      if (!pctValido(o.pct)) {
        return { ok: false, erro: 'pct deve ser número positivo entre 0% e 100%' };
      }
      item.pct = o.pct;
      break;
  }

  // copia id e ultimo_disparo se existirem
  if (o.id) item.id = o.id;
  if (o.ultimo_disparo) item.ultimo_disparo = o.ultimo_disparo;

  return { ok: true, item };
}

// Formata número em reais com vírgula e duas casas
function fmtReais(num) {
  return `R$ ${num.toFixed(2).replace('.', ',')}`;
}

// Formata porcentagem com 1 casa
function fmtPct(num) {
  return `${num.toFixed(1).replace('.', ',')}%`;
}

// Converte ISO string para data no fuso de Brasília (yyyy-mm-dd)
function dataBrasilia(iso) {
  const d = new Date(iso);
  const utc = d.getTime() + d.getTimezoneOffset() * 60000;
  const brt = new Date(utc +  -3 * 3600000); // Brasília UTC-3 (sem DST)
  return brt.toISOString().slice(0, 10);
}

// Checa se já disparou hoje (comparando data string)
function disparadoHoje(regra, hoje) {
  if (!regra.ultimo_disparo) return false;
  return regra.ultimo_disparo === hoje;
}

// Avalia todas as regras
function avaliarRegras(regras, viva, agoraIso) {
  const hoje = dataBrasilia(agoraIso);
  const disparos = [];
  const lacunas = [];

  // ajuda para buscar ticker nas cotacoes vivas
  const mapTicker = {};
  if (viva && Array.isArray(viva.itens)) {
    for (const it of viva.itens) {
      if (it.ticker) mapTicker[it.ticker] = it;
    }
  }

  for (const r of regras) {
    const { tipo } = r;

    // ignora se já disparou hoje
    if (disparadoHoje(r, hoje)) continue;

    // regra de preço abaixo/acima
    if (tipo === 'preco_abaixo' || tipo === 'preco_acima') {
      const ticker = r.ticker.toUpperCase();
      const ativo = mapTicker[ticker];
      if (!ativo || !ativo.vivo) {
        lacunas.push(`Sem cotação para ${ticker}`);
        continue;
      }
      const preco = ativo.vivo.preco;
      const cond = tipo === 'preco_abaixo' ? preco < r.valor : preco > r.valor;
      if (cond) {
        const texto = `${ticker} está ${tipo === 'preco_abaixo' ? 'abaixo' : 'acima'} de ${fmtReais(r.valor)} (atual ${fmtReais(preco)})`;
        disparos.push({ regra_id: r.id, tipo, ticker, texto });
      }
    }

    // regra de queda no dia
    else if (tipo === 'queda_dia') {
      const ticker = r.ticker.toUpperCase();
      const ativo = mapTicker[ticker];
      if (!ativo || !ativo.vivo) {
        lacunas.push(`Sem cotação para ${ticker}`);
        continue;
      }
      const varDia = Math.abs(ativo.vivo.variacao_dia_pct);
      if (varDia >= r.pct) {
        const texto = `${ticker} caiu ${fmtPct(varDia)} no dia (limite ${fmtPct(r.pct)})`;
        disparos.push({ regra_id: r.id, tipo, ticker, texto });
      }
    }

    // regra dy minimo
    else if (tipo === 'dy_minimo') {
      const ticker = r.ticker.toUpperCase();
      const ativo = mapTicker[ticker];
      if (!ativo || !ativo.vivo) {
        lacunas.push(`Sem cotação para ${ticker}`);
        continue;
      }
      if (!ativo.proventos || typeof ativo.proventos.por_cota_12m !== 'number') {
        lacunas.push(`Sem dados de dividendos para ${ticker}`);
        continue;
      }
      const dy = (ativo.proventos.por_cota_12m / ativo.vivo.preco) * 100;
      if (dy >= r.pct) {
        const texto = `DY de ${ticker} é ${fmtPct(dy)} (mínimo ${fmtPct(r.pct)})`;
        disparos.push({ regra_id: r.id, tipo, ticker, texto });
      }
    }

    // regra rebalancear
    else if (tipo === 'rebalancear') {
      if (!viva.assessor || !viva.assessor.alocacao_alvo) {
        lacunas.push('Meta de alocação não informada');
        continue;
      }
      const metas = viva.assessor.alocacao_alvo;
      const total = viva.total;
      for (const [classe, metaPct] of Object.entries(metas)) {
        const valorClasse = viva.por_tipo[classe] || 0;
        const atualPct = (valorClasse / total) * 100;
        const desvio = Math.abs(atualPct - metaPct);
        if (desvio > r.desvio_pct) {
          const texto = `${classe} está em ${fmtPct(atualPct)} (meta ${fmtPct(metaPct)}), desvio ${fmtPct(desvio)} > ${fmtPct(r.desvio_pct)}`;
          disparos.push({ regra_id: r.id, tipo, texto });
        }
      }
    }

    // regra concentracao
    else if (tipo === 'concentracao') {
      // encontrar classe com maior % acima do limite
      const total = viva.total;
      let maior = null;
      for (const [classe, valor] of Object.entries(viva.por_tipo)) {
        const pct = (valor / total) * 100;
        if (pct > r.pct && (!maior || pct > maior.pct)) {
          maior = { classe, pct };
        }
      }
      if (maior) {
        const texto = `${maior.classe} representa ${fmtPct(maior.pct)} (> ${fmtPct(r.pct)})`;
        disparos.push({ regra_id: r.id, tipo, texto });
      }
    }
  }

  return { disparos, lacunas };
}

module.exports = {
  validarRegra,
  avaliarRegras,
};
