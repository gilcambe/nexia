'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const AUTOMATION_TEMPLATES = [
  {
    id: "resumo_pedidos",
    name: "Resumo diário de pedidos às 9h",
    defaultTime: "09:00",
    defaultChannel: "WhatsApp",
    description: "Envia o consolidado das vendas e pedidos do dia anterior direto no canal escolhido.",
  },
  {
    id: "alerta_leads",
    name: "Alerta de novos leads no WhatsApp",
    defaultTime: "08:00",
    defaultChannel: "WhatsApp",
    description: "Notifica imediatamente quando um novo cliente/lead preenche o formulário.",
  },
  {
    id: "lembrete_cobranca",
    name: "Lembrete de cobrança pendente",
    defaultTime: "10:00",
    defaultChannel: "E-mail",
    description: "Dispara aviso automático para clientes com faturas ou pagamentos pendentes.",
  },
  {
    id: "relatorio_semanal",
    name: "Relatório semanal de desempenho",
    defaultTime: "18:00",
    defaultChannel: "Painel/Notificação",
    description: "Gera um balanço com métricas de desempenho e relatórios ao final da semana.",
  },
];

const CHANNELS = ["WhatsApp", "E-mail", "Painel/Notificação"];

function toggleAutomationStatus(item) {
  const active = !item.active;
  const status = active ? "ativa" : "pausada";
  return { ...item, active, status };
}

function createAutomationItem(payload) {
  const name = (payload.name || "").trim();
  if (!name) throw new Error("Nome da automação é obrigatório");
  return {
    id: payload.id || `aut-${Date.now()}`,
    name,
    template: payload.template || "custom",
    scheduleTime: payload.scheduleTime || "09:00",
    channel: payload.channel || "WhatsApp",
    active: payload.active !== undefined ? payload.active : true,
    status: payload.status || (payload.active === false ? "pausada" : "ativa"),
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}

test('AUTOMATIONS 1. Templates padrão de automação contêm opções em português com horário e canal', () => {
  assert.ok(Array.isArray(AUTOMATION_TEMPLATES));
  assert.ok(AUTOMATION_TEMPLATES.length >= 4);

  const t1 = AUTOMATION_TEMPLATES.find(t => t.id === 'resumo_pedidos');
  assert.ok(t1, 'Template resumo_pedidos deve existir');
  assert.equal(t1.name, 'Resumo diário de pedidos às 9h');
  assert.equal(t1.defaultTime, '09:00');
  assert.equal(t1.defaultChannel, 'WhatsApp');

  const t2 = AUTOMATION_TEMPLATES.find(t => t.id === 'alerta_leads');
  assert.ok(t2, 'Template alerta_leads deve existir');
  assert.equal(t2.defaultChannel, 'WhatsApp');

  const t3 = AUTOMATION_TEMPLATES.find(t => t.id === 'lembrete_cobranca');
  assert.ok(t3, 'Template lembrete_cobranca deve existir');
  assert.equal(t3.defaultChannel, 'E-mail');

  const t4 = AUTOMATION_TEMPLATES.find(t => t.id === 'relatorio_semanal');
  assert.ok(t4, 'Template relatorio_semanal deve existir');
  assert.equal(t4.defaultChannel, 'Painel/Notificação');
});

test('AUTOMATIONS 2. Formato e campos de cada template estão válidos', () => {
  assert.ok(Array.isArray(CHANNELS));
  assert.ok(CHANNELS.includes('WhatsApp'));
  assert.ok(CHANNELS.includes('E-mail'));

  for (const tmpl of AUTOMATION_TEMPLATES) {
    assert.ok(tmpl.id, 'id obrigatório');
    assert.ok(tmpl.name, 'name obrigatório');
    assert.ok(tmpl.defaultTime, 'defaultTime obrigatório');
    assert.ok(tmpl.defaultChannel, 'defaultChannel obrigatório');
    assert.ok(tmpl.description, 'description obrigatória');
    assert.match(tmpl.defaultTime, /^\d{2}:\d{2}$/, 'horário no formato HH:MM');
  }
});

test('AUTOMATIONS 3. Alternância de status (pausar/ativar) altera active e status', () => {
  const itemAtivo = { id: 'a1', name: 'Teste', active: true, status: 'ativa' };
  const alternado = toggleAutomationStatus(itemAtivo);
  assert.equal(alternado.active, false);
  assert.equal(alternado.status, 'pausada');

  const reativado = toggleAutomationStatus(alternado);
  assert.equal(reativado.active, true);
  assert.equal(reativado.status, 'ativa');
});

test('AUTOMATIONS 4. Criação de item valida nome e preenche atributos padrão', () => {
  assert.throws(() => createAutomationItem({ name: '   ' }), /Nome da automação é obrigatório/);

  const novo = createAutomationItem({
    name: 'Resumo diário de pedidos às 9h',
    scheduleTime: '09:00',
    channel: 'WhatsApp',
  });

  assert.ok(novo.id.startsWith('aut-'));
  assert.equal(novo.name, 'Resumo diário de pedidos às 9h');
  assert.equal(novo.active, true);
  assert.equal(novo.status, 'ativa');
  assert.equal(novo.scheduleTime, '09:00');
  assert.equal(novo.channel, 'WhatsApp');
});
