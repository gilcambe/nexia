'use strict';

// NEXIA Locação — API de reservas por dia para locais de eventos (Splash e outros).
// Grátis: Cloudflare Workers + Firestore.
//
// Público (o site do cliente chama):
//   GET  /api/locacao?site=<slug>                                → nome, unidades, aviso, chave Pix, regras de sinal
//   GET  /api/locacao?site=<slug>&unidade=<id>&mes=AAAA-MM       → mapa de dias do mês ("livre" | "ocupado")
//   POST /api/locacao  { acao:'pedir', site, unidade, data, nome, whatsapp, email?, tipo_evento, convidados, obs, consentimento }
//
// Painel da dona (página /agenda do site dela). Tudo POST com { acao, site, token, ... }:
//   primeiro-acesso { codigo, senha_nova } · entrar { senha } · sair · trocar-senha { senha_atual, senha_nova }
//   listar { de, ate, unidade?, status? } · criar { unidade, data, status, nome, whatsapp, ... }
//   status { id, status } · editar { id, campos } · bloquear { unidade, data, motivo } · desbloquear { id }
//   config { config } · site-salvar { conteudo } · foto-enviar { dados, tipo }
//
// Firestore: locacao_contas/<slug> { senha_hash, senha_salt, versao, config }
//            locacao_contas/<slug>/reservas/<id>
//            locacao_contas/<slug>/dias/<unidade>_<AAAA-MM-DD>  trava por dia em cada unidade
//            locacao_contas/<slug>/sessoes/<hash do token>
//            locacao_contas/<slug>/site/conteudo
//            locacao_contas/<slug>/fotos/<id>

const COLLECTION = 'locacao_contas';
const STATUS_VALIDOS = ['pedido', 'aguardando_sinal', 'confirmado', 'concluido', 'recusado', 'cancelado', 'expirado', 'bloqueado'];
const ATIVOS = ['pedido', 'aguardando_sinal', 'confirmado', 'concluido', 'bloqueado'];
const TZ_OFFSET_MIN = -180; // Brasília (sem horário de verão)
const SESSAO_DIAS = 30;
const SUPORTE_HORAS = 8;
const PBKDF2_ITER = 100000;
// Mudanças de situação permitidas (pedido -> aguardando sinal -> confirmado -> concluído). Recusado, cancelado, expirado e concluído são finais.
const TRANSICOES = {
  pedido: ['aguardando_sinal', 'confirmado', 'recusado', 'cancelado'],
  aguardando_sinal: ['confirmado', 'recusado', 'cancelado'],
  confirmado: ['concluido', 'cancelado'],
};
const LIMITES = { pedir: { max: 6, windowMs: 60_000 }, comprovante: { max: 5, windowMs: 10 * 60_000 }, entrar: { max: 8, windowMs: 10 * 60_000 } };

const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max) : '');
const digits = v => String(v || '').replace(/\D/g, '');
const SLUG_RE = /^[a-z0-9-]{3,40}$/;
const DATA_RE = /^\d{4}-\d{2}-\d{2}$/;
const MES_RE = /^\d{4}-\d{2}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;

const dataValida = d => DATA_RE.test(d) && !Number.isNaN(Date.parse(d + 'T00:00:00Z')) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d;
const somaDias = (d, n) => new Date(Date.parse(d + 'T12:00:00Z') + n * 86400000).toISOString().slice(0, 10);

/** "Agora" no horário de Brasília: { data: 'AAAA-MM-DD', iso: '...' }. */
function agoraBr(now = Date.now()) {
  const t = new Date(now + TZ_OFFSET_MIN * 60000);
  return { data: t.toISOString().slice(0, 10), iso: new Date(now).toISOString() };
}

// ── WebCrypto: Hash e Criptografia ──────────────────────────────────────────

const subtle = () => globalThis.crypto.subtle;
const hex = buf => [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2, '0')).join('');
const aleatorio = n => hex(globalThis.crypto.getRandomValues(new Uint8Array(n)));

async function hashSenha(senha, salt) {
  const key = await subtle().importKey('raw', new TextEncoder().encode(senha), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle().deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: PBKDF2_ITER }, key, 256);
  return hex(bits);
}
async function sha256(s) { return hex(await subtle().digest('SHA-256', new TextEncoder().encode(s))); }
function iguais(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return false;
  let x = 0;
  for (let i = 0; i < a.length; i++) x |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return x === 0;
}
function senhaFraca(s) {
  if (typeof s !== 'string' || s.length < 6) return 'A senha precisa ter pelo menos 6 caracteres.';
  if (s.length > 100) return 'Senha longa demais.';
  if (/^(\d)\1+$/.test(s) || ['123456', '1234567', '12345678', '654321', 'senha123', 'abcdef'].includes(s.toLowerCase())) return 'Essa senha é fácil de adivinhar. Escolha outra.';
  return '';
}

// ── Configuração ───────────────────────────────────────────────────────────

function limparUnidades(lista) {
  const out = [];
  const ids = new Set();
  for (const u of Array.isArray(lista) ? lista.slice(0, 20) : []) {
    const nome = str(u && u.nome, 80);
    if (!nome) continue;
    let id = str(u.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '') || nome.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'unidade';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    const un = { id, nome };
    const endereco = str(u.endereco, 200);
    if (endereco) un.endereco = endereco;
    const diaria = Math.max(0, Math.round((Number(u.valor_diaria) || 0) * 100) / 100);
    if (diaria > 0) un.valor_diaria = diaria; // 0 = não informado (a tela omite)
    const preco = v => Math.max(0, Math.round((Number(v) || 0) * 100) / 100);
    if (preco(u.valor_semana) > 0) un.valor_semana = preco(u.valor_semana); // segunda a quinta (e sexta, se a dona marcar)
    if (preco(u.valor_fds) > 0) un.valor_fds = preco(u.valor_fds);           // fim de semana
    if (u.fds_sexta === true) un.fds_sexta = true;
    if (u.terceiro === true || u.terceiro === false) un.terceiro = u.terceiro; // unidade de outro dono: a dona só recebe comissão
    const com = u.comissao && typeof u.comissao === 'object' ? u.comissao : null;
    if (com && Number(com.valor) > 0) un.comissao = { tipo: com.tipo === 'valor' ? 'valor' : 'percentual', valor: com.tipo === 'valor' ? preco(com.valor) : Math.min(100, preco(com.valor)) };
    out.push(un);
  }
  return out.length ? out : [
    { id: 'santa-adelia', nome: 'Splash Santa Adélia' },
    { id: 'santa-barbara', nome: 'Splash Santa Bárbara' },
  ];
}

const slugTxt = t => String(t || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);

// Extras que o cliente pode escolher no pedido (ex.: decoração). valor 0 = "valor combinado com a dona" (nada inventado).
function limparExtras(lista) {
  const out = [];
  const ids = new Set();
  for (const x of Array.isArray(lista) ? lista.slice(0, 20) : []) {
    const nome = str(x && x.nome, 80);
    if (!nome) continue;
    let id = str(x.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '') || slugTxt(nome) || 'extra';
    while (ids.has(id)) id += '-2';
    ids.add(id);
    out.push({ id, nome, descricao: str(x.descricao, 200), valor: Math.max(0, Math.round((Number(x.valor) || 0) * 100) / 100), valor_promo: Math.max(0, Math.round((Number(x.valor_promo) || 0) * 100) / 100), ativo: x.ativo !== false });
  }
  return out;
}

// Dias com preço especial (promoção, feriado, alta temporada): unidade 'todas' ou o id de uma unidade; vale de 'de' até 'ate'.
function limparDatasEspeciais(lista) {
  const out = [];
  for (const x of Array.isArray(lista) ? lista.slice(0, 60) : []) {
    const de = str(x && x.de, 10), ate = str(x && x.ate, 10) || de;
    const valor = Math.max(0, Math.round((Number(x && x.valor) || 0) * 100) / 100);
    if (!dataValida(de) || !dataValida(ate) || ate < de || !(valor > 0)) continue;
    out.push({ id: str(x.id, 40).replace(/[^a-z0-9-]/gi, '') || aleatorio(4), unidade: str(x.unidade, 40) || 'todas', de, ate, valor, texto: str(x.texto, 80) });
  }
  return out;
}

// Diária de uma unidade num dia: preço especial (promoção) > fim de semana > semana > valor único antigo.
function valorDaDiaria(un, data, cfg) {
  if (!un) return { valor: 0, promocao: '' };
  const esp = (cfg.datas_especiais || []).find(e => (e.unidade === 'todas' || e.unidade === un.id) && data >= e.de && data <= e.ate);
  if (esp) return { valor: esp.valor, promocao: esp.texto || 'Promoção' };
  const dow = new Date(data + 'T12:00:00Z').getUTCDay(); // 0 dom ... 6 sáb
  const fds = dow === 0 || dow === 6 || (dow === 5 && un.fds_sexta === true);
  const valor = fds ? (un.valor_fds || un.valor_diaria || un.valor_semana || 0) : (un.valor_semana || un.valor_diaria || un.valor_fds || 0);
  return { valor, promocao: '' };
}
const valorExtra = e => (e.valor_promo > 0 && (!(e.valor > 0) || e.valor_promo < e.valor) ? e.valor_promo : e.valor);

// Link de imagem aceito nas promoções/avaliações: foto enviada pelo próprio painel (/api/locacao?...&foto=ID) ou https.
const linkImagem = t => { const v = str(t, 300); return /^(https:\/\/|\/api\/locacao\?)/.test(v) ? v : ''; };

// Avisos de promoção que a dona escreve (ex.: "Disponível dia 02/11 por R$ 799,99"), com print/imagem opcional. Só aparecem os ativos.
function limparPromocoes(lista) {
  const out = [];
  for (const x of Array.isArray(lista) ? lista.slice(0, 10) : []) {
    const texto = str(x && x.texto, 200);
    const imagem = linkImagem(x && x.imagem);
    if (!texto && !imagem) continue;
    out.push({ id: str(x.id, 40).replace(/[^a-z0-9-]/gi, '') || aleatorio(4), texto, imagem, ativa: x.ativa !== false });
  }
  return out;
}

// Avaliações de clientes escritas pela dona (nome, texto e estrelas). Prints de avaliações entram como fotos (categoria "avaliacoes").
function limparAvaliacoes(lista) {
  const out = [];
  for (const x of Array.isArray(lista) ? lista.slice(0, 20) : []) {
    const texto = str(x && x.texto, 400);
    if (!texto) continue;
    out.push({
      id: str(x.id, 40).replace(/[^a-z0-9-]/gi, '') || aleatorio(4),
      nome: str(x.nome, 80),
      texto,
      estrelas: Math.min(Math.max(Math.round(Number(x.estrelas) || 5), 1), 5),
      ativa: x.ativa !== false,
    });
  }
  return out;
}

function montarConfig(cadastro = {}, salvo = {}) {
  const c = { ...(cadastro.config || {}), ...(salvo || {}) };
  return {
    nome: str(c.nome, 80) || str(cadastro.nome, 80) || 'Locação de Eventos',
    whatsapp: digits(c.whatsapp).slice(0, 13),
    unidades: limparUnidades(c.unidades).map(u => {
      // se o painel nunca definiu "unidade de outro dono", vale o que está no cadastro da conta
      const cad = ((cadastro.config && cadastro.config.unidades) || []).find(x => x.id === u.id);
      return u.terceiro === undefined && cad && cad.terceiro === true ? { ...u, terceiro: true } : u;
    }),
    sinal: {
      tipo: c.sinal && c.sinal.tipo === 'valor' ? 'valor' : 'percentual',
      valor: Math.max(0, Number(c.sinal && c.sinal.valor) || 0), // 0 = a dona ainda não definiu (nada inventado)
    },
    pix: {
      chave: str(c.pix && c.pix.chave, 100),
      titular: str(c.pix && c.pix.titular, 100),
      mostrar: !(c.pix && c.pix.mostrar === false), // mostra a chave ao cliente depois que ele envia o pedido
    },
    extras: limparExtras(c.extras),
    datas_especiais: limparDatasEspeciais(c.datas_especiais),
    promocoes: limparPromocoes(c.promocoes),
    avaliacoes: limparAvaliacoes(c.avaliacoes),
    fidelidade: {
      minimo: Math.min(Math.max(Math.round(Number(c.fidelidade && c.fidelidade.minimo) || 3), 1), 50), // a partir de quantas reservas o cliente é "fiel"
      percentual: Math.min(Math.max(Number(c.fidelidade && c.fidelidade.percentual) || 10, 0), 100), // desconto sugerido (a dona decide se aplica)
    },
    // Multa/aviso de cancelamento: horas = prazo mínimo de aviso (0 = não definido) e texto livre da dona.
    cancelamento: {
      horas: Math.min(Math.max(Math.round(Number(c.cancelamento && c.cancelamento.horas) || 0), 0), 720),
      texto: str(c.cancelamento && c.cancelamento.texto, 600),
    },
    // Modelo de contrato com {campos} que o painel preenche na confirmação (não sai na rota pública).
    contrato: str(c.contrato, 8000),
    musica: {
      estilo: ['alegre', 'tropical', 'chill', 'desligada'].includes(c.musica && c.musica.estilo) ? c.musica.estilo : 'alegre',
      url: /^https:\/\/([^\s"'<>]+\.(mp3|m4a|ogg|wav)(\?[^\s"'<>]*)?|(www\.|m\.|music\.)?youtube\.com\/[^\s"'<>]+|youtu\.be\/[^\s"'<>]+)$/i.test(str(c.musica && c.musica.url, 300)) ? str(c.musica.url, 300) : '',
    },
    instagram: str(c.instagram, 100).replace(/^@/, ''),
    prazo_horas: Math.min(Math.max(Math.round(Number(c.prazo_horas) || 48), 1), 168),
    antecedencia_dias: Math.min(Math.max(Math.round(Number(c.antecedencia_dias) || 0), 0), 365),
    dias_a_frente: Math.min(Math.max(Math.round(Number(c.dias_a_frente) || 540), 1), 730),
    aviso: str(c.aviso, 300),
    mensagem_pedido: str(c.mensagem_pedido, 300) || 'Pedido de reserva recebido com sucesso! Aguarde o contato para confirmação.',
  };
}

// A chave Pix NÃO sai na rota pública (pode ser o CPF da dona): ela só aparece no painel e na mensagem que a dona manda pelo WhatsApp.
const configPublica = cfg => ({
  nome: cfg.nome,
  whatsapp: cfg.whatsapp,
  instagram: cfg.instagram,
  extras: cfg.extras.filter(e => e.ativo).map(({ id, nome, descricao, valor, valor_promo }) => ({ id, nome, descricao, valor, valor_promo })),
  datas_especiais: cfg.datas_especiais.map(({ unidade, de, ate, valor, texto }) => ({ unidade, de, ate, valor, texto })),
  promocoes: cfg.promocoes.filter(p => p.ativa).map(({ id, texto, imagem }) => ({ id, texto, imagem })),
  avaliacoes: cfg.avaliacoes.filter(a => a.ativa).map(({ id, nome, texto, estrelas }) => ({ id, nome, texto, estrelas })),
  pix_ativo: Boolean(cfg.pix.chave && cfg.pix.mostrar),
  pix: cfg.pix.chave && cfg.pix.mostrar ? { chave: cfg.pix.chave, titular: cfg.pix.titular } : null, // a dona escolhe mostrar (opção no painel)
  cancelamento: cfg.cancelamento,
  musica: cfg.musica,
  unidades: cfg.unidades.map(({ comissao, terceiro, ...pub }) => pub), // comissão e dono da unidade não saem no site
  sinal: cfg.sinal,
  prazo_horas: cfg.prazo_horas,
  antecedencia_dias: cfg.antecedencia_dias,
  dias_a_frente: cfg.dias_a_frente,
  aviso: cfg.aviso,
  mensagem_pedido: cfg.mensagem_pedido,
});

// ── Validação e Limite por IP ──────────────────────────────────────────────

const _hits = new Map();
function ipPermitido(tipo, ip, now = Date.now()) {
  if (!ip) return true;
  const lim = LIMITES[tipo];
  if (!lim) return true;
  const k = tipo + ':' + ip;
  const e = _hits.get(k);
  if (!e || now - e.start > lim.windowMs) {
    if (_hits.size > 5000) _hits.clear();
    _hits.set(k, { start: now, n: 1 });
    return true;
  }
  e.n += 1;
  return e.n <= lim.max;
}

function limparPessoa(body) {
  const nome = str(body.nome, 80);
  const whatsapp = digits(body.whatsapp).slice(0, 13);
  const email = str(body.email, 120);
  const tipo_evento = str(body.tipo_evento, 60);
  const convidados = Math.min(Math.max(Math.round(Number(body.convidados) || 0), 0), 10000);
  const obs = str(body.obs, 500);

  if (nome.length < 2) return { error: 'Informe seu nome completo.' };
  if (!whatsapp || whatsapp.length < 10 || whatsapp.length > 13) return { error: 'Informe o WhatsApp com DDD (ex: 11999998888).' };

  return {
    pessoa: { nome, whatsapp, email, tipo_evento, convidados, obs },
  };
}


// ── Financeiro: pagamentos, despesas, resumo por unidade e clientes ────────
const FORMAS_PAGAMENTO = ['pix', 'dinheiro', 'cartao', 'transferencia', 'outro'];
const FECHADAS = ['confirmado', 'concluido']; // reservas que contam como faturamento
const arred = n => Math.round((Number(n) || 0) * 100) / 100;
const somaPagamentos = r => arred((Array.isArray(r && r.pagamentos) ? r.pagamentos : []).reduce((t, p) => t + (Number(p.valor) || 0), 0));
const emPeriodo = (d, de, ate) => typeof d === 'string' && d >= de && d <= ate;

function resumoFinanceiro(reservasLista, despesasLista, unidades, de, ate) {
  const zero = () => ({ reservas: 0, faturamento: 0, recebido: 0, a_receber: 0, despesas: 0, lucro_previsto: 0, lucro_caixa: 0 });
  const por = {};
  for (const u of unidades) por[u.id] = { id: u.id, nome: u.nome, ...zero(), ...(u.terceiro ? { terceiro: true, comissao: u.comissao || null, comissao_devida: 0, comissao_recebida: 0, comissao_a_receber: 0 } : {}) };
  por.geral = { id: 'geral', nome: 'Despesas gerais', ...zero() };
  const meses = {};
  const mes = d => d.slice(0, 7);
  const m = d => (meses[mes(d)] = meses[mes(d)] || { mes: mes(d), faturamento: 0, recebido: 0, despesas: 0 });
  let semValor = 0;

  for (const r of reservasLista) {
    if (!r || r.status === 'bloqueado' || !por[r.unidade]) continue;
    for (const p of Array.isArray(r.pagamentos) ? r.pagamentos : []) {
      if (emPeriodo(p.data, de, ate)) { por[r.unidade].recebido += Number(p.valor) || 0; m(p.data).recebido += Number(p.valor) || 0; }
    }
    if (FECHADAS.includes(r.status) && emPeriodo(r.data, de, ate)) {
      const total = Number(r.valor_total) || 0;
      por[r.unidade].reservas += 1;
      por[r.unidade].faturamento += total;
      por[r.unidade].a_receber += Math.max(0, total - somaPagamentos(r));
      m(r.data).faturamento += total;
      if (!(total > 0)) semValor += 1;
      const com = por[r.unidade].terceiro && por[r.unidade].comissao;
      if (com) por[r.unidade].comissao_devida += com.tipo === 'valor' ? com.valor : total * com.valor / 100;
    }
  }
  for (const d of despesasLista) {
    if (!emPeriodo(d.data, de, ate)) continue;
    const alvo = por[d.unidade] || por.geral;
    if (d.tipo === 'comissao') { if (alvo.terceiro) alvo.comissao_recebida += Number(d.valor) || 0; continue; } // comissão recebida não é despesa
    alvo.despesas += Number(d.valor) || 0;
    m(d.data).despesas += Number(d.valor) || 0;
  }
  const total = { id: 'total', nome: 'Total', ...zero() };
  for (const k of Object.keys(por)) {
    const u = por[k];
    for (const campo of ['reservas', 'faturamento', 'recebido', 'a_receber', 'despesas']) { u[campo] = arred(u[campo]); total[campo] += u[campo]; }
    u.lucro_previsto = arred(u.faturamento - u.despesas);
    u.lucro_caixa = arred(u.recebido - u.despesas);
  }
  total.comissao_devida = 0; total.comissao_recebida = 0; total.minha_receita = 0;
  for (const u of Object.values(por)) {
    if (u.terceiro) {
      u.comissao_devida = arred(u.comissao_devida); u.comissao_recebida = arred(u.comissao_recebida);
      u.comissao_a_receber = arred(Math.max(0, u.comissao_devida - u.comissao_recebida));
      total.comissao_devida += u.comissao_devida; total.comissao_recebida += u.comissao_recebida;
      u.minha_receita = u.comissao_recebida;
    } else u.minha_receita = u.recebido;
    u.meu_lucro = arred(u.minha_receita - u.despesas);
    total.minha_receita += u.minha_receita;
  }
  total.comissao_devida = arred(total.comissao_devida); total.comissao_recebida = arred(total.comissao_recebida); total.minha_receita = arred(total.minha_receita);
  total.comissao_a_receber = arred(Math.max(0, total.comissao_devida - total.comissao_recebida));
  for (const campo of ['faturamento', 'recebido', 'a_receber', 'despesas']) total[campo] = arred(total[campo]);
  total.meu_lucro = arred(total.minha_receita - total.despesas);
  total.lucro_previsto = arred(total.faturamento - total.despesas);
  total.lucro_caixa = arred(total.recebido - total.despesas);
  const listaMeses = Object.values(meses).sort((a, b) => a.mes.localeCompare(b.mes)).map(x => ({
    mes: x.mes, faturamento: arred(x.faturamento), recebido: arred(x.recebido), despesas: arred(x.despesas), lucro_caixa: arred(x.recebido - x.despesas),
  }));
  return { de, ate, por_unidade: Object.values(por).filter(u => u.id !== 'geral' || u.despesas > 0), total, meses: listaMeses, reservas_sem_valor: semValor };
}

// Clientes agrupados pelo WhatsApp: quem mais alugou, quanto gastou e quem merece desconto de fidelidade.
function resumoClientes(reservasLista, fidelidade) {
  const mapa = new Map();
  for (const r of reservasLista) {
    if (!r || r.status === 'bloqueado') continue;
    const zap = digits(r.whatsapp);
    const chave = zap.length >= 10 ? zap : 'nome:' + String(r.nome || '').trim().toLowerCase();
    if (chave === 'nome:') continue;
    let c = mapa.get(chave);
    if (!c) { c = { chave, nome: '', whatsapp: zap, email: '', pedidos: 0, reservas: 0, cancelados: 0, total: 0, pago: 0, ultima: '', unidades: new Set(), _dataNome: '' }; mapa.set(chave, c); }
    c.pedidos += 1;
    if ((r.data || '') >= c._dataNome) { c._dataNome = r.data || ''; if (r.nome) c.nome = r.nome; if (r.email) c.email = r.email; }
    if (FECHADAS.includes(r.status)) {
      c.reservas += 1; c.total += Number(r.valor_total) || 0; c.pago += somaPagamentos(r);
      if ((r.data || '') > c.ultima) c.ultima = r.data;
      c.unidades.add(r.unidade);
    } else if (['cancelado', 'recusado', 'expirado'].includes(r.status)) c.cancelados += 1;
  }
  const lista = [...mapa.values()].map(({ _dataNome, unidades, ...c }) => ({
    ...c, total: arred(c.total), pago: arred(c.pago), unidades: [...unidades],
    fiel: c.reservas >= fidelidade.minimo, desconto_sugerido: c.reservas >= fidelidade.minimo ? fidelidade.percentual : 0,
  }));
  lista.sort((a, b) => (b.reservas - a.reservas) || (b.total - a.total) || a.nome.localeCompare(b.nome));
  return lista;
}

// ── Editor e Fotos ─────────────────────────────────────────────────────────

const { limparConteudo } = require('./agenda');

const CONTEUDO_MAX_LOCACAO = 900 * 1024; // ~900 KB
const FOTO_MAX_BYTES = 600 * 1024;
const FOTOS_MAX_POR_UNIDADE = 150;
const FOTOS_MAX_TOTAL = 300;
const FOTO_ID_RE = /^[a-f0-9]{24}$/;
const TIPOS_FOTO = { 'image/webp': [0x52, 0x49, 0x46, 0x46], 'image/jpeg': [0xff, 0xd8, 0xff], 'image/png': [0x89, 0x50, 0x4e, 0x47] };

const _fotos = new Map();
let _fotosBytes = 0;
function guardarFotoEmMemoria(k, v) {
  if (_fotos.has(k)) return;
  _fotos.set(k, v);
  _fotosBytes += v.base64.length;
  while (_fotosBytes > 30 * 1024 * 1024 && _fotos.size) { const [k0, v0] = _fotos.entries().next().value; _fotos.delete(k0); _fotosBytes -= v0.base64.length; }
}

function lerFoto(dados, tipo) {
  const assinatura = TIPOS_FOTO[tipo];
  if (!assinatura || typeof dados !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(dados)) return { error: 'Envie uma foto (JPG, PNG ou WebP).' };
  const buf = Buffer.from(dados, 'base64');
  if (!buf.length) return { error: 'Foto vazia.' };
  if (buf.length > FOTO_MAX_BYTES) return { error: 'Foto grande demais. Tente outra.' };
  if (!assinatura.every((b, i) => buf[i] === b)) return { error: 'Este arquivo não é uma foto.' };
  return { base64: buf.toString('base64'), bytes: buf.length };
}

function gerarEmbedVideo(urlStr) {
  const strUrl = str(urlStr, 500);
  if (!strUrl) return { error: 'Informe a URL do vídeo.' };
  let u;
  try {
    u = new URL(strUrl);
  } catch {
    return { error: 'URL do vídeo inválida.' };
  }
  const host = u.hostname.toLowerCase();
  const path = u.pathname;

  // YouTube
  if (host === 'youtube.com' || host === 'www.youtube.com' || host === 'm.youtube.com') {
    let videoId = u.searchParams.get('v');
    if (!videoId) {
      const parts = path.split('/').filter(Boolean);
      if (parts[0] === 'embed' || parts[0] === 'v' || parts[0] === 'shorts') {
        videoId = parts[1];
      }
    }
    if (videoId && /^[A-Za-z0-9_-]{8,20}$/.test(videoId)) {
      return {
        ok: true,
        provedor: 'youtube',
        video_id: videoId,
        url_original: strUrl,
        embed_url: `https://www.youtube.com/embed/${videoId}`,
      };
    }
  } else if (host === 'youtu.be') {
    const videoId = path.replace(/^\//, '').split('/')[0];
    if (videoId && /^[A-Za-z0-9_-]{8,20}$/.test(videoId)) {
      return {
        ok: true,
        provedor: 'youtube',
        video_id: videoId,
        url_original: strUrl,
        embed_url: `https://www.youtube.com/embed/${videoId}`,
      };
    }
  }

  // Instagram
  if (host === 'instagram.com' || host === 'www.instagram.com') {
    const parts = path.split('/').filter(Boolean);
    if (['p', 'reel', 'tv'].includes(parts[0]) && parts[1]) {
      const code = parts[1];
      if (/^[A-Za-z0-9_-]{5,40}$/.test(code)) {
        return {
          ok: true,
          provedor: 'instagram',
          code,
          url_original: strUrl,
          embed_url: `https://www.instagram.com/p/${code}/embed/`,
        };
      }
    }
  }

  // Vimeo
  if (host === 'vimeo.com' || host === 'www.vimeo.com' || host === 'player.vimeo.com') {
    const parts = path.split('/').filter(Boolean);
    const videoId = parts[parts.length - 1];
    if (videoId && /^\d{5,12}$/.test(videoId)) {
      return {
        ok: true,
        provedor: 'vimeo',
        video_id: videoId,
        url_original: strUrl,
        embed_url: `https://player.vimeo.com/video/${videoId}`,
      };
    }
  }

  return { error: 'Domínio de vídeo não permitido. Use links do YouTube, Instagram ou Vimeo.' };
}

function limparConteudoLocacao(c) {
  const base = limparConteudo(c);
  c = c && typeof c === 'object' && !Array.isArray(c) ? c : {};

  if (c.aviso && typeof c.aviso === 'object') {
    base.aviso = {
      ativo: Boolean(c.aviso.ativo),
      texto: str(c.aviso.texto, 300),
      cor: str(c.aviso.cor, 30) || 'info',
    };
  }

  if (c.contatos && typeof c.contatos === 'object') {
    const cnt = c.contatos;
    base.contatos = {};
    if (cnt.whatsapp) base.contatos.whatsapp = digits(cnt.whatsapp).slice(0, 13);
    if (cnt.telefone) base.contatos.telefone = digits(cnt.telefone).slice(0, 13);
    if (cnt.email) base.contatos.email = str(cnt.email, 120);
    if (cnt.endereco) base.contatos.endereco = str(cnt.endereco, 200);
    if (cnt.instagram) base.contatos.instagram = str(cnt.instagram, 80);
  }

  if (Array.isArray(c.videos)) {
    base.videos = c.videos.slice(0, 30).map(v => {
      if (!v || typeof v !== 'object') return null;
      const emb = gerarEmbedVideo(v.url || v.embed_url || v.url_original);
      if (!emb.ok) return null;
      return {
        id: str(v.id, 40) || aleatorio(8),
        unidade: str(v.unidade, 40),
        titulo: str(v.titulo, 120),
        provedor: emb.provedor,
        embed_url: emb.embed_url,
        url_original: emb.url_original,
      };
    }).filter(Boolean);
  }

  return base;
}

function painelDe(slug, cadastro = {}) {
  const p = typeof cadastro.painel === 'string' && /^https:\/\/[a-z0-9.-]+\//.test(cadastro.painel) ? cadastro.painel : `https://${slug}.pages.dev/agenda/`;
  return p;
}

function createHandler(deps = {}) {
  const getDb = deps.getDb || (() => require('./firebase-init').db);
  const getMw = deps.getMw || (() => require('./middleware'));
  const getCadastro = deps.getCadastro || (slug => {
    try { return require('../../clientes/locacoes.js').LOCACOES[slug]; } catch { return undefined; }
  });
  const getLista = deps.getLista || (() => {
    try { return require('../../clientes/locacoes.js').LOCACOES; } catch { return {}; }
  });
  const now = deps.now || (() => Date.now());

  return async (event) => {
    const method = String(event.httpMethod || '').toUpperCase();
    const headers = event.headers || {};
    const cors = {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };
    const res = (statusCode, body) => ({ statusCode, headers: cors, body: JSON.stringify(body) });
    if (method === 'OPTIONS') return { statusCode: 204, headers: cors, body: '' };
    if (method !== 'GET' && method !== 'POST') return res(405, { error: 'Method Not Allowed' });

    let body = {};
    if (method === 'POST' && event.body) {
      try { body = JSON.parse(event.body); } catch { return res(400, { error: 'Pedido inválido.' }); }
    }
    if (!body || typeof body !== 'object' || Array.isArray(body)) body = {};
    const q = event.queryStringParameters || {};

    const getAuth = async () => {
      const authHeader = Object.entries(headers).find(([k]) => k.toLowerCase() === 'authorization')?.[1];
      return authHeader ? await getMw().verifyBearerToken(event) : { ok: false };
    };

    // Suporte NEXIA: lista de todas as contas de locação (só master)
    if (method === 'GET' && q.suporte === 'lista') {
      const auth = await getAuth();
      if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da NEXIA vê esta lista.' });
      const lista = Object.entries(getLista())
        .map(([s, c]) => ({ site: s, nome: c.nome || s, painel: painelDe(s, c) }));
      return res(200, { locacoes: lista });
    }

    const slug = str(method === 'GET' ? q.site : body.site, 40).toLowerCase();
    if (!SLUG_RE.test(slug)) return res(400, { error: 'Conta de locação inválida.' });
    const cadastro = getCadastro(slug);
    if (!cadastro) return res(404, { error: 'Esta conta de locação não existe.' });
    const db = getDb();
    if (!db) return res(503, { error: 'Serviço indisponível. Tente de novo em instantes.' });
    const ip = headers['cf-connecting-ip'] || String(headers['x-forwarded-for'] || '').split(',')[0].trim();

    const conta = db.collection(COLLECTION).doc(slug);
    const reservas = conta.collection('reservas');
    const diasLock = conta.collection('dias');
    const getPush = () => require('./body-coach/push.js');

    /** Avisa no celular da dona (Web Push) que algo novo chegou; nunca atrapalha o pedido. */
    async function avisarPainel(titulo, corpo) {
      try {
        const snap = await conta.collection('push').get();
        const subs = snap.docs.map(d => ({ ref: d.ref, ...d.data() }));
        if (!subs.length) return 0;
        const push = getPush();
        const corte = Promise.race([
          Promise.all(subs.map(async sub => {
            const st = await push.enviarUm(db, sub, { titulo, corpo, url: './', tag: 'pedido-novo', urgente: true }).catch(() => 0);
            if (st === 404 || st === 410) await sub.ref.delete().catch(() => {});
            return st >= 200 && st < 300 ? 1 : 0;
          })),
          new Promise(r => setTimeout(() => r([0]), 3500)),
        ]);
        return (await corte).reduce((a, b) => a + b, 0);
      } catch { return 0; }
    }

    const lerConta = async () => { const s = await conta.get(); return s.exists ? s.data() : {}; };

    /** Verifica prazos vencidos e expira reservas em 'pedido' ou 'aguardando_sinal'. */
    async function verificarExpirados() {
      const agoraIso = new Date(now()).toISOString();
      const pendentesSnap = await reservas.where('status', 'in', ['pedido', 'aguardando_sinal']).get();
      for (const doc of pendentesSnap.docs) {
        const item = doc.data();
        if (item.prazo_ate && item.prazo_ate <= agoraIso) {
          const id = doc.id;
          const audit = Array.isArray(item.auditoria) ? item.auditoria : [];
          audit.push({ quando: agoraIso, quem: 'sistema', de: item.status, para: 'expirado' });
          await reservas.doc(id).update({
            status: 'expirado',
            auditoria: audit,
            atualizado_em: agoraIso,
          });
          const keyLock = `${item.unidade}_${item.data}`;
          await diasLock.doc(keyLock).delete();
        }
      }
    }

    // ── Público: Fotos e Conteúdo do Site ──
    if (method === 'GET' && q.foto !== undefined) {
      const id = str(q.foto, 40);
      if (!FOTO_ID_RE.test(id)) return res(400, { error: 'Foto inválida.' });
      const k = slug + '/' + id;
      let f = _fotos.get(k);
      if (!f) {
        const snap = await conta.collection('fotos').doc(id).get();
        if (!snap.exists) return res(404, { error: 'Foto não encontrada.' });
        f = { tipo: snap.data().tipo, base64: snap.data().dados };
        guardarFotoEmMemoria(k, f);
      }
      return { statusCode: 200, isBase64Encoded: true, body: f.base64, headers: { ...cors, 'Content-Type': f.tipo, 'Cache-Control': 'public, max-age=31536000, immutable' } };
    }
    if (method === 'GET' && q.conteudo !== undefined) {
      const snap = await conta.collection('site').doc('conteudo').get();
      return res(200, { conteudo: snap.exists ? limparConteudoLocacao(snap.data()) : null });
    }
    if (method === 'GET' && q.foto_listar !== undefined) {
      const snap = await conta.collection('fotos').get();
      let fotos = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          tipo: data.tipo,
          unidade: data.unidade || '',
          legenda: data.legenda || '',
          ordem: Number(data.ordem) || 0,
          capa: Boolean(data.capa),
          url: `/api/locacao?site=${slug}&foto=${d.id}`,
          criado_em: data.criado_em || null,
        };
      });
      fotos = fotos.filter(f => f.unidade !== 'comprovantes'); // comprovantes nunca aparecem na lista pública
      const uFiltro = str(q.unidade, 40);
      if (uFiltro) fotos = fotos.filter(f => f.unidade === uFiltro);
      fotos.sort((a, b) => (a.ordem - b.ordem) || (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { fotos });
    }
    if (method === 'GET' && q.video_listar !== undefined) {
      const snap = await conta.collection('videos').get();
      let videos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const uFiltro = str(q.unidade, 40);
      if (uFiltro) videos = videos.filter(v => v.unidade === uFiltro);
      videos.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { videos });
    }

    // ── Público: Mapa do Mês por Unidade ou Configuração Geral ──
    if (method === 'GET') {
      await verificarExpirados();
      const cfg = montarConfig(cadastro, (await lerConta()).config);
      const unidadeId = str(q.unidade, 40);
      const mes = str(q.mes, 7);

      if (unidadeId && mes) {
        if (!MES_RE.test(mes)) return res(400, { error: 'Mês inválido. Use AAAA-MM.' });
        const unidade = cfg.unidades.find(u => u.id === unidadeId);
        if (!unidade) return res(400, { error: 'Unidade não encontrada.' });

        const [anoStr, mesStr] = mes.split('-');
        const ano = Number(anoStr);
        const mesNum = Number(mesStr);
        const totalDias = new Date(ano, mesNum, 0).getDate();

        const inicioMes = `${mes}-01`;
        const fimMes = `${mes}-${String(totalDias).padStart(2, '0')}`;

        const hoje = agoraBr(now()).data;
        const minData = somaDias(hoje, cfg.antecedencia_dias);
        const maxData = somaDias(hoje, cfg.dias_a_frente);

        // Busca todas as travas registradas na coleção 'dias' para essa unidade no mês
        // Só o campo "data" no filtro (o Firestore exigiria índice composto com "unidade"); a unidade é filtrada aqui.
        const travasSnap = await diasLock
          .where('data', '>=', inicioMes)
          .where('data', '<=', fimMes)
          .get();

        const diasOcupadosSet = new Set(travasSnap.docs.map(d => d.data()).filter(t => t.unidade === unidadeId).map(t => t.data));

        const mapaDias = {};
        const precos = {};
        for (let i = 1; i <= totalDias; i++) {
          const diaStr = `${mes}-${String(i).padStart(2, '0')}`;
          if (diaStr < minData || diaStr > maxData || diasOcupadosSet.has(diaStr)) {
            mapaDias[diaStr] = 'ocupado';
          } else {
            mapaDias[diaStr] = 'livre';
            const vd = valorDaDiaria(unidade, diaStr, cfg);
            if (vd.valor > 0) precos[diaStr] = vd.promocao ? { v: vd.valor, p: vd.promocao } : { v: vd.valor };
          }
        }

        return res(200, { unidade: unidadeId, mes, dias: mapaDias, precos });
      }

      return res(200, configPublica(cfg));
    }

    const acao = str(body.acao, 30);

    // ── Público: Fazer Pedido de Reserva ──
    if (acao === 'pedir') {
      if (str(body.campo_extra, 20) || str(body.site_url, 20)) return res(200, { ok: true }); // honeypot
      if (!ipPermitido('pedir', ip, now())) return res(429, { error: 'Muitos pedidos seguidos. Tente de novo em 1 minuto.' });
      if (body.consentimento !== true) return res(400, { error: 'É preciso aceitar o contato para prosseguir (LGPD).' });

      const { pessoa, error: errPessoa } = limparPessoa(body);
      if (errPessoa) return res(400, { error: errPessoa });

      await verificarExpirados();
      const cfg = montarConfig(cadastro, (await lerConta()).config);

      const unidadeId = str(body.unidade, 40);
      const unidade = cfg.unidades.find(u => u.id === unidadeId);
      if (!unidade) return res(400, { error: 'Escolha uma unidade válida.' });

      const data = str(body.data, 10);
      if (!dataValida(data)) return res(400, { error: 'Data de reserva inválida.' });

      const hoje = agoraBr(now()).data;
      const minData = somaDias(hoje, cfg.antecedencia_dias);
      const maxData = somaDias(hoje, cfg.dias_a_frente);

      if (data < minData) return res(400, { error: `Reservas exigem antecedência mínima de ${cfg.antecedencia_dias} dia(s).` });
      if (data > maxData) return res(400, { error: 'Data além do limite permitido para agendamentos futuros.' });

      const keyLock = `${unidadeId}_${data}`;
      const refLock = diasLock.doc(keyLock);

      // Extras escolhidos (ex.: decoração): só valem os que a dona deixou ativos; guardamos nome e valor da hora do pedido.
      const idsExtras = (Array.isArray(body.extras) ? body.extras : []).slice(0, 20).map(x => str(x, 40));
      const extrasSel = cfg.extras.filter(e => e.ativo && idsExtras.includes(e.id)).map(e => ({ id: e.id, nome: e.nome, valor: valorExtra(e) }));
      const somaExtras = extrasSel.reduce((a, e) => a + e.valor, 0);
      const base = Math.round((valorDaDiaria(unidade, data, cfg).valor + somaExtras) * 100) / 100;
      let sinalValor = 0;
      if (cfg.sinal.tipo === 'valor') sinalValor = cfg.sinal.valor || 0;
      else if (cfg.sinal.valor > 0 && base > 0) sinalValor = Math.round(base * cfg.sinal.valor) / 100;

      const refReserva = reservas.doc();
      const protocolo = 'SPL-' + aleatorio(3).toUpperCase();
      const agoraIso = new Date(now()).toISOString();
      const prazoIso = new Date(now() + cfg.prazo_horas * 3600000).toISOString();

      const novaReserva = {
        id: refReserva.id,
        protocolo,
        unidade: unidadeId,
        unidade_nome: unidade.nome,
        data,
        status: 'pedido',
        ...pessoa,
        extras: extrasSel,
        valor_total: base,
        valor_sinal: sinalValor,
        consentimento: true,
        prazo_ate: prazoIso,
        criado_em: agoraIso,
        atualizado_em: agoraIso,
        auditoria: [{ quando: agoraIso, quem: 'cliente', de: null, para: 'pedido' }],
      };

      const lote = db.batch();
      lote.set(refReserva, novaReserva);
      lote.create(refLock, { reserva_id: refReserva.id, unidade: unidadeId, data, criado_em: agoraIso });

      try {
        await lote.commit();
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) {
          return res(409, { error: 'Este dia já está reservado para esta unidade. Escolha outra data.' });
        }
        throw e;
      }

      await avisarPainel('Reserva nova!', `${pessoa.nome || 'Cliente'} pediu ${data.split('-').reverse().join('/')} — ${unidade.nome || 'Splash'}`);

      // A chave Pix só é mostrada a quem acabou de fazer um pedido (e só se a dona deixar ligado no painel).
      const pix = cfg.pix.chave && cfg.pix.mostrar ? { chave: cfg.pix.chave, titular: cfg.pix.titular } : null;
      return res(201, {
        ok: true,
        protocolo,
        prazo_ate: prazoIso,
        mensagem: cfg.mensagem_pedido,
        pix,
        sinal_valor: sinalValor,
        sinal_percentual: cfg.sinal.tipo === 'percentual' ? cfg.sinal.valor : 0,
        valor_total: base,
        extras: extrasSel,
        whatsapp: cfg.whatsapp,
      });
    }

    // ── Público: cliente consulta a própria reserva (protocolo + WhatsApp) ──
    if (acao === 'consultar') {
      if (!ipPermitido('comprovante', ip, now())) return res(429, { error: 'Muitas consultas seguidas. Tente de novo em alguns minutos.' });
      const protocolo = str(body.protocolo, 20).toUpperCase().replace(/\s/g, '');
      const zap = digits(body.whatsapp);
      if (!/^SPL-[A-Z0-9]{4,8}$/.test(protocolo) || zap.length < 8) return res(400, { error: 'Informe o protocolo e o WhatsApp usado no pedido.' });
      const snapC = await reservas.where('protocolo', '==', protocolo).get();
      const docC = snapC.docs.find(d => { const w = digits(d.data().whatsapp); return w && w.slice(-8) === zap.slice(-8); });
      if (!docC) return res(404, { error: 'Não encontrei esse pedido. Confira o protocolo e o WhatsApp.' });
      const r = docC.data();
      const cfgC = montarConfig(cadastro, (await lerConta()).config);
      const pago = somaPagamentos(r);
      const total = Number(r.valor_total) || 0;
      return res(200, {
        ok: true, protocolo: r.protocolo, status: r.status, data: r.data, unidade_nome: r.unidade_nome || '', nome: r.nome,
        tipo_evento: r.tipo_evento || '', extras: (r.extras || []).map(e => e.nome),
        valor_total: total, valor_sinal: Number(r.valor_sinal) || 0, valor_pago: pago, saldo: Math.max(0, arred(total - pago)),
        prazo_ate: ['pedido', 'aguardando_sinal'].includes(r.status) ? r.prazo_ate || null : null,
        comprovantes: Array.isArray(r.comprovantes) ? r.comprovantes.length : 0,
        pix: cfgC.pix.chave && cfgC.pix.mostrar ? { chave: cfgC.pix.chave, titular: cfgC.pix.titular } : null,
        whatsapp: cfgC.whatsapp,
      });
    }

    // ── Público: cliente anexa o comprovante do Pix (protocolo + final do WhatsApp conferem) ──
    if (acao === 'comprovante-enviar') {
      if (!ipPermitido('comprovante', ip, now())) return res(429, { error: 'Muitos envios seguidos. Tente de novo em alguns minutos.' });
      const protocolo = str(body.protocolo, 20).toUpperCase();
      const zap = digits(body.whatsapp);
      if (!/^SPL-[A-Z0-9]{4,8}$/.test(protocolo) || zap.length < 8) return res(400, { error: 'Informe o protocolo e o WhatsApp do pedido.' });
      const snapR = await reservas.where('protocolo', '==', protocolo).get();
      const docR = snapR.docs.find(d => { const w = digits(d.data().whatsapp); return w && w.slice(-8) === zap.slice(-8); });
      if (!docR) return res(404, { error: 'Não encontrei esse pedido. Confira o protocolo e o WhatsApp.' });
      const reserva = docR.data();
      if (['recusado', 'cancelado', 'expirado'].includes(reserva.status)) return res(400, { error: 'Este pedido não está mais ativo. Fale com a locadora pelo WhatsApp.' });
      const anteriores = Array.isArray(reserva.comprovantes) ? reserva.comprovantes : [];
      if (anteriores.length >= 5) return res(400, { error: 'Limite de comprovantes deste pedido atingido. Envie o restante pelo WhatsApp.' });
      let raw = typeof body.dados === 'string' ? body.dados : '';
      let tipo = str(body.tipo, 20);
      const m = raw.match(/^data:(image\/[a-z]+);base64,(.*)$/);
      if (m) { if (!tipo) tipo = m[1]; raw = m[2]; }
      const { base64, bytes, error: errFoto } = lerFoto(raw, tipo);
      if (errFoto) return res(400, { error: errFoto });
      const snapF = await conta.collection('fotos').get();
      if (snapF.docs.filter(d => d.data().unidade === 'comprovantes').length >= 200) return res(400, { error: 'Não consegui guardar o comprovante agora. Envie pelo WhatsApp.' });
      const fid = aleatorio(12);
      const agoraIso = new Date(now()).toISOString();
      await conta.collection('fotos').doc(fid).set({ id: fid, tipo, dados: base64, bytes, unidade: 'comprovantes', legenda: 'comprovante ' + protocolo, ordem: 0, capa: false, criado_em: agoraIso, atualizado_em: agoraIso });
      await reservas.doc(docR.id).update({ comprovantes: [...anteriores, { id: fid, em: agoraIso }], atualizado_em: agoraIso });
      return res(201, { ok: true });
    }

    // ── Painel: Autenticação (Entrar / Primeiro Acesso) ──
    const novaSessao = async () => {
      const token = aleatorio(32);
      await conta.collection('sessoes').doc(await sha256(token)).set({
        expira: now() + SESSAO_DIAS * 86400000,
        criado_em: new Date(now()).toISOString(),
      });
      return token;
    };

    if (acao === 'primeiro-acesso' || acao === 'entrar') {
      if (!ipPermitido('entrar', ip, now())) return res(429, { error: 'Muitas tentativas. Espere 10 minutos e tente de novo.' });
      const dados = await lerConta();
      const versao = Number(cadastro.versao) || 1;

      if (acao === 'primeiro-acesso') {
        // O código só serve até a dona criar a senha (ou se o dono subir "versao" para gerar um novo). Sem isso, quem tivesse o código trocaria a senha dela.
        if (dados.senha_hash && (Number(dados.versao) || 1) >= versao) {
          return res(400, { error: 'Esta conta já tem senha. Use "Entrar".' });
        }
        if (!cadastro.codigo_hash || !cadastro.codigo_salt) {
          return res(400, { error: 'Esta conta ainda não foi ativada pelo administrador.', sem_ativacao: true });
        }
        const codigo = str(body.codigo, 40).toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!iguais(await hashSenha(codigo, cadastro.codigo_salt), cadastro.codigo_hash)) {
          return res(401, { error: 'Código de acesso incorreto.' });
        }
        const fraca = senhaFraca(body.senha_nova);
        if (fraca) return res(400, { error: fraca });
        const salt = aleatorio(16);
        await conta.set({
          senha_hash: await hashSenha(body.senha_nova, salt),
          senha_salt: salt,
          versao,
          senha_em: new Date(now()).toISOString(),
        }, { merge: true });
        return res(200, { ok: true, token: await novaSessao() });
      }

      // Senhas iniciais (ex.: ADMIN01 e AMANDA01) valem até alguém trocar a senha em "Sua Conta".
      const confereInicial = async txt => {
        if (dados.senha_personalizada === true || !Array.isArray(cadastro.senhas_iniciais) || typeof txt !== 'string') return false;
        const norm = txt.trim().toUpperCase().slice(0, 100);
        for (const si of cadastro.senhas_iniciais) if (si && si.salt && si.hash && iguais(await hashSenha(norm, si.salt), si.hash)) return true;
        return false;
      };
      if (await confereInicial(body.senha)) return res(200, { ok: true, token: await novaSessao() });

      if (!dados.senha_hash) {
        if (!cadastro.codigo_hash) {
          return res(400, { error: 'Esta conta ainda não foi ativada pelo administrador.', sem_ativacao: true });
        }
        return res(400, { error: 'Primeiro acesso: informe o código de ativação para criar sua senha.', primeiro_acesso: true });
      }

      if (typeof body.senha !== 'string' || !iguais(await hashSenha(body.senha.slice(0, 100), dados.senha_salt), dados.senha_hash)) {
        return res(401, { error: 'Senha incorreta.' });
      }
      return res(200, { ok: true, token: await novaSessao() });
    }

    // ── Suporte NEXIA: Acesso Master sem senha ──
    if (acao === 'suporte') {
      const auth = await getAuth();
      if (!auth.ok || auth.role !== 'master') return res(403, { error: 'Só o administrador da NEXIA entra como suporte.' });
      const token = aleatorio(32);
      const quando = new Date(now()).toISOString();
      const por = str(auth.email || auth.uid || 'master', 120);
      await conta.collection('sessoes').doc(await sha256(token)).set({ expira: now() + SUPORTE_HORAS * 3600000, criado_em: quando, suporte: true, por });
      await conta.collection('suporte').add({ por, em: quando });
      return res(200, { ok: true, token, painel: painelDe(slug, cadastro), horas: SUPORTE_HORAS });
    }

    // ── Autenticação do Painel para Ações Privadas ──
    let sessaoId = null;
    let logado = false;
    const token = str(body.token, 100);
    if (/^[a-f0-9]{64}$/.test(token)) {
      sessaoId = await sha256(token);
      const s = await conta.collection('sessoes').doc(sessaoId).get();
      logado = s.exists && Number(s.data().expira) > now();
    }
    if (!logado) {
      const auth = await getAuth();
      logado = !!(auth.ok && auth.role === 'master');
      sessaoId = null;
    }
    if (!logado) return res(401, { error: 'Sessão expirada. Faça login novamente.', sair: true });

    await verificarExpirados();
    const dados = await lerConta();
    const cfg = montarConfig(cadastro, dados.config);

    if (acao === 'sair') {
      if (sessaoId) await conta.collection('sessoes').doc(sessaoId).delete();
      return res(200, { ok: true });
    }

    if (acao === 'trocar-senha') {
      let atualOk = Boolean(dados.senha_hash) && typeof body.senha_atual === 'string' && iguais(await hashSenha(body.senha_atual.slice(0, 100), dados.senha_salt), dados.senha_hash);
      if (!atualOk && dados.senha_personalizada !== true && Array.isArray(cadastro.senhas_iniciais) && typeof body.senha_atual === 'string') {
        const norm = body.senha_atual.trim().toUpperCase().slice(0, 100);
        for (const si of cadastro.senhas_iniciais) if (si && si.salt && si.hash && iguais(await hashSenha(norm, si.salt), si.hash)) atualOk = true;
      }
      if (!atualOk) return res(401, { error: 'Senha atual incorreta.' });
      const fraca = senhaFraca(body.senha_nova);
      if (fraca) return res(400, { error: fraca });
      const salt = aleatorio(16);
      await conta.set({ senha_hash: await hashSenha(body.senha_nova, salt), senha_salt: salt, senha_personalizada: true, senha_em: new Date(now()).toISOString() }, { merge: true });
      return res(200, { ok: true });
    }

    if (acao === 'listar') {
      const hoje = agoraBr(now()).data;
      const de = dataValida(str(body.de, 10)) ? body.de : hoje;
      let ate = dataValida(str(body.ate, 10)) ? body.ate : somaDias(de, 60);
      if (ate < de) ate = de;
      if (ate > somaDias(de, 365)) ate = somaDias(de, 365);

      const unidadeFiltro = str(body.unidade, 40);
      const snap = await reservas.where('data', '>=', de).where('data', '<=', ate).get(); // sem índice composto: a unidade é filtrada abaixo
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      if (unidadeFiltro) lista = lista.filter(i => i.unidade === unidadeFiltro);

      const statusFiltro = str(body.status, 30);
      if (statusFiltro && STATUS_VALIDOS.includes(statusFiltro)) {
        lista = lista.filter(i => i.status === statusFiltro);
      }
      lista.sort((a, b) => a.data.localeCompare(b.data));

      const pendSnap = await reservas.where('status', 'in', ['pedido', 'aguardando_sinal']).get();
      const pendentes = pendSnap.docs
        .map(d => ({ id: d.id, ...d.data() }))
        .sort((a, b) => a.data.localeCompare(b.data));

      return res(200, { de, ate, hoje, itens: lista, pendentes, config: cfg });
    }

    if (acao === 'criar') {
      const { pessoa, error: errPessoa } = limparPessoa(body);
      if (errPessoa) return res(400, { error: errPessoa });

      const unidadeId = str(body.unidade, 40);
      const unidade = cfg.unidades.find(u => u.id === unidadeId);
      if (!unidade) return res(400, { error: 'Escolha uma unidade válida.' });

      const data = str(body.data, 10);
      if (!dataValida(data)) return res(400, { error: 'Data de reserva inválida.' });

      const status = str(body.status, 30) || 'confirmado';
      if (!STATUS_VALIDOS.includes(status)) return res(400, { error: 'Status de reserva inválido.' });

      const keyLock = `${unidadeId}_${data}`;
      const refLock = diasLock.doc(keyLock);

      const lockDoc = await refLock.get();
      if (lockDoc.exists) {
        return res(409, { error: 'Este dia já está reservado ou bloqueado nesta unidade.' });
      }

      const refReserva = reservas.doc();
      const protocolo = 'SPL-' + aleatorio(3).toUpperCase();
      const agoraIso = new Date(now()).toISOString();

      const novaReserva = {
        id: refReserva.id,
        protocolo,
        unidade: unidadeId,
        unidade_nome: unidade.nome,
        data,
        status,
        ...pessoa,
        // valores opcionais já na criação (a dona também pode definir depois, ao editar a reserva)
        ...(Number(body.valor_total) > 0 ? { valor_total: arred(Math.min(Number(body.valor_total), 10000000)) } : {}),
        ...(Number(body.valor_sinal) > 0 ? { valor_sinal: arred(Math.min(Number(body.valor_sinal), 10000000)) } : {}),
        ...(arred(body.valor_pago) > 0 ? { pagamentos: [{ id: aleatorio(8), valor: arred(Math.min(Number(body.valor_pago), 10000000)), forma: FORMAS_PAGAMENTO.includes(body.forma_pago) ? body.forma_pago : 'pix', data: agoraBr(now()).data, obs: 'Lançado junto com a reserva', criado_em: agoraIso }], valor_pago: arred(Math.min(Number(body.valor_pago), 10000000)) } : {}),
        prazo_ate: status === 'pedido' || status === 'aguardando_sinal' ? new Date(now() + cfg.prazo_horas * 3600000).toISOString() : null,
        criado_em: agoraIso,
        atualizado_em: agoraIso,
        auditoria: [{ quando: agoraIso, quem: 'painel', de: null, para: status }],
      };

      const lote = db.batch();
      lote.set(refReserva, novaReserva);
      if (ATIVOS.includes(status)) {
        lote.create(refLock, { reserva_id: refReserva.id, unidade: unidadeId, data, criado_em: agoraIso });
      }

      try {
        await lote.commit();
      } catch (e) {
        if (e && (e.code === 6 || /ALREADY_EXISTS/.test(String(e.message)))) {
          return res(409, { error: 'Este dia já está reservado ou bloqueado nesta unidade.' });
        }
        throw e;
      }

      return res(201, { ok: true, id: refReserva.id, protocolo });
    }

    if (acao === 'status') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de reserva inválido.' });
      const novoStatus = str(body.status, 30);
      if (!STATUS_VALIDOS.includes(novoStatus)) return res(400, { error: 'Status inválido.' });

      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Reserva não encontrada.' });

      const atual = snap.data();
      const statusAnt = atual.status;

      if (statusAnt === novoStatus) return res(200, { ok: true });
      if (!(TRANSICOES[statusAnt] || []).includes(novoStatus)) {
        return res(400, { error: `Não dá para mudar de "${statusAnt}" para "${novoStatus}".` });
      }

      const keyLock = `${atual.unidade}_${atual.data}`;
      const refLock = diasLock.doc(keyLock);

      const liberandoLock = ATIVOS.includes(statusAnt) && !ATIVOS.includes(novoStatus);
      const ativandoLock = !ATIVOS.includes(statusAnt) && ATIVOS.includes(novoStatus);

      if (ativandoLock) {
        const lockSnap = await refLock.get();
        if (lockSnap.exists && lockSnap.data().reserva_id !== id) {
          return res(409, { error: 'Este dia foi ocupado por outra reserva nesta unidade.' });
        }
      }

      const agoraIso = new Date(now()).toISOString();
      const audit = Array.isArray(atual.auditoria) ? [...atual.auditoria] : [];
      audit.push({ quando: agoraIso, quem: 'painel', de: statusAnt, para: novoStatus });

      let prazo_ate = atual.prazo_ate || null;
      if (novoStatus === 'aguardando_sinal') {
        prazo_ate = new Date(now() + cfg.prazo_horas * 3600000).toISOString();
      } else if (novoStatus === 'confirmado' || novoStatus === 'concluido' || novoStatus === 'recusado' || novoStatus === 'cancelado') {
        prazo_ate = null;
      }

      const updateData = {
        status: novoStatus,
        prazo_ate,
        auditoria: audit,
        atualizado_em: agoraIso,
      };

      // "Sinal pago" no painel: já registra o sinal como pagamento recebido (a dona pode corrigir ou remover depois)
      if (novoStatus === 'confirmado' && ['pedido', 'aguardando_sinal'].includes(statusAnt) && !(Array.isArray(atual.pagamentos) && atual.pagamentos.length) && Number(atual.valor_sinal) > 0) {
        const pag = { id: aleatorio(8), valor: arred(atual.valor_sinal), forma: 'pix', data: agoraBr(now()).data, obs: 'Sinal', criado_em: agoraIso };
        updateData.pagamentos = [pag];
        updateData.valor_pago = pag.valor;
      }

      await refReserva.update(updateData);

      if (liberandoLock) {
        await refLock.delete();
      } else if (ativandoLock) {
        await refLock.set({ reserva_id: id, unidade: atual.unidade, data: atual.data, criado_em: agoraIso });
      }

      return res(200, { ok: true });
    }

    if (acao === 'excluir') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'Reserva inválida.' });
      const snapEx = await reservas.doc(id).get();
      if (!snapEx.exists) return res(200, { ok: true });
      const ex = snapEx.data();
      if (!['recusado', 'cancelado', 'expirado'].includes(ex.status)) return res(400, { error: 'Só dá para excluir pedido recusado, cancelado ou vencido. Recuse ou cancele antes.' });
      const lockEx = await diasLock.doc(`${ex.unidade}_${ex.data}`).get();
      if (lockEx.exists && lockEx.data().reserva_id === id) await lockEx.ref.delete();
      await reservas.doc(id).delete();
      return res(200, { ok: true });
    }

    if (acao === 'push-chave') {
      try { return res(200, { chave: (await getPush().chavesVapid(db)).publica }); } catch { return res(503, { error: 'Avisos indisponíveis agora.' }); }
    }

    if (acao === 'push-assinar') {
      const sub = body.assinatura && typeof body.assinatura === 'object' ? body.assinatura : {};
      const k = sub.keys || {};
      const endpoint = str(sub.endpoint, 600);
      if (!/^https:\/\//.test(endpoint) || !str(k.p256dh, 200) || !str(k.auth, 100)) return res(400, { error: 'Assinatura de aviso inválida.' });
      await conta.collection('push').doc(await sha256(endpoint)).set({ endpoint, p256dh: str(k.p256dh, 200), auth: str(k.auth, 100), criado_em: new Date(now()).toISOString() });
      return res(200, { ok: true });
    }

    if (acao === 'push-testar') {
      const n = await avisarPainel('Aviso de teste', 'Pronto! Você vai receber um aviso assim a cada reserva nova.');
      return res(200, { ok: true, enviados: n });
    }

    if (acao === 'editar') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'Reserva inválida.' });
      const campos = body.campos && typeof body.campos === 'object' ? body.campos : {};

      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Reserva não encontrada.' });

      const permitidos = ['nome', 'whatsapp', 'email', 'tipo_evento', 'convidados', 'obs', 'valor_total', 'valor_sinal'];
      const updateData = { atualizado_em: new Date(now()).toISOString() };

      for (const k of permitidos) {
        if (campos[k] !== undefined) {
          if (k === 'convidados' || k === 'valor_total' || k === 'valor_sinal') {
            updateData[k] = Math.max(0, Number(campos[k]) || 0);
          } else {
            updateData[k] = str(campos[k], k === 'obs' ? 500 : 120);
          }
        }
      }

      if (Array.isArray(campos.extras)) {
        updateData.extras = campos.extras.slice(0, 20)
          .map(x => ({ id: str(x && x.id, 40), nome: str(x && x.nome, 80), valor: Math.max(0, Number(x && x.valor) || 0) }))
          .filter(x => x.nome);
      }

      await refReserva.update(updateData);
      return res(200, { ok: true });
    }

    if (acao === 'importar') {
      const loteId = str(body.lote_id, 40) || ('LOTE-' + aleatorio(4).toUpperCase());
      const linhas = Array.isArray(body.linhas) ? body.linhas : [];

      if (linhas.length === 0) {
        return res(400, { error: 'Nenhuma linha enviada para importação.' });
      }
      if (linhas.length > 2000) {
        return res(400, { error: 'O limite de importação é de 2000 linhas por arquivo.' });
      }

      const hoje = agoraBr(now()).data;
      const agoraIso = new Date(now()).toISOString();

      let importadas = 0;
      let puladas = 0;
      const detalheLinhas = [];
      const chavesLote = new Set();

      for (let i = 0; i < linhas.length; i++) {
        const item = linhas[i] || {};
        const data = str(item.data, 10);
        const unidadeId = str(item.unidade, 40);

        const unidadeValida = cfg.unidades.find(u => u.id === unidadeId);

        if (!dataValida(data)) {
          puladas++;
          detalheLinhas.push({ linha: i + 1, ok: false, motivo: 'Data inválida ou ausente' });
          continue;
        }
        if (!unidadeValida) {
          puladas++;
          detalheLinhas.push({ linha: i + 1, ok: false, motivo: 'Unidade desconhecida' });
          continue;
        }

        const lockKey = `${unidadeId}_${data}`;

        if (chavesLote.has(lockKey)) {
          puladas++;
          detalheLinhas.push({ linha: i + 1, ok: false, motivo: 'Dia/unidade duplicados na mesma importação' });
          continue;
        }

        const refLock = diasLock.doc(lockKey);
        const lockSnap = await refLock.get();
        if (lockSnap.exists) {
          puladas++;
          detalheLinhas.push({ linha: i + 1, ok: false, motivo: 'Dia já reservado ou bloqueado no sistema' });
          continue;
        }

        let status = str(item.situacao || item.status, 30);
        if (!['confirmado', 'aguardando_sinal', 'concluido'].includes(status)) {
          status = 'confirmado';
        }
        if (data < hoje) {
          status = 'concluido';
        }

        chavesLote.add(lockKey);

        const refReserva = reservas.doc();
        const protocolo = 'SPL-IMP' + aleatorio(3).toUpperCase();
        const nomeCliente = str(item.cliente || item.nome, 80) || 'Cliente Importado';
        const zap = digits(item.whatsapp).slice(0, 13);
        const tipoEvento = str(item.tipo_evento, 60) || 'Outro';
        const obs = str(item.observacoes || item.obs, 500);
        const valorSinal = Math.max(0, Number(item.valor_sinal) || 0);
        const valorTotalImp = Math.max(0, Math.min(10000000, arred(item.valor_total)));
        const convImp = Math.max(0, Math.min(5000, Math.round(Number(item.convidados) || 0)));
        // Já pago: o que a planilha informar; senão, reserva confirmada/concluída conta o sinal como recebido.
        const pagoInformado = Math.max(0, arred(item.valor_pago));
        const pagoImp = pagoInformado > 0 ? pagoInformado : (['confirmado', 'concluido'].includes(status) ? valorSinal : 0);
        const pagamentosImp = pagoImp > 0 ? [{ id: aleatorio(8), valor: pagoImp, forma: 'outro', data: dataValida(data) && data < hoje ? data : hoje, obs: 'Importado da planilha', criado_em: agoraIso }] : [];

        const itemReserva = {
          id: refReserva.id,
          protocolo,
          unidade: unidadeId,
          unidade_nome: unidadeValida.nome,
          data,
          status,
          nome: nomeCliente,
          whatsapp: zap,
          tipo_evento: tipoEvento,
          valor_sinal: valorSinal,
          ...(valorTotalImp > 0 ? { valor_total: valorTotalImp } : {}),
          ...(convImp > 0 ? { convidados: convImp } : {}),
          ...(pagamentosImp.length ? { pagamentos: pagamentosImp, valor_pago: pagoImp } : {}),
          obs,
          origem: 'importacao',
          lote_id: loteId,
          criado_em: agoraIso,
          atualizado_em: agoraIso,
          auditoria: [{ quando: agoraIso, quem: 'importacao', de: null, para: status }],
        };

        const batch = db.batch();
        batch.set(refReserva, itemReserva);
        batch.create(refLock, { reserva_id: refReserva.id, unidade: unidadeId, data, lote_id: loteId, criado_em: agoraIso });

        try {
          await batch.commit();
          importadas++;
          detalheLinhas.push({ linha: i + 1, ok: true, id: refReserva.id, protocolo, data, unidade: unidadeId });
        } catch {
          puladas++;
          detalheLinhas.push({ linha: i + 1, ok: false, motivo: 'Conflito ao gravar no servidor' });
        }
      }

      return res(200, {
        ok: true,
        lote_id: loteId,
        importadas,
        puladas,
        total: linhas.length,
        detalhes: detalheLinhas,
      });
    }

    if (acao === 'desfazer-importacao') {
      const loteId = str(body.lote_id, 40);
      if (!loteId) return res(400, { error: 'Informe o lote_id para desfazer.' });

      const snap = await reservas.where('lote_id', '==', loteId).get();
      const itensLote = snap.docs.map(d => ({ id: d.id, ...d.data() }));

      if (itensLote.length === 0) {
        return res(404, { error: 'Nenhuma reserva encontrada para este lote.' });
      }

      let desfeitas = 0;
      let alteradas = 0;

      for (const item of itensLote) {
        const audit = Array.isArray(item.auditoria) ? item.auditoria : [];
        const foiAlterado = audit.length > 1;

        if (foiAlterado) {
          alteradas++;
          continue;
        }

        const lockKey = `${item.unidade}_${item.data}`;
        await reservas.doc(item.id).delete();
        await diasLock.doc(lockKey).delete();
        desfeitas++;
      }

      return res(200, {
        ok: true,
        lote_id: loteId,
        desfeitas,
        alteradas,
        mensagem: alteradas > 0
          ? `${desfeitas} reserva(s) desfeita(s). ${alteradas} reserva(s) não puderam ser desfeitas por terem sido alteradas após a importação.`
          : `${desfeitas} reserva(s) desfeita(s) com sucesso.`
      });
    }

    if (acao === 'bloquear') {
      const unidadeId = str(body.unidade, 40);
      const unidade = cfg.unidades.find(u => u.id === unidadeId);
      if (!unidade) return res(400, { error: 'Escolha uma unidade válida.' });

      const de = str(body.de || body.data, 10);
      const ate = str(body.ate || body.data, 10);
      if (!dataValida(de) || !dataValida(ate) || ate < de) return res(400, { error: 'Período de bloqueio inválido.' });

      const motivo = str(body.motivo, 120) || 'Bloqueio administrativo';
      const agoraIso = new Date(now()).toISOString();

      const datasBloqueadas = [];
      let d = de;
      while (d <= ate) {
        datasBloqueadas.push(d);
        d = somaDias(d, 1);
      }

      const criados = [];
      for (const diaStr of datasBloqueadas) {
        const keyLock = `${unidadeId}_${diaStr}`;
        const refLock = diasLock.doc(keyLock);

        const refReserva = reservas.doc();
        const itemBloqueio = {
          id: refReserva.id,
          protocolo: 'BLK-' + aleatorio(3).toUpperCase(),
          unidade: unidadeId,
          unidade_nome: unidade.nome,
          data: diaStr,
          status: 'bloqueado',
          nome: motivo,
          whatsapp: '',
          obs: motivo,
          criado_em: agoraIso,
          atualizado_em: agoraIso,
          auditoria: [{ quando: agoraIso, quem: 'painel', de: null, para: 'bloqueado' }],
        };

        const lote = db.batch();
        lote.set(refReserva, itemBloqueio);
        lote.create(refLock, { reserva_id: refReserva.id, unidade: unidadeId, data: diaStr, criado_em: agoraIso });

        try {
          await lote.commit();
          criados.push(refReserva.id);
        } catch {
          // Se falhou trava, pula dia já travado
        }
      }

      return res(201, { ok: true, bloqueios: criados.length });
    }

    if (acao === 'desbloquear') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID inválido.' });

      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Bloqueio ou reserva não encontrada.' });

      const item = snap.data();
      const keyLock = `${item.unidade}_${item.data}`;

      await refReserva.delete();
      await diasLock.doc(keyLock).delete();

      return res(200, { ok: true });
    }

    if (acao === 'pagamento-registrar') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de reserva inválido.' });
      const valor = arred(body.valor);
      if (!(valor > 0) || valor > 1000000) return res(400, { error: 'Informe um valor maior que zero.' });
      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Reserva não encontrada.' });
      const item = snap.data();
      if (item.status === 'bloqueado') return res(400, { error: 'Dia bloqueado não recebe pagamento.' });
      const pagamentos = Array.isArray(item.pagamentos) ? [...item.pagamentos] : [];
      if (pagamentos.length >= 30) return res(400, { error: 'Limite de pagamentos nesta reserva atingido.' });
      const agoraIso = new Date(now()).toISOString();
      const pag = {
        id: aleatorio(8), valor,
        forma: FORMAS_PAGAMENTO.includes(body.forma) ? body.forma : 'pix',
        data: dataValida(str(body.data, 10)) ? body.data : agoraBr(now()).data,
        obs: str(body.obs, 120), criado_em: agoraIso,
      };
      pagamentos.push(pag);
      const valor_pago = somaPagamentos({ pagamentos });
      await refReserva.update({ pagamentos, valor_pago, atualizado_em: agoraIso });
      return res(201, { ok: true, pagamento: pag, valor_pago });
    }

    if (acao === 'pagamento-remover') {
      const id = str(body.id, 64), pid = str(body.pagamento_id, 40);
      if (!ID_RE.test(id) || !ID_RE.test(pid)) return res(400, { error: 'Pagamento inválido.' });
      const refReserva = reservas.doc(id);
      const snap = await refReserva.get();
      if (!snap.exists) return res(404, { error: 'Reserva não encontrada.' });
      const antigos = Array.isArray(snap.data().pagamentos) ? snap.data().pagamentos : [];
      const pagamentos = antigos.filter(p => p.id !== pid);
      if (pagamentos.length === antigos.length) return res(404, { error: 'Pagamento não encontrado.' });
      const valor_pago = somaPagamentos({ pagamentos });
      await refReserva.update({ pagamentos, valor_pago, atualizado_em: new Date(now()).toISOString() });
      return res(200, { ok: true, valor_pago });
    }

    if (acao === 'despesa-salvar') {
      const valor = arred(body.valor);
      if (!(valor > 0) || valor > 10000000) return res(400, { error: 'Informe o valor da despesa.' });
      const data = str(body.data, 10);
      if (!dataValida(data)) return res(400, { error: 'Data da despesa inválida.' });
      const unidadeId = str(body.unidade, 40) || 'geral';
      if (unidadeId !== 'geral' && !cfg.unidades.some(u => u.id === unidadeId)) return res(400, { error: 'Unidade inválida.' });
      const descricao = str(body.descricao, 120);
      const categoria = str(body.categoria, 40) || 'Outros';
      const tipo = body.tipo === 'comissao' ? 'comissao' : 'despesa';
      if (tipo === 'comissao' && !cfg.unidades.some(u => u.id === unidadeId && u.terceiro)) return res(400, { error: 'Comissão só vale para a unidade de outro dono.' });
      const agoraIso = new Date(now()).toISOString();
      const despesas = conta.collection('despesas');
      let id = str(body.id, 64);
      if (id) {
        if (!ID_RE.test(id)) return res(400, { error: 'ID de despesa inválido.' });
        const ex = await despesas.doc(id).get();
        if (!ex.exists) return res(404, { error: 'Despesa não encontrada.' });
        await despesas.doc(id).update({ unidade: unidadeId, data, categoria, descricao, valor, tipo, atualizado_em: agoraIso });
      } else {
        id = aleatorio(12);
        await despesas.doc(id).set({ id, unidade: unidadeId, data, categoria, descricao, valor, tipo, criado_em: agoraIso, atualizado_em: agoraIso });
      }
      return res(200, { ok: true, id });
    }

    if (acao === 'despesa-excluir') {
      const id = str(body.id, 64);
      if (!ID_RE.test(id)) return res(400, { error: 'ID de despesa inválido.' });
      const ref = conta.collection('despesas').doc(id);
      if (!(await ref.get()).exists) return res(404, { error: 'Despesa não encontrada.' });
      await ref.delete();
      return res(200, { ok: true });
    }

    if (acao === 'despesa-listar') {
      const hoje = agoraBr(now()).data;
      const de = dataValida(str(body.de, 10)) ? body.de : hoje.slice(0, 8) + '01';
      const ate = dataValida(str(body.ate, 10)) && body.ate >= de ? body.ate : somaDias(de, 31);
      const snap = await conta.collection('despesas').get();
      let lista = snap.docs.map(d => ({ id: d.id, ...d.data() })).filter(d => emPeriodo(d.data, de, ate));
      const uF = str(body.unidade, 40);
      if (uF) lista = lista.filter(d => d.unidade === uF);
      lista.sort((a, b) => (b.data || '').localeCompare(a.data || ''));
      return res(200, { de, ate, despesas: lista, total: arred(lista.filter(d => d.tipo !== 'comissao').reduce((t, d) => t + (Number(d.valor) || 0), 0)) });
    }

    if (acao === 'financeiro') {
      const hoje = agoraBr(now()).data;
      const de = dataValida(str(body.de, 10)) ? body.de : hoje.slice(0, 8) + '01';
      let ate = dataValida(str(body.ate, 10)) && body.ate >= de ? body.ate : somaDias(de, 30);
      if (ate > somaDias(de, 800)) ate = somaDias(de, 800);
      const [rs, ds] = await Promise.all([reservas.get(), conta.collection('despesas').get()]);
      const out = resumoFinanceiro(rs.docs.map(d => ({ id: d.id, ...d.data() })), ds.docs.map(d => d.data()), cfg.unidades, de, ate);
      return res(200, out);
    }

    if (acao === 'clientes') {
      const rs = await reservas.get();
      const uCli = str(body.unidade, 40);
      let todas = rs.docs.map(d => ({ id: d.id, ...d.data() }));
      if (uCli) todas = todas.filter(r => r.unidade === uCli);
      return res(200, { unidade: uCli, fidelidade: cfg.fidelidade, clientes: resumoClientes(todas, cfg.fidelidade) });
    }

    if (acao === 'config') {
      const novo = body.config && typeof body.config === 'object' ? body.config : {};
      const salvar = {};
      const permitidos = ['nome', 'whatsapp', 'instagram', 'unidades', 'sinal', 'pix', 'extras', 'promocoes', 'avaliacoes', 'datas_especiais', 'fidelidade', 'cancelamento', 'contrato', 'musica', 'prazo_horas', 'antecedencia_dias', 'dias_a_frente', 'aviso', 'mensagem_pedido'];
      for (const k of permitidos) if (novo[k] !== undefined) salvar[k] = novo[k];

      const final = montarConfig(cadastro, { ...(dados.config || {}), ...salvar });
      await conta.set({ config: final }, { merge: true });
      return res(200, { ok: true, config: final });
    }

    if (acao === 'site-salvar') {
      const conteudo = limparConteudoLocacao(body.conteudo);
      if (JSON.stringify(conteudo).length > CONTEUDO_MAX_LOCACAO) {
        return res(413, { error: 'Conteúdo grande demais.' });
      }

      const agoraIso = new Date(now()).toISOString();
      const refAtual = conta.collection('site').doc('conteudo');
      const snapAtual = await refAtual.get();

      if (snapAtual.exists) {
        const antigo = snapAtual.data();
        const histId = aleatorio(12);
        await conta.collection('historico').doc(histId).set({
          ...antigo,
          salvo_em: agoraIso,
          historico_id: histId,
        });

        const histSnap = await conta.collection('historico').get();
        const versoes = histSnap.docs.map(d => ({ id: d.id, ...d.data() }));
        if (versoes.length > 10) {
          versoes.sort((a, b) => (a.salvo_em || '').localeCompare(b.salvo_em || ''));
          const excedente = versoes.slice(0, versoes.length - 10);
          for (const item of excedente) {
            await conta.collection('historico').doc(item.id).delete();
          }
        }
      }

      const novoConteudo = { ...conteudo, atualizado_em: agoraIso };
      await refAtual.set(novoConteudo);
      return res(200, { ok: true, conteudo: novoConteudo });
    }

    if (acao === 'site-historico') {
      const snap = await conta.collection('historico').get();
      const items = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          atualizado_em: data.atualizado_em || data.salvo_em || null,
          salvo_em: data.salvo_em || null,
        };
      });
      items.sort((a, b) => (b.salvo_em || '').localeCompare(a.salvo_em || ''));
      return res(200, { historico: items.slice(0, 10) });
    }

    if (acao === 'site-restaurar') {
      const id = str(body.id, 64);
      if (!id) return res(400, { error: 'ID da versão do histórico é obrigatório.' });

      const refHist = conta.collection('historico').doc(id);
      const snapHist = await refHist.get();
      if (!snapHist.exists) return res(404, { error: 'Versão do histórico não encontrada.' });

      const dadosHist = snapHist.data();
      const conteudoLimpo = limparConteudoLocacao(dadosHist);
      const agoraIso = new Date(now()).toISOString();
      const novoConteudo = { ...conteudoLimpo, atualizado_em: agoraIso };

      await conta.collection('site').doc('conteudo').set(novoConteudo);
      return res(200, { ok: true, conteudo: novoConteudo });
    }

    if (acao === 'site-desfazer') {
      await conta.collection('site').doc('conteudo').delete();
      return res(200, { ok: true });
    }

    if (acao === 'foto-enviar') {
      let rawDados = body.dados || '';
      let tipo = str(body.tipo, 20);
      if (typeof rawDados === 'string' && rawDados.startsWith('data:')) {
        const match = rawDados.match(/^data:(image\/[a-z]+);base64,(.*)$/);
        if (match) {
          if (!tipo) tipo = match[1];
          rawDados = match[2];
        } else if (rawDados.includes(',')) {
          rawDados = rawDados.split(',')[1];
        }
      }

      const { base64, bytes, error: errFoto } = lerFoto(rawDados, tipo);
      if (errFoto) return res(400, { error: errFoto });

      const snapTotal = await conta.collection('fotos').get();
      const todasFotos = snapTotal.docs.map(d => d.data()).filter(f => f.unidade !== 'comprovantes');
      if (todasFotos.length >= FOTOS_MAX_TOTAL) {
        return res(400, { error: 'Limite total de fotos atingido. Remova alguma foto antes de enviar outra.' });
      }

      const unidadeId = str(body.unidade, 40);
      if (unidadeId) {
        const fotosUnidade = todasFotos.filter(f => f.unidade === unidadeId);
        if (fotosUnidade.length >= FOTOS_MAX_POR_UNIDADE) {
          return res(400, { error: 'Limite de fotos atingido para esta unidade. Remova alguma foto antes de enviar outra.' });
        }
      }

      const id = aleatorio(12);
      const agoraIso = new Date(now()).toISOString();
      const novaFoto = {
        id,
        tipo,
        dados: base64,
        bytes,
        unidade: unidadeId,
        legenda: str(body.legenda, 200),
        ordem: Number(body.ordem) || 0,
        capa: Boolean(body.capa),
        criado_em: agoraIso,
        atualizado_em: agoraIso,
      };

      await conta.collection('fotos').doc(id).set(novaFoto);
      return res(201, { ok: true, id, foto: { id, tipo, unidade: unidadeId, url: `/api/locacao?site=${slug}&foto=${id}` } });
    }

    if (acao === 'foto-listar') {
      const snap = await conta.collection('fotos').get();
      let fotos = snap.docs.map(d => {
        const data = d.data();
        return {
          id: d.id,
          tipo: data.tipo,
          unidade: data.unidade || '',
          legenda: data.legenda || '',
          ordem: Number(data.ordem) || 0,
          capa: Boolean(data.capa),
          url: `/api/locacao?site=${slug}&foto=${d.id}`,
          criado_em: data.criado_em || null,
        };
      });
      const uFiltro = str(body.unidade || q.unidade, 40);
      if (uFiltro) fotos = fotos.filter(f => f.unidade === uFiltro);
      fotos.sort((a, b) => (a.ordem - b.ordem) || (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { fotos });
    }

    if (acao === 'foto-editar') {
      const id = str(body.id, 64);
      if (!id || !FOTO_ID_RE.test(id)) return res(400, { error: 'ID de foto inválido.' });

      const refFoto = conta.collection('fotos').doc(id);
      const snap = await refFoto.get();
      if (!snap.exists) return res(404, { error: 'Foto não encontrada.' });

      const updateData = { atualizado_em: new Date(now()).toISOString() };
      if (body.legenda !== undefined) updateData.legenda = str(body.legenda, 200);
      if (body.ordem !== undefined) updateData.ordem = Number(body.ordem) || 0;
      if (body.capa !== undefined) updateData.capa = Boolean(body.capa);
      if (body.unidade !== undefined) updateData.unidade = str(body.unidade, 40);

      await refFoto.update(updateData);
      _fotos.delete(slug + '/' + id);
      return res(200, { ok: true });
    }

    if (acao === 'video-salvar') {
      const urlVideo = str(body.url, 500);
      const emb = gerarEmbedVideo(urlVideo);
      if (!emb.ok) return res(400, { error: emb.error });

      const id = aleatorio(12);
      const agoraIso = new Date(now()).toISOString();
      const itemVideo = {
        id,
        unidade: str(body.unidade, 40),
        titulo: str(body.titulo, 120),
        provedor: emb.provedor,
        embed_url: emb.embed_url,
        url_original: emb.url_original,
        criado_em: agoraIso,
        atualizado_em: agoraIso,
      };

      await conta.collection('videos').doc(id).set(itemVideo);
      return res(201, { ok: true, video: itemVideo });
    }

    if (acao === 'video-listar') {
      const snap = await conta.collection('videos').get();
      let videos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const uFiltro = str(body.unidade || q.unidade, 40);
      if (uFiltro) videos = videos.filter(v => v.unidade === uFiltro);
      videos.sort((a, b) => (b.criado_em || '').localeCompare(a.criado_em || ''));
      return res(200, { videos });
    }

    if (acao === 'video-remover') {
      const id = str(body.id, 64);
      if (!id) return res(400, { error: 'ID de vídeo inválido.' });

      const refVid = conta.collection('videos').doc(id);
      const snap = await refVid.get();
      if (!snap.exists) return res(404, { error: 'Vídeo não encontrado.' });

      await refVid.delete();
      return res(200, { ok: true });
    }

    if (acao === 'foto-remover') {
      const id = str(body.id, 64);
      if (!id || !FOTO_ID_RE.test(id)) return res(400, { error: 'ID de foto inválido.' });

      const refFoto = conta.collection('fotos').doc(id);
      const snap = await refFoto.get();
      if (!snap.exists) return res(404, { error: 'Foto não encontrada.' });

      await refFoto.delete();
      _fotos.delete(slug + '/' + id);
      return res(200, { ok: true });
    }

    return res(400, { error: 'Ação desconhecida.' });
  };
}

exports.handler = createHandler();
exports.createHandler = createHandler;
exports.montarConfig = montarConfig;
exports.hashSenha = hashSenha;
exports.agoraBr = agoraBr;
exports.COLLECTION = COLLECTION;
exports.limparConteudoLocacao = limparConteudoLocacao;
exports.resumoFinanceiro = resumoFinanceiro;
exports.resumoClientes = resumoClientes;
exports.gerarEmbedVideo = gerarEmbedVideo;
