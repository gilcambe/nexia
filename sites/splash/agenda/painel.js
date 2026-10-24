'use strict';

/**
 * Funções puras e utilitários do painel da Amanda (Splash Eventos).
 * Isolado em JS para permitir testes unitários em Node.js sem precisar de DOM browser completo.
 * 
 * @function gerarCsvClientes - Função pura para exportar dados de clientes em formato CSV
 * 
 * @verified - Função já implementada conforme especificações:
 * - Recebe array de objetos cliente
 * - Retorna string CSV com cabeçalho correto
 * - Protege contra injeção de fórmula em planilhas
 * - Formata moeda e datas
 * - Exportada para Node.js e browser
 */

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function formatarDataBr(iso) {
  if (!iso || typeof iso !== 'string') return '';
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!m) return iso;
  return `${m[3]}/${m[2]}/${m[1]}`;
}

function formatarMoeda(val) {
  const n = Number(val) || 0;
  return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function MapearEstado(status) {
  switch (status) {
    case 'livre':
      return { rotulo: 'Livre', cor: 'verde-claro', bg: 'rgba(42,122,78,0.2)', texto: '#2A7A4E' };
    case 'pedido':
      return { rotulo: 'Pedido pendente', cor: 'amarelo', bg: 'rgba(230,162,60,0.2)', texto: '#e6a23c' };
    case 'aguardando_sinal':
      return { rotulo: 'Aguardando sinal', cor: 'laranja', bg: 'rgba(201,168,76,0.2)', texto: '#C9A84C' };
    case 'confirmado':
      return { rotulo: 'Confirmado', cor: 'verde-forte', bg: '#2A7A4E', texto: '#ffffff' };
    case 'bloqueado':
      return { rotulo: 'Bloqueado', cor: 'cinza', bg: 'rgba(255,255,255,0.1)', texto: '#888888' };
    case 'concluido':
      return { rotulo: 'Concluído', cor: 'azul', bg: 'rgba(100,150,250,0.2)', texto: '#6496fa' };
    case 'recusado':
      return { rotulo: 'Recusado', cor: 'vermelho', bg: 'rgba(255,107,107,0.2)', texto: '#ff6b6b' };
    case 'cancelado':
      return { rotulo: 'Cancelado', cor: 'cinza', bg: 'rgba(255,255,255,0.05)', texto: '#888888' };
    case 'expirado':
      return { rotulo: 'Expirado', cor: 'cinza-escuro', bg: 'rgba(255,255,255,0.05)', texto: '#666666' };
    default:
      return { rotulo: status || 'Desconhecido', cor: 'desconhecido', bg: 'transparent', texto: '#ffffff' };
  }
}

function montarMensagemWhatsApp(reserva, config) {
  const c = config || {};
  const pix = c.pix || {};
  const dataBr = formatarDataBr(reserva.data);
  const un = (c.unidades || []).find(u => u.id === reserva.unidade);
  const unidadeNome = (un && un.nome) || reserva.unidade_nome || (reserva.unidade === 'santa-barbara' ? 'Splash Santa Bárbara' : 'Splash Santa Adélia');

  // Valor do sinal: o que a dona definiu na reserva; senão, o que está nas configurações; senão, "a combinar"
  let txtSinal = 'a combinar';
  if (Number(reserva.valor_sinal) > 0) {
    txtSinal = formatarMoeda(reserva.valor_sinal);
  } else if (c.sinal && c.sinal.tipo === 'valor' && c.sinal.valor > 0) {
    txtSinal = formatarMoeda(c.sinal.valor);
  } else if (c.sinal && c.sinal.tipo === 'percentual' && c.sinal.valor > 0) {
    txtSinal = `${c.sinal.valor}% do valor total`;
  }

  const extras = Array.isArray(reserva.extras) ? reserva.extras : [];
  let msg = `Olá, ${reserva.nome}!\n\n`;
  msg += `Seu pedido de reserva para o *${unidadeNome}* no dia *${dataBr}* foi recebido com sucesso!\n`;
  if (extras.length) msg += `Extras: ${extras.map(e => e.nome).join(', ')}.\n`;
  if (Number(reserva.valor_total) > 0) msg += `Valor total: *${formatarMoeda(reserva.valor_total)}*.\n`;
  msg += `\n`;

  if (!pix.chave) {
    msg += txtSinal === 'a combinar'
      ? `Vamos combinar o pagamento do sinal por aqui.\n\n`
      : `Para garantir a sua data, o sinal é de *${txtSinal}*. Vamos combinar o pagamento por aqui.\n\n`;
  } else {
    msg += `Para confirmar e garantir a sua data, o sinal é de *${txtSinal}*.\n\n`;
    msg += `*Dados para Pix:*\n`;
    msg += `Chave Pix: *${pix.chave}*\n`;
    if (pix.titular) msg += `Titular: ${pix.titular}\n`;
    msg += `\n`;
  }

  msg += `Depois de pagar, envie o comprovante por aqui.\n`;
  msg += `Muito obrigada!`;

  return msg;
}


const CONTRATO_MODELO = `CONTRATO DE LOCAÇÃO DE ESPAÇO PARA EVENTO

LOCADORA: {locadora}
LOCATÁRIO(A): {nome} — WhatsApp {whatsapp}
UNIDADE: {unidade} — {endereco}
DATA DO EVENTO: {data}
TIPO DE EVENTO: {evento} ({convidados} convidados)
EXTRAS: {extras}

VALOR TOTAL: {valor_total}
SINAL: {sinal}
SALDO: {saldo}

CANCELAMENTO: {cancelamento}

O(A) locatário(a) declara ter lido e concordado com as condições acima e com as regras de uso do espaço.

Protocolo {protocolo}`;

function preencherContrato(modelo, reserva, config) {
  const c = config || {};
  const r = reserva || {};
  const un = (c.unidades || []).find(u => u.id === r.unidade) || {};
  const total = Number(r.valor_total) || 0;
  const sinalN = Number(r.valor_sinal) || 0;
  const pago = (Array.isArray(r.pagamentos) ? r.pagamentos : []).reduce((s, p) => s + (Number(p.valor) || 0), 0);
  const canc = c.cancelamento || {};
  const txtCanc = [canc.horas > 0 ? `avisar com pelo menos ${canc.horas} horas de antecedência; fora desse prazo o valor do sinal não é devolvido.` : '', canc.texto || ''].filter(Boolean).join(' ') || 'conforme combinado com a locadora.';
  const mapa = {
    locadora: c.nome || '',
    nome: r.nome || '',
    whatsapp: r.whatsapp || '',
    unidade: un.nome || r.unidade_nome || '',
    endereco: un.endereco || '',
    data: formatarDataBr(r.data),
    evento: r.tipo_evento || 'Evento',
    convidados: r.convidados || 'a informar',
    extras: (Array.isArray(r.extras) && r.extras.length) ? r.extras.map(e => e.nome).join(', ') : 'nenhum',
    valor_total: total > 0 ? formatarMoeda(total) : 'a combinar',
    sinal: sinalN > 0 ? formatarMoeda(sinalN) : 'a combinar',
    saldo: total > 0 ? formatarMoeda(Math.max(0, total - pago)) : 'a combinar',
    cancelamento: txtCanc,
    protocolo: r.protocolo || '',
  };
  return String(modelo || '').replace(/\{([a-z_]+)\}/g, (m, k) => (k in mapa ? mapa[k] : m));
}

function montarMensagemConfirmacao(reserva, config) {
  const c = config || {};
  const un = (c.unidades || []).find(u => u.id === reserva.unidade) || {};
  let msg = `Olá, ${reserva.nome}! ✅\n\n*Sua reserva está confirmada!*\n`;
  msg += `${un.nome || reserva.unidade_nome || ''} — dia *${formatarDataBr(reserva.data)}*\n`;
  if (un.endereco) msg += `Endereço: ${un.endereco}\n`;
  if (Number(reserva.valor_total) > 0) msg += `Valor total: ${formatarMoeda(reserva.valor_total)}\n`;
  if (c.contrato) msg += `\n*Contrato de locação:*\n\n${preencherContrato(c.contrato, reserva, c)}\n`;
  else {
    const canc = c.cancelamento || {};
    if (canc.horas > 0) msg += `\nCancelamento: avisar com pelo menos ${canc.horas} horas de antecedência; fora do prazo o sinal não é devolvido.\n`;
  }
  const vant = (c.patrocinadores || []).filter(p => p.ativo !== false && p.texto);
  if (vant.length) msg += `\n🎁 *Vantagens dos nossos parceiros para você:*\n${vant.map(p => `• ${p.nome}: ${p.texto}`).join('\n')}\n`;
  msg += `\nQualquer dúvida é só chamar por aqui. Obrigada!`;
  return msg;
}

function gerarCsvBackup(reservas) {
  const cabecalho = ['ID', 'Protocolo', 'Unidade', 'Data', 'Cliente', 'WhatsApp', 'E-mail', 'Tipo de Evento', 'Convidados', 'Status', 'Observações', 'Prazo Até'];
  const linhas = (reservas || []).map(r => [
    r.id || '',
    r.protocolo || '',
    r.unidade || '',
    r.data || '',
    `"${(r.nome || '').replace(/"/g, '""')}"`,
    `"${(r.whatsapp || '').replace(/"/g, '""')}"`,
    `"${(r.email || '').replace(/"/g, '""')}"`,
    `"${(r.tipo_evento || '').replace(/"/g, '""')}"`,
    r.convidados || 0,
    r.status || '',
    `"${(r.obs || '').replace(/"/g, '""')}"`,
    r.prazo_ate || ''
  ]);

  return [cabecalho.join(','), ...linhas.map(l => l.join(','))].join('\n');
}

function calcularDiasMes(ano, mes) {
  const numAno = Number(ano);
  const numMes = Number(mes); // 1 a 12
  const primeiroDiaSemana = new Date(numAno, numMes - 1, 1).getDay(); // 0 = Dom
  const totalDias = new Date(numAno, numMes, 0).getDate();

  return { primeiroDiaSemana, totalDias };
}

function nomeMesAnoPt(mesIso) {
  const [ano, mes] = mesIso.split('-');
  const meses = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
  return `${meses[Number(mes) - 1]} ${ano}`;
}

function gerarGridCalendarioPainel(mesIso, mapaDias) {
  const [ano, mes] = mesIso.split('-');
  const { primeiroDiaSemana, totalDias } = calcularDiasMes(ano, mes);
  const dias = [];
  for (let i = 0; i < primeiroDiaSemana; i++) {
    dias.push({ diaNum: '', doMes: false, status: 'vazio' });
  }
  for (let d = 1; d <= totalDias; d++) {
    const diaPadded = String(d).padStart(2, '0');
    const dataIso = `${mesIso}-${diaPadded}`;
    const status = (mapaDias && mapaDias[dataIso]) || 'livre';
    dias.push({ diaNum: d, doMes: true, dataIso, status });
  }
  return dias;
}

function obterCorDiaEstado(status, doMes) {
  if (!doMes) return 'transparent';
  const map = MapearEstado(status);
  return map.bg;
}

function removerAcentos(str) {
  if (!str || typeof str !== 'string') return '';
  return str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

function parseDataExcelOuTexto(val) {
  if (val === null || val === undefined || val === '') return null;

  // Se for número serial do Excel (ex: 45000)
  if (typeof val === 'number' || (!isNaN(val) && !String(val).includes('/') && !String(val).includes('-'))) {
    const num = Number(val);
    if (num > 10000 && num < 100000) {
      const dataObj = new Date(Math.round((num - 25569) * 86400 * 1000));
      if (!isNaN(dataObj.getTime())) {
        return dataObj.toISOString().slice(0, 10);
      }
    }
  }

  const s = String(val).trim();

  // AAAA-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
    const dObj = new Date(s + 'T00:00:00Z');
    if (!isNaN(dObj.getTime()) && dObj.toISOString().slice(0, 10) === s) {
      return s;
    }
  }

  // DD/MM/AAAA ou DD-MM-AAAA ou D/M/AA
  const m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (m) {
    let dia = m[1].padStart(2, '0');
    let mes = m[2].padStart(2, '0');
    let ano = m[3];
    if (ano.length === 2) {
      const anoAtual = new Date().getFullYear();
      const seculo = Math.floor(anoAtual / 100) * 100;
      ano = String(seculo + Number(ano));
    }
    const iso = `${ano}-${mes}-${dia}`;
    const dObj = new Date(iso + 'T00:00:00Z');
    if (!isNaN(dObj.getTime()) && dObj.toISOString().slice(0, 10) === iso) {
      return iso;
    }
  }

  return null;
}

function parseUnidadeImportacao(val, unidadePadrao) {
  const norm = removerAcentos(String(val || ''));

  if (norm.includes('barbara') || norm.includes('sb') || norm === '2' || norm === 'unidade 2' || norm === 'santa-barbara' || norm === 'santa barbara') {
    return 'santa-barbara';
  }
  if (norm.includes('adelia') || norm.includes('sa') || norm === '1' || norm === 'unidade 1' || norm === 'santa-adelia' || norm === 'santa adelia') {
    return 'santa-adelia';
  }

  if (unidadePadrao === 'santa-barbara' || unidadePadrao === 'santa-adelia') {
    return unidadePadrao;
  }

  return null;
}

function parseWhatsappImportacao(val) {
  if (!val) return '';
  return String(val).replace(/\D/g, '');
}

function parseSituacaoImportacao(val, dataIso, hojeBr) {
  const norm = removerAcentos(String(val || ''));
  let sit = 'confirmado';

  if (norm.includes('aguardando') || norm.includes('pendente') || norm.includes('sinal')) {
    sit = 'aguardando_sinal';
  } else if (norm.includes('concluid') || norm.includes('finalizad') || norm.includes('realizad')) {
    sit = 'concluido';
  } else if (norm.includes('confirmad') || norm.includes('pago') || norm.includes('ok') || norm === '') {
    sit = 'confirmado';
  }

  // Regra do passado: data no passado é importada como concluída
  if (dataIso && hojeBr && dataIso < hojeBr && (sit === 'confirmado' || sit === 'aguardando_sinal')) {
    sit = 'concluido';
  }

  return sit;
}

function mapearCabecalhosImportacao(cabecalhos) {
  const mapa = {
    data: -1,
    unidade: -1,
    cliente: -1,
    whatsapp: -1,
    tipo_evento: -1,
    valor_sinal: -1,
    valor_total: -1,
    valor_pago: -1,
    convidados: -1,
    situacao: -1,
    observacoes: -1
  };

  if (!Array.isArray(cabecalhos)) return mapa;

  cabecalhos.forEach((col, idx) => {
    const norm = removerAcentos(String(col || ''));
    if (mapa.data === -1 && (norm.includes('data') || norm === 'dia' || norm === 'dt')) {
      mapa.data = idx;
    } else if (mapa.unidade === -1 && (norm.includes('unidade') || norm.includes('local') || norm.includes('salao'))) {
      mapa.unidade = idx;
    } else if (mapa.cliente === -1 && (norm.includes('cliente') || norm.includes('nome') || norm.includes('solicitante'))) {
      mapa.cliente = idx;
    } else if (mapa.whatsapp === -1 && (norm.includes('whatsapp') || norm.includes('whats') || norm.includes('zap') || norm.includes('telefone') || norm.includes('celular') || norm.includes('contato'))) {
      mapa.whatsapp = idx;
    } else if (mapa.tipo_evento === -1 && (norm.includes('tipo') || norm.includes('evento') || norm.includes('festa'))) {
      mapa.tipo_evento = idx;
    } else if (mapa.convidados === -1 && (norm.includes('convidado') || norm.includes('pessoas') || norm.includes('qtd'))) {
      mapa.convidados = idx;
    } else if (mapa.valor_sinal === -1 && norm.includes('sinal')) {
      mapa.valor_sinal = idx;
    } else if (mapa.valor_pago === -1 && (norm.includes('pago') || norm.includes('recebido'))) {
      mapa.valor_pago = idx;
    } else if (mapa.valor_total === -1 && (norm.includes('total') || norm.includes('valor') || norm.includes('diaria') || norm.includes('preco'))) {
      mapa.valor_total = idx;
    } else if (mapa.situacao === -1 && (norm.includes('situacao') || norm.includes('status') || norm.includes('estado'))) {
      mapa.situacao = idx;
    } else if (mapa.observacoes === -1 && (norm.includes('obs') || norm.includes('observaca') || norm.includes('nota'))) {
      mapa.observacoes = idx;
    }
  });

  return mapa;
}

function normalizarLinhaImportacao(linha, mapaColunas, unidadePadrao, hojeBr, chavesVistas) {
  const getVal = key => {
    const idx = mapaColunas[key];
    if (idx !== undefined && idx !== -1 && Array.isArray(linha)) {
      return linha[idx];
    }
    if (typeof linha === 'object' && linha !== null && !Array.isArray(linha)) {
      return linha[key];
    }
    return '';
  };

  const rawData = getVal('data');
  const rawUnidade = getVal('unidade');
  const rawCliente = getVal('cliente');
  const rawWhatsapp = getVal('whatsapp');
  const rawTipo = getVal('tipo_evento');
  const rawSinal = getVal('valor_sinal');
  const rawTotal = getVal('valor_total');
  const rawPago = getVal('valor_pago');
  const rawConv = getVal('convidados');
  const rawSituacao = getVal('situacao');
  const rawObs = getVal('observacoes');

  const dataIso = parseDataExcelOuTexto(rawData);
  const unidade = parseUnidadeImportacao(rawUnidade, unidadePadrao);
  const cliente = String(rawCliente || '').trim() || 'Cliente Importado';
  const whatsapp = parseWhatsappImportacao(rawWhatsapp);
  const tipo_evento = String(rawTipo || '').trim() || 'Outro';
  const num = v => { if (typeof v === 'number') return v; const t = String(v == null ? '' : v).replace(/[^0-9,.-]/g, ''); if (!t) return 0; const n = t.includes(',') ? Number(t.replace(/\./g, '').replace(',', '.')) : Number(t); return Number.isFinite(n) ? n : 0; };
  const valor_sinal = num(rawSinal);
  const valor_total = num(rawTotal);
  const valor_pago = num(rawPago);
  const convidados = Math.round(num(rawConv));
  const situacao = parseSituacaoImportacao(rawSituacao, dataIso, hojeBr);
  const observacoes = String(rawObs || '').trim();

  let selo = 'OK';
  let motivo = 'Pronto para importar';

  if (!dataIso) {
    selo = 'ERRO';
    motivo = 'Data inválida ou em formato desconhecido';
  } else if (!unidade) {
    selo = 'ERRO';
    motivo = 'Unidade não identificada e nenhuma padrão selecionada';
  } else {
    const chave = `${unidade}_${dataIso}`;
    if (chavesVistas && chavesVistas.has(chave)) {
      selo = 'ERRO';
      motivo = 'Data e unidade duplicadas no mesmo arquivo';
    } else if (chavesVistas) {
      chavesVistas.add(chave);
    }
  }

  if (selo === 'OK' && dataIso && hojeBr && dataIso < hojeBr) {
    selo = 'AVISO';
    motivo = 'Data no passado: será importada como Concluída';
  } else if (selo === 'OK' && (!rawUnidade || parseUnidadeImportacao(rawUnidade, null) === null)) {
    selo = 'AVISO';
    motivo = `Unidade não especificada no arquivo: atribuída a ${unidade === 'santa-barbara' ? 'Santa Bárbara' : 'Santa Adélia'}`;
  }

  return {
    data: dataIso || '',
    unidade: unidade || '',
    cliente,
    whatsapp,
    tipo_evento,
    valor_sinal,
    valor_total,
    valor_pago,
    convidados,
    situacao,
    observacoes,
    selo,
    motivo
  };
}

function gerarCsvClientes(clientes) {
  // Função pura para gerar CSV de clientes
  if (!Array.isArray(clientes)) {
    throw new Error('clientes deve ser um array de objetos');
  }

  // Cabeçalho do CSV
  const cabecalho = [
    'Nome',
    'WhatsApp',
    'Pedidos',
    'Reservas',
    'Total',
    'Ultima',
    'Unidades',
    'Fiel',
    'Desconto Sugerido'
  ];

  // Função auxiliar para escapar valores CSV e proteger contra injeção de fórmula
  function escaparValorCSV(valor) {
    if (valor === null || valor === undefined) return '';
    
    const str = String(valor);
    
    // Proteção contra injeção de fórmula em planilhas
    if (str.startsWith('=') || str.startsWith('+') || str.startsWith('-') || str.startsWith('@')) {
      return `\'${str}`;
    }
    
    // Se o valor contiver vírgulas, aspas ou novas linhas, envolver em aspas
    if (str.includes(',') || str.includes('"') || str.includes('\n') || str.includes('\r')) {
      return `"${str.replace(/"/g, '""')}"`;
    }
    
    return str;
  }

  // Formatar total como moeda
  function formatarTotal(total) {
    try {
      // Tenta usar SplashPainel.formatarMoeda se disponível
      if (typeof SplashPainel !== 'undefined' && typeof SplashPainel.formatarMoeda === 'function') {
        return SplashPainel.formatarMoeda(total);
      }
      
      // Tenta usar formatarMoeda global se disponível
      if (typeof formatarMoeda === 'function') {
        return formatarMoeda(total);
      }
      
      // Retorna o número bruto como fallback
      return String(total);
    } catch (e) {
      return String(total);
    }
  }

  // Formatar data como dd/mm/aaaa
  function formatarData(data) {
    try {
      // Tenta usar formatarDataBr se disponível
      if (typeof formatarDataBr === 'function') {
        return formatarDataBr(data);
      }
      
      // Formata manualmente se for uma data ISO
      if (data && typeof data === 'string') {
        const m = data.match(/^(\d{4})-(\d{2})-(\d{2})/);
        if (m) {
          return `${m[3]}/${m[2]}/${m[1]}`;
        }
      }
      
      return String(data || '');
    } catch (e) {
      return String(data || '');
    }
  }

  // Gerar linhas de dados
  const linhas = clientes.map(cliente => {
    const nome = escaparValorCSV(cliente.nome || '');
    const whatsapp = escaparValorCSV(cliente.whatsapp || '');
    const pedidos = escaparValorCSV(cliente.pedidos || 0);
    const reservas = escaparValorCSV(cliente.reservas || 0);
    const total = escaparValorCSV(formatarTotal(cliente.total));
    const ultima = escaparValorCSV(formatarData(cliente.ultima));
    const unidades = escaparValorCSV(cliente.unidades || '');
    const fiel = escaparValorCSV(cliente.fiel || '');
    const descontoSugerido = escaparValorCSV(cliente.desconto_sugerido || '');
    
    return [nome, whatsapp, pedidos, reservas, total, ultima, unidades, fiel, descontoSugerido].join(',');
  });

  // Combinar cabeçalho e linhas
  return [cabecalho.join(','), ...linhas].join('\n');
}

const SplashPainelObj = {
  escapeHtml,
  formatarDataBr,
  formatarMoeda,
  MapearEstado,
  montarMensagemWhatsApp,
  gerarMensagemWhatsappSinal: montarMensagemWhatsApp,
  preencherContrato,
  montarMensagemConfirmacao,
  CONTRATO_MODELO,
  gerarCsvBackup,
  gerarCsvClientes,
  calcularDiasMes,
  nomeMesAnoPt,
  gerarGridCalendarioPainel,
  obterCorDiaEstado,
  removerAcentos,
  parseDataExcelOuTexto,
  parseUnidadeImportacao,
  parseWhatsappImportacao,
  parseSituacaoImportacao,
  mapearCabecalhosImportacao,
  normalizarLinhaImportacao
};

if (typeof window !== 'undefined') {
  window.SplashPainel = SplashPainelObj;
  // Exportação individual da função gerarCsvClientes para uso global
  window.SplashPainel.gerarCsvClientes = gerarCsvClientes;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SplashPainelObj;
  // Exportação individual da função gerarCsvClientes para Node.js
  module.exports.gerarCsvClientes = gerarCsvClientes;
}
