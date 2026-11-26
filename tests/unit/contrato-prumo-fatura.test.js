const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

// Importa o handler que processa o print da fatura
const { handleFaturaPrint } = require('../../netlify/functions/prumo');

// Fake DB que simula as coleções usadas pelo código
class FakeCollection {
  constructor() { this.items = []; }
  findOne(query) { return this.items.find(i => Object.entries(query).every(([k, v]) => i[k] === v)); }
  insertOne(doc) { this.items.push({ _id: this.items.length + 1, ...doc }); return { insertedId: this.items.length }; }
  updateOne(filter, update) {
    const doc = this.findOne(filter);
    if (doc) {
      Object.assign(doc, update.$set);
    }
    return { matchedCount: doc ? 1 : 0 };
  }
}

// Fake DB container
const fakeDb = {
  cards: new FakeCollection(),
  invoices: new FakeCollection(),
  dashboard: new FakeCollection()
};

// Helper to build a request object similar ao que o Netlify fornece
function fakeRequest(body) {
  return { method: 'POST', headers: { 'content-type': 'application/json' }, json: () => body };
}

// JSON de exemplo extraído dos prints do dono (já convertido pela IA)
const exemploPrint = {
  "cardName": "Itaú Uniclass Infini",
  "cardLast4": "18..",
  "invoice": {
    "month": "2023-12",
    "amount": 3020.13,
    "dueDate": "2023-12-06",
    "bestPurchaseDate": "2023-11-29",
    "summary": {
      "estornos": -62.48,
      "compras": 3130.38,
      "produtos": 0.00,
      "outros": -47.77
    },
    "history": [
      { "month": "2023-11", "amount": 3978.91, "status": "closed" },
      { "month": "2024-01", "amount": 603.87, "status": "future" },
      { "month": "2024-02", "amount": 139.77, "status": "future" }
    ]
  }
};

// Segunda fatura para teste de múltiplos cartões
const segundoPrint = {
  "cardName": "Itaú Uniclass Black",
  "cardLast4": "6651",
  "invoice": {
    "month": "2023-12",
    "amount": 609.15,
    "dueDate": "2023-12-10",
    "bestPurchaseDate": "2023-12-03",
    "summary": { "estornos": 0.00, "compras": 609.15, "produtos": 0.00 },
    "history": [
      { "month": "2023-10", "amount": 600.38, "status": "closed" },
      { "month": "2023-11", "amount": 95.27, "status": "closed" },
      { "month": "2024-01", "amount": 72.66, "status": "future" }
    ]
  }
};

describe('Processamento de print de fatura', async () => {
  test('Caso comum: grava fatura e reflete nas telas', async () => {
    // Configura o stub de dependência de DB no handler
    const ctx = { deps: { db: fakeDb } };
    const req = fakeRequest(exemploPrint);
    const res = await handleFaturaPrint(req, ctx);
    assert.equal(res.status, 200, 'Deve retornar 200 quando gravado');
    // Verifica cartão criado
    const card = fakeDb.cards.findOne({ name: 'Itaú Uniclass Infini', last4: '18..' });
    assert.ok(card, 'Cartão deve existir');
    // Verifica fatura aberta em A pagar
    const invoice = fakeDb.invoices.findOne({ cardId: card._id, month: '2023-12' });
    assert.ok(invoice, 'Fatura deve estar salva');
    assert.equal(invoice.amount, 3020.13);
    assert.equal(invoice.dueDate, '2023-12-06');
    // Verifica entrada na dashboard (Início)
    const dash = fakeDb.dashboard.findOne({ type: 'upcoming', referenceId: invoice._id });
    assert.ok(dash, 'Entrada deve aparecer no início');
    assert.equal(dash.amount, 3020.13);
  });

  test('Caso de borda: reenviar mesmo print não duplica', async () => {
    const ctx = { deps: { db: fakeDb } };
    const req = fakeRequest(exemploPrint);
    const res1 = await handleFaturaPrint(req, ctx);
    const res2 = await handleFaturaPrint(req, ctx);
    assert.equal(res2.status, 200);
    // O número de cartões deve permanecer 1
    const cards = fakeDb.cards.items.filter(c => c.name === 'Itaú Uniclass Infini');
    assert.equal(cards.length, 1, 'Não deve criar cartão duplicado');
    // O número de faturas para esse mês também deve ser 1
    const card = cards[0];
    const invoices = fakeDb.invoices.items.filter(i => i.cardId === card._id && i.month === '2023-12');
    assert.equal(invoices.length, 1, 'Não deve criar fatura duplicada');
  });

  test('Entrada inválida: retorna erro e não grava nada', async () => {
    const ctx = { deps: { db: fakeDb } };
    const req = fakeRequest({ invalid: true });
    const res = await handleFaturaPrint(req, ctx);
    assert.equal(res.status, 400, 'Deve retornar 400 para payload inválido');
    // Nenhum novo cartão ou fatura deve ser criado
    const totalCards = fakeDb.cards.items.length;
    const totalInvoices = fakeDb.invoices.items.length;
    assert.equal(totalCards, 1, 'Nenhum cartão adicional deve ser criado');
    assert.equal(totalInvoices, 1, 'Nenhuma fatura adicional deve ser criada');
  });
});
