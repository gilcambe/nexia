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
  const unidadeNome = reserva.unidade === 'santa-barbara' ? 'Splash Santa Bárbara' : 'Splash Santa Adélia';

  let txtSinal = '';
  if (c.sinal && c.sinal.tipo === 'fixo' && c.sinal.valor > 0) {
    txtSinal = formatarMoeda(c.sinal.valor);
  } else if (c.sinal && c.sinal.tipo === 'percentual' && c.sinal.valor > 0) {
    txtSinal = `${c.sinal.valor}% do valor total`;
  } else {
    txtSinal = 'a combinar';
  }

  let msg = `Olá, ${reserva.nome}!\n\n`;
  msg += `Seu pedido de reserva para o *${unidadeNome}* no dia *${dataBr}* foi recebido com sucesso!\n\n`;

  if (!pix.chave) {
    msg += `⚠️ *Atenção*: A chave Pix para pagamento do sinal ainda não foi cadastrada no painel de configurações. Por favor, entre em contato com a equipe para combinar a transferência.\n\n`;
  } else {
    msg += `Para confirmar e garantir a sua data, solicito o pagamento do sinal no valor de *${txtSinal}*.\n\n`;
    msg += `*Dados para Pix:*\n`;
    msg += `Chave Pix: *${pix.chave}*\n`;
    if (pix.titular) msg += `Titular: ${pix.titular}\n`;
    msg += `\n`;
  }

  msg += `Após realizar o pagamento, por favor nos envie o comprovante por aqui.\n`;
  msg += `Muito obrigado(a)!`;

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

const SplashPainelObj = {
  escapeHtml,
  formatarDataBr,
  formatarMoeda,
  MapearEstado,
  montarMensagemWhatsApp,
  gerarCsvBackup,
  calcularDiasMes,
  nomeMesAnoPt,
  gerarGridCalendarioPainel,
  obterCorDiaEstado
};

if (typeof window !== 'undefined') {
  window.SplashPainel = SplashPainelObj;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = SplashPainelObj;
}
