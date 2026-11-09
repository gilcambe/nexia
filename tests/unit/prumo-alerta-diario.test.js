'use strict';
// Teste unitário para a rotina de alerta diário por e-mail de Kernex Finance
const test = require('node:test');
const assert = require('node:assert/strict');
const { listarDestinatarios, executarAlertaDiario } = require('../../scripts/kernex-finance-alerta-diario');

function bancoFalso() {
  const dados = new Map();
  const col = (c) => ({
    doc: (id) => ({
      collection: (n) => col(`${c}/${id}/${n}`),
      set: async (v) => { dados.set(`${c}/${id}`, JSON.parse(JSON.stringify(v))); },
      delete: async () => { dados.delete(`${c}/${id}`); },
      get: async () => {
        const v = dados.get(`${c}/${id}`);
        return { exists: !!v, data: () => v && JSON.parse(JSON.stringify(v)) };
      }
    }),
    get: async () => {
      const ids = new Set();
      for (const k of dados.keys()) {
        if (k.startsWith(c + '/')) {
          const rest = k.slice(c.length + 1);
          const seg = rest.split('/')[0];
          ids.add(seg);
        }
      }
      return {
        docs: [...ids].map((id) => ({
          id,
          data: () => dados.get(`${c}/${id}`) || {}
        }))
      };
    }
  });
  return { collection: col, dados };
}

test('AD1. listarDestinatarios seleciona apenas usuários com email ativo e configurado', async () => {
  const banco = bancoFalso();

  // Usuário 1: e-mail ativo e com email_para
  banco.dados.set('prumo_users/u1/config/alertas', {
    canais: { app: true, email: true },
    email_para: 'u1@exemplo.com'
  });

  // Usuário 2: e-mail desativado
  banco.dados.set('prumo_users/u2/config/alertas', {
    canais: { app: true, email: false },
    email_para: 'u2@exemplo.com'
  });

  // Usuário 3: e-mail ativo mas sem email_para
  banco.dados.set('prumo_users/u3/config/alertas', {
    canais: { app: true, email: true },
    email_para: null
  });

  // Usuário 4: sem config/alertas
  banco.dados.set('prumo_users/u4/outro/doc', {});

  const destinatarios = await listarDestinatarios(banco);
  assert.equal(destinatarios.length, 1);
  assert.equal(destinatarios[0].uid, 'u1');
  assert.equal(destinatarios[0].email, 'u1@exemplo.com');
});

test('AD2. executarAlertaDiario: sem segredo imprime "sem segredo, pulei"', async () => {
  const res = await executarAlertaDiario({ BREVO_API_KEY: '', EMAIL_API_KEY: '' });
  assert.equal(res.status, 'sem_segredo');
});

test('AD3. executarAlertaDiario: com segredo mas sem banco imprime "sem credencial do banco, pulei"', async () => {
  const antigo64 = process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  const antigoSa = process.env.FIREBASE_SERVICE_ACCOUNT;
  delete process.env.FIREBASE_SERVICE_ACCOUNT_BASE64;
  delete process.env.FIREBASE_SERVICE_ACCOUNT;
  try {
    const res = await executarAlertaDiario({ BREVO_API_KEY: 'test-key', db: null });
    assert.equal(res.status, 'sem_banco');
  } finally {
    if (antigo64) process.env.FIREBASE_SERVICE_ACCOUNT_BASE64 = antigo64;
    if (antigoSa) process.env.FIREBASE_SERVICE_ACCOUNT = antigoSa;
  }
});
