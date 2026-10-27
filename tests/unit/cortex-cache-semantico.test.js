// tests/unit/cortex-cache-semantico.test.js
// Testes unitários para lib/cortex-cache-semantico.js
// Roda com: npm test (node --test)

import { strict as assert } from "node:assert";
import * as cache from "../../lib/cortex-cache-semantico.js";

// -----------------------------
// similaridadeCosseno
// -----------------------------

function vetorUnitario(x, y) {
  const n = Math.sqrt(x * x + y * y);
  return [x / n, y / n];
}

// Vetores idênticos -> similaridade 1
assert.strictEqual(
  cache.similaridadeCosseno([1, 2, 3], [1, 2, 3]),
  1,
  "vetores iguais devem ter similaridade 1"
);

// Vetores opostos -> similaridade -1
assert.strictEqual(
  cache.similaridadeCosseno([1, 0], [-1, 0]),
  -1,
  "vetores opostos devem ter similaridade -1"
);

// Vetores ortogonais -> similaridade 0
assert.strictEqual(
  cache.similaridadeCosseno([1, 0], [0, 1]),
  0,
  "vetores ortogonais devem ter similaridade 0"
);

// Tamanhos diferentes -> 0
assert.strictEqual(
  cache.similaridadeCosseno([1, 2], [1, 2, 3]),
  0,
  "vetores de tamanho diferente devem retornar 0"
);

// Vetor nulo -> 0
assert.strictEqual(cache.similaridadeCosseno([0, 0], [1, 2]), 0);
assert.strictEqual(cache.similaridadeCosseno(null, [1, 2]), 0);
assert.strictEqual(cache.similaridadeCosseno([1, 2], undefined), 0);

// Perguntas parecidas: 'como emagrecer rapido' vs 'qual o jeito mais rapido de perder peso'
// Vetores bem próximos na mesma direção -> similaridade >= 0.92
const v1 = vetorUnitario(10, 1);
const v2 = vetorUnitario(10.1, 1.1);
assert.ok(
  cache.similaridadeCosseno(v1, v2) >= 0.92,
  "perguntas parecidas devem ter similaridade >= 0.92"
);

// Perguntas diferentes: 'emagrecer' vs 'ganhar massa'
// Vetores em direções opostas -> similaridade negativa, rejeitada
const v3 = vetorUnitario(1, 0);
const v4 = vetorUnitario(-1, 0);
assert.ok(
  cache.similaridadeCosseno(v3, v4) < 0.92,
  "perguntas diferentes devem ter similaridade < 0.92"
);

// -----------------------------
// ehPerguntaGeral
// -----------------------------

assert.ok(cache.ehPerguntaGeral({ pergunta: "como emagrecer rapido" }));
assert.ok(!cache.ehPerguntaGeral({})); // sem pergunta
assert.ok(!cache.ehPerguntaGeral({ pergunta: "x", historico: [{ q: "a" }] })); // tem historico
assert.ok(!cache.ehPerguntaGeral({ pergunta: "x", dadoPessoal: true }));
assert.ok(!cache.ehPerguntaGeral({ pergunta: "x", anexo: true }));
assert.ok(!cache.ehPerguntaGeral({ pergunta: "x", ferramenta: true }));
assert.ok(!cache.ehPerguntaGeral(null));
assert.ok(!cache.ehPerguntaGeral(undefined));

// -----------------------------
// gerarVetor com ENABLED desligado
// -----------------------------

process.env.CORTEX_CACHE_SEMANTICO = "0";
const moduloDesligado = await import("../../lib/cortex-cache-semantico.js");
assert.strictEqual(await moduloDesligado.gerarVetor("qualquer texto"), null);

// -----------------------------
// gerarVetor com fetch mockado (sucesso)
// -----------------------------

process.env.CORTEX_CACHE_SEMANTICO = "1";
process.env.CLOUDFLARE_AI_TOKEN = "token-teste";
process.env.CLOUDFLARE_AI_ACCOUNT_ID = "conta-teste";

const vetorEsperado = [0.1, 0.2, 0.3];
const fetchOriginal = globalThis.fetch;
globalThis.fetch = async (url, opts) => {
  assert.ok(url.includes("@cf/baai/bge-m3"), "deve chamar a Workers AI bge-m3");
  assert.ok(opts.headers.Authorization.includes("Bearer token-teste"));
  return {
    ok: true,
    json: async () => ({ result: { data: vetorEsperado } })
  };
};

const vetor = await cache.gerarVetor("como emagrecer rapido");
assert.deepStrictEqual(vetor, vetorEsperado, "gerarVetor deve retornar o vetor da API");

globalThis.fetch = fetchOriginal;

// gerarVetor com erro silencioso (fetch falha)
globalThis.fetch = async () => {
  throw new Error("falha de rede");
};
const vetorFalha = await cache.gerarVetor("texto qualquer");
assert.strictEqual(vetorFalha, null, "erro de rede deve retornar null silenciosamente");
globalThis.fetch = fetchOriginal;

// gerarVetor com resposta não-ok
globalThis.fetch = async () => ({ ok: false, json: async () => ({}) });
const vetorNaoOk = await cache.gerarVetor("texto qualquer");
assert.strictEqual(vetorNaoOk, null, "resposta não-ok deve retornar null");
globalThis.fetch = fetchOriginal;

// gerarVetor com texto muito longo
globalThis.fetch = fetchOriginal;
const vetorLongo = await cache.gerarVetor("x".repeat(5000));
assert.strictEqual(vetorLongo, null, "texto acima de 4000 chars deve retornar null");

// -----------------------------
// buscarCache / gravarCache com env (memória + D1 + Vectorize mockados)
// -----------------------------

const contextoValido = {
  tenantId: "tenant-a",
  pergunta: "como emagrecer rapido",
  historico: [],
  dadoPessoal: false,
  anexo: false,
  ferramenta: false
};

const contextoComHistorico = {
  tenantId: "tenant-a",
  pergunta: "qualquer coisa",
  historico: [{ q: "antiga" }],
  dadoPessoal: false,
  anexo: false,
  ferramenta: false
};

// Tenants isolados: grava no tenant-a, não deve aparecer no tenant-b
const envA = {
  DB: null,
  VECTORIZE: null
};
const envB = {
  DB: null,
  VECTORIZE: null
};

// Mock de gerarVetor para testes de busca/gravação em memória
const vetorA = [1, 0, 0];
const vetorB = [0.9, 0.1, 0]; // próximo de A -> similaridade alta
const vetorC = [-1, 0, 0]; // oposto de A -> similaridade baixa

let gerarVetorChamadoCom;
cache.gerarVetor = async (texto) => {
  gerarVetorChamadoCom = texto;
  if (texto === "como emagrecer rapido") return vetorA;
  if (texto === "qual o jeito mais rapido de perder peso") return vetorB;
  if (texto === "ganhar massa") return vetorC;
  return [0, 0, 0];
};

// Limpa memória entre testes
cache.cacheMemoria = {};

// Grava no tenant-a
const gravado = await cache.gravarCache(contextoValido, "resposta: coma menos e se mova mais", envA);
assert.strictEqual(gravado, true, "gravarCache deve retornar true com sucesso");

// Não grava se não for pergunta geral
const naoGravado = await cache.gravarCache(contextoComHistorico, "resposta", envA);
assert.strictEqual(naoGravado, false, "não deve gravar quando há histórico");

// Busca pergunta parecida no mesmo tenant -> deve achar
const achado = await cache.buscarCache({
  ...contextoValido,
  pergunta: "qual o jeito mais rapido de perder peso"
}, envA);
assert.ok(achado, "deve encontrar cache para pergunta parecida");
assert.strictEqual(achado.resposta, "resposta: coma menos e se mova mais");
assert.ok(achado.similaridade >= 0.92, "similaridade da busca deve ser >= 0.92");

// Busca pergunta diferente no mesmo tenant -> não deve achar
const naoAchado = await cache.buscarCache({
  ...contextoValido,
  pergunta: "ganhar massa"
}, envA);
assert.strictEqual(naoAchado, null, "não deve encontrar cache para pergunta diferente");

// Tenant isolado: busca no tenant-b não encontra o gravado no tenant-a
const achadoOutroTenant = await cache.buscarCache({
  tenantId: "tenant-b",
  pergunta: "qual o jeito mais rapido de perder peso",
  historico: [],
  dadoPessoal: false,
  anexo: false,
  ferramenta: false
}, envB);
assert.strictEqual(achadoOutroTenant, null, "tenants diferentes devem ser isolados");

// -----------------------------
// TTL: item expirado não deve ser retornado
// -----------------------------

// Simula item com createdAt antigo (mais de 7 dias)
cache.cacheMemoria = {};
cache.cacheMemoria["tenant-a"] = [{
  pergunta: "como emagrecer rapido",
  vetor: vetorA,
  resposta: "resposta antiga",
  createdAt: Date.now() - 8 * 24 * 60 * 60 * 1000 // 8 dias atrás
}];

const expirado = await cache.buscarCache({
  ...contextoValido,
  pergunta: "qual o jeito mais rapido de perder peso"
}, envA);
assert.strictEqual(expirado, null, "item expirado (acima de 7 dias) não deve ser retornado");

// Restaura gerarVetor original
delete cache.gerarVetor;

console.log("Todos os testes de cache semântico passaram.");
