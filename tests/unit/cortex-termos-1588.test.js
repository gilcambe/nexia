import { describe, it } from "node:test";
import assert from "node:assert";
import fs from "node:fs";

describe("Cortex Termos e Privacidade (Issue #1588)", () => {
  it("deve conter as rotas /cortex/termos e /cortex/privacidade registradas no router", () => {
    const routerContent = fs.readFileSync("src/router/index.tsx", "utf-8");
    assert.ok(routerContent.includes('/cortex/termos'), "Rota /cortex/termos não encontrada no router");
    assert.ok(routerContent.includes('/cortex/privacidade'), "Rota /cortex/privacidade não encontrada no router");
  });

  it("deve conter as cláusulas exigidas em Termos de Uso (IAs de terceiros, uso aceitável, CDC 7 dias, contato)", () => {
    const termosContent = fs.readFileSync("src/pages/legais/termos/page.tsx", "utf-8");
    assert.ok(termosContent.includes("IAs de Terceiros") || termosContent.includes("OpenAI") || termosContent.includes("parceiros"), "Provedores de IA não mencionados");
    assert.ok(termosContent.includes("spam") && termosContent.includes("golpe"), "Regras de uso aceitável (spam, golpe) não encontradas");
    assert.ok(termosContent.includes("7 (sete) dias") || termosContent.includes("reembolso"), "Cláusula de reembolso em 7 dias (CDC) não encontrada");
    assert.ok(termosContent.includes("contato.nexia.os@gmail.com"), "E-mail de contato contato.nexia.os@gmail.com não encontrado em Termos");
  });

  it("deve conter as cláusulas exigidas em Política de Privacidade (coleta, LGPD, exclusão de conta, contato)", () => {
    const privContent = fs.readFileSync("src/pages/legais/privacidade/page.tsx", "utf-8");
    assert.ok(privContent.includes("O que é Coletado") || privContent.includes("Dados de Cadastro"), "Seção de dados coletados não encontrada");
    assert.ok(privContent.includes("LGPD"), "Menção à LGPD não encontrada");
    assert.ok(privContent.includes("exclusão") || privContent.includes("apagar"), "Informação sobre exclusão de conta não encontrada");
    assert.ok(privContent.includes("contato.nexia.os@gmail.com"), "E-mail de contato contato.nexia.os@gmail.com não encontrado em Privacidade");
  });

  it("deve incluir validação e checkbox de aceite dos termos na tela de cadastro e salvamento no AuthContext", () => {
    const loginPageContent = fs.readFileSync("src/pages/login/page.tsx", "utf-8");
    assert.ok(loginPageContent.includes("termsAccepted"), "Estado de aceite de termos não encontrado no cadastro");
    assert.ok(loginPageContent.includes("/cortex/termos") && loginPageContent.includes("/cortex/privacidade"), "Links para /cortex/termos e /cortex/privacidade ausentes no cadastro");

    const authContextContent = fs.readFileSync("src/contexts/AuthContext.tsx", "utf-8");
    assert.ok(authContextContent.includes("termsAcceptedAt"), "Gravação de termsAcceptedAt ausente em AuthContext");
  });
});
