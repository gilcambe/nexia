'use strict';
/**
 * Kernex Finance, fase 6: Open Finance. SÓ a tela e a interface do provedor.
 * Nenhum provedor está ativo: todos os que funcionam são pagos (ver docs/kernex-finance-open-finance.md)
 * e contratar depende da palavra do dono. Nunca guardar senha bancária.
 */
const PROVEDOR_VAZIO = {
  nome: null,
  ativo: false,
  async conectar() { return { ok: false, motivo: 'Em breve. Por enquanto, mande foto, print ou PDF na aba Documentos.' }; },
  async desconectar() { return { ok: true }; },
  async sincronizar() { return { ok: false, motivo: 'Nenhum provedor de Open Finance ligado.' }; },
};
let provedor = PROVEDOR_VAZIO;
/** Para o futuro: um adaptador com { nome, ativo, conectar, desconectar, sincronizar }. Sem chave, fica o vazio. */
function usarProvedor(p) { provedor = p && typeof p.conectar === 'function' ? p : PROVEDOR_VAZIO; }

const ACOES = ['openfinance_status', 'openfinance_conectar', 'openfinance_desconectar'];
async function agirOpenFinance(acao, body, c) {
  if (!ACOES.includes(acao)) return null;
  const { base, listar } = c;
  const col = base.collection('conexoes');
  switch (acao) {
    case 'openfinance_status': {
      const conexoes = (await listar(col)).map((x) => ({ id: x.id, banco: x.banco, consentimento_ate: x.consentimento_ate || null, ultima_sync: x.ultima_sync || null }));
      return [200, { ativo: !!provedor.ativo, provedor: provedor.nome, conexoes, aviso: provedor.ativo ? '' : 'Em breve. Nenhum app pago foi contratado. Use a aba Documentos.' }];
    }
    case 'openfinance_conectar': {
      if (body && (body.senha || body.password)) return [400, { error: 'O Kernex Finance nunca pede nem guarda senha do banco.' }];
      const r = await provedor.conectar(body || {});
      return [r.ok ? 200 : 409, r.ok ? r : { error: r.motivo }];
    }
    case 'openfinance_desconectar': {
      const id = String((body && body.id) || '');
      if (!id) return [400, { error: 'Falta a conexão.' }];
      await provedor.desconectar({ id });
      await col.doc(id).delete();
      return [200, { ok: true }];
    }
  }
  return null;
}
module.exports = { agirOpenFinance, usarProvedor, PROVEDOR_VAZIO, ACOES };
