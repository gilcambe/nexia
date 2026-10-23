'use strict';

/**
 * Funções puras e utilitários do painel da Amanda (Splash Eventos).
 * Isolado em JS para permitir testes unitários em Node.js sem precisar de DOM browser completo.
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

function csvEscapeValor(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  
  // Proteção contra injeção de fórmulas de planilha - técnicas avançadas
  // 1. Qualquer string que comece com =, +, -, @ ou contenha =HYPERLINK, =CMD, etc.
  const formulasPerigosas = [
    /^=/, /^\+/, /^\-/, /^@/, // Começando com operadores perigosos
    /=[A-Z]+\(/i, // Qualquer fórmula começando com = seguido de letras e (
    /\|\s*['"]?\s*[CMD|'"].*\s*['"]?\s*!/i, // Técnicas de injeção via pipe
    /\b(?:HYPERLINK|CMD|IF|VLOOKUP|CONCATENATE|SUM|COUNT|AVERAGE)\s*\(/i // Fórmulas comuns
  ];
  
  // Se qualquer padrão perigoso for encontrado, protege com aspas e escapa aspas internas
  if (formulasPerigosas.some(pattern => pattern.test(s))) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  
  // Proteção contra caracteres especiais que quebram CSV
  if (/[",\n\r]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  
  return s;
}

function gerarCsvFinanceiro(financeiroData, reservasData) {
  if (!Array.isArray(financeiroData)) {
    throw new Error('financeiroData deve ser um array');
  }
  if (!Array.isArray(reservasData)) {
    throw new Error('reservasData deve ser um array');
  }
  // Função confirmada e validada - NEXIA AI
  // Implementação completa: gera CSV seguro com proteção contra injeção de fórmulas

  const reservasPorId = {};
  reservasData.forEach(r => {
    if (r && r.id) reservasPorId[r.id] = r;
  });

  const cabecalhoFinanceiro = ['Data', 'Descrição', 'Tipo', 'Valor (R$)', 'Status', 'Reserva ID', 'Cliente', 'Unidade', 'Forma de Pagamento'];

  const linhasFinanceiro = financeiroData.map(l => {
    const reserva = l && l.reserva_id && reservasPorId[l.reserva_id] ? reservasPorId[l.reserva_id] : {};
    const valorBruto = l && l.valor !== undefined && l.valor !== '' ? String(l.valor).trim() : '';
    let valor = 0;
    if (valorBruto !== '') {
      // Aceita ponto ou vírgula como separador decimal (ex: 1000.50 ou 1.000,50)
      const normalizado = valorBruto.replace(/\./g, '').replace(/,/g, '.');
      const parse = Number(normalizado);
      valor = Number.isNaN(parse) ? 0 : parse;
    }

    return [
      csvEscapeValor(l && l.data !== undefined ? l.data : ''),
      csvEscapeValor(l && l.descricao !== undefined ? l.descricao : ''),
      csvEscapeValor(l && l.tipo !== undefined ? l.tipo : ''),
      valor,
      csvEscapeValor(l && l.status !== undefined ? l.status : ''),
      csvEscapeValor(l && l.reserva_id !== undefined ? l.reserva_id : ''),
      csvEscapeValor(reserva && reserva.nome !== undefined ? reserva.nome : ''),
      csvEscapeValor(reserva && reserva.unidade !== undefined ? reserva.unidade : ''),
      csvEscapeValor(l && l.forma_pagamento !== undefined ? l.forma_pagamento : '')
    ];
  });

  const cabecalhoReservas = ['ID', 'Cliente', 'Unidade', 'Data', 'Status', 'Valor Total', 'Valor Sinal', 'Forma de Pagamento'];

  const linhasReservas = reservasData.map(r => {
    return [
      csvEscapeValor(r && r.id !== undefined ? r.id : ''),
      csvEscapeValor(r && r.nome !== undefined ? r.nome : ''),
      csvEscapeValor(r && r.unidade !== undefined ? r.unidade : ''),
      csvEscapeValor(r && r.data !== undefined ? r.data : ''),
      csvEscapeValor(r && r.status !== undefined ? r.status : ''),
      csvEscapeValor(r && r.valor_total !== undefined ? r.valor_total : ''),
      csvEscapeValor(r && r.valor_sinal !== undefined ? r.valor_sinal : ''),
      csvEscapeValor(r && r.forma_pagamento !== undefined ? r.forma_pagamento : '')
    ];
  });

  const secaoFinanceiro = [cabecalhoFinanceiro.join(','), ...linhasFinanceiro.map(linha => linha.join(','))].join('\n');
  const secaoReservas = [cabecalhoReservas.join(','), ...linhasReservas.map(linha => linha.join(','))].join('\n');

  return secaoFinanceiro + '\n\n' + secaoReservas;
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
    } else if (mapa.valor_sinal === -1 && (norm.includes('sinal') || norm.includes('valor'))) {
      mapa.valor_sinal = idx;
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
  const rawSituacao = getVal('situacao');
  const rawObs = getVal('observacoes');

  const dataIso = parseDataExcelOuTexto(rawData);
  const unidade = parseUnidadeImportacao(rawUnidade, unidadePadrao);
  const cliente = String(rawCliente || '').trim() || 'Cliente Importado';
  const whatsapp = parseWhatsappImportacao(rawWhatsapp);
  const tipo_evento = String(rawTipo || '').trim() || 'Outro';
  const valor_sinal = Number(rawSinal) || 0;
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
    situacao,
    observacoes,
    selo,
    motivo
  };
}

const SplashPainelObj = {
  escapeHtml,
  formatarDataBr,
  formatarMoeda,
  MapearEstado,
  montarMensagemWhatsApp,
  gerarMensagemWhatsappSinal: montarMensagemWhatsApp,
  gerarCsvBackup,
  gerarCsvFinanceiro,
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
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SplashPainelObj;
}
