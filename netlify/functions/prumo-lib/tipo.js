'use strict';
// Dono 19/11: "simplifique ao máximo... muitas abas e locais pra preencher". Um botão só no Início:
// a pessoa manda QUALQUER print/foto/PDF; aqui a IA só diz QUE documento é, e a tela manda para o leitor certo
// (que já existe em cada aba). Nada é gravado aqui.
const TIPO_DOC = `Você classifica UM documento financeiro brasileiro (print, foto ou PDF). Responda SÓ com JSON: {"tipo":"..."}.
Tipos: "holerite" (contracheque/demonstrativo de pagamento, inclusive adiantamento e 13º), "ponto" (folha/espelho/resumo de ponto com horas extras, noturno, sobreaviso), "fatura_cartao" (fatura ou tela do app do cartão de crédito), "extrato_banco" (extrato de conta, comprovante Pix, boleto, nota, conta de luz), "fgts" (app/extrato do FGTS), "inss" (extrato CNIS ou simulação de aposentadoria do INSS), "score" (Serasa, SPC, Boa Vista), "milhas" (programa de pontos/milhas), "divida" (contrato ou boleto de empréstimo/financiamento), "conta_saldo" (tela do app do banco só com saldo), "outro".`;
// tipo -> aba que lê e o modo do leitor daquela aba
const DESTINO = {
  holerite: { aba: 'orcamento', modo: 'holerite', nome: 'holerite' },
  ponto: { aba: 'orcamento', modo: 'ponto', nome: 'folha de ponto' },
  fatura_cartao: { aba: 'cartoes', modo: 'fatura', nome: 'fatura do cartão' },
  extrato_banco: { aba: 'documentos', modo: 'doc', nome: 'extrato ou comprovante' },
  fgts: { aba: 'aposentadoria', modo: 'fgts', nome: 'saldo do FGTS' },
  inss: { aba: 'aposentadoria', modo: 'cnis', nome: 'extrato do INSS' },
  score: { aba: 'inicio', modo: 'score', nome: 'score de crédito' },
  milhas: { aba: 'pontos', modo: 'milhas', nome: 'milhas e pontos' },
  divida: { aba: 'dividas', modo: 'divida', nome: 'dívida' },
  conta_saldo: { aba: 'contas', modo: 'conta', nome: 'saldo da conta' },
  outro: { aba: 'documentos', modo: 'doc', nome: 'documento' },
};

async function agirTipo(acao, body, c) {
  if (acao !== 'doc_tipo') return null;
  const im = c.lerImagens(body && body.imagens, { pdf: true });
  if (!im.ok) return [400, { error: im.erro }];
  const perguntar = c.deps.perguntarVisao || ((img, s) => require('./visao').perguntarVisao(c.deps, img, s));
  let tipo = 'outro';
  try {
    const t = await perguntar(im.imagens[0], TIPO_DOC);
    const j = t && c.extrairJson(t);
    if (j && DESTINO[j.tipo]) tipo = j.tipo;
  } catch { tipo = 'outro'; } // sem IA agora: vai para Documentos, que lê qualquer coisa
  return [200, { tipo, ...DESTINO[tipo] }];
}

module.exports = { agirTipo, DESTINO, TIPO_DOC };
