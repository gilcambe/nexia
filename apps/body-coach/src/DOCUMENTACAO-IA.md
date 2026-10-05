# Conectar IA real (OpenAI / Anthropic)

Este documento explica como transformar o **Coach** (e a interpretação de exames) de
"respostas por regras" para um assistente **de verdade**, com inteligência de linguagem.

> Hoje o Coach responde por regras pré-definidas (carga, fadiga, dor, nutrição).
> Com uma IA conectada, ele passa a **conversar livremente** sobre qualquer coisa:
> técnica, recuperação, dúvidas de treino, e a interpretar exames com raciocínio clínico.

---

## Arquitetura (resumo)

```
Frontend (React)
   └─> fetch('/api/coach-ai', { method: 'POST', body: { mensagem, contexto } })
         └─> Worker do Cloudflare (servidor, plano grátis)
               └─> lê OPENAI_API_KEY (ou ANTHROPIC_API_KEY) dos segredos do Worker
                     └─> chama a API da OpenAI/Anthropic
                           └─> retorna a resposta pro frontend
```

A chave **nunca** vai pro navegador. Ela fica guardada nos **segredos do Worker do Cloudflare**
(`npx wrangler secret put NOME`), e só é lida dentro da função do servidor (via `env`).

---

## Passo a passo para conectar

### 1. Conectar a chave (feito de forma segura, sem colar no chat)

Use o recurso de chaves seguras da plataforma para solicitar a chave. A chave deve ser
registrada como **secret do backend** (não pública), por exemplo:

- `OPENAI_API_KEY`  → chave da OpenAI (sk-...)
- ou `ANTHROPIC_API_KEY` → chave da Anthropic (sk-ant-...)

A chave é guardada direto nos segredos do repositório/Worker — você nunca precisa colar no chat.

### 2. Criar a função no Worker

Criar uma função chamada `coach-ai` que:

1. Recebe `{ mensagem, contexto }` (o contexto inclui dados do atleta: peso, gordura, recuperação, treino do dia).
2. Monta um `system prompt` que define a persona do Coach (equipe de alta performance, foco em segurança, sem diagnóstico médico).
3. Chama a API da OpenAI (ou Anthropic) com a chave do secret.
4. Retorna `{ resposta }`.

Exemplo (OpenAI, dentro da função do Worker):

```ts
const SYSTEM_PROMPT = `Você é o Coach NEXIA, parte de uma equipe de alta performance.
Responda de forma objetiva e motivadora, em português.
Regras: nunca dê diagnóstico médico; sempre sugira procurar um profissional quando
o assunto for saúde/lesão; priorize a segurança do atleta.`;

export async function coachAi(req: Request, env: Record<string, string>) {
  const { mensagem, contexto } = await req.json();
  const key = env.OPENAI_API_KEY;
  if (!key) return new Response(JSON.stringify({ erro: 'IA não configurada' }), { status: 500 });

  const resp = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `Contexto do atleta: ${JSON.stringify(contexto)}\n\nMensagem: ${mensagem}` },
      ],
      temperature: 0.7,
    }),
  });

  const data = await resp.json();
  const resposta = data.choices?.[0]?.message?.content ?? 'Não consegui responder agora.';
  return new Response(JSON.stringify({ resposta }), {
    headers: { 'Content-Type': 'application/json' },
  });
}
```

> Para Anthropic, troque a URL por `https://api.anthropic.com/v1/messages`,
> o header por `x-api-key`, e o formato do body pelo padrão da Anthropic.

### 3. Chamar do frontend (no CoachContext)

Substituir a lógica de `send()` (hoje por regras) por:

```ts
const r = await fetch('/api/coach-ai', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ mensagem: texto, contexto: { peso, gordura, fadiga, treino } }),
}).catch(() => null);
const data = r && r.ok ? await r.json() : null;
const resposta = data?.resposta ?? fallbackPorRegras(texto);
```

Manter o `fallbackPorRegras` para quando a IA estiver desligada ou sem conexão.

### 4. Interpretação de exames com IA

O mesmo padrão: criar `interpretar-exames` (ou reutilizar `coach-ai`) que recebe os
marcadores de sangue (`vitamina_d`, `ferritina`, `testosterona`, etc.) e retorna uma
interpretação com sugestões de vitaminas, peptídeos e suplementos — sempre com o aviso
de "não é diagnóstico médico".

---

## O que muda no app

| Recurso | Hoje (regras) | Com IA |
|---|---|---|
| Coach | Respostas fixas por palavra-chave | Conversa livre e contextual |
| Interpretação de exames | Faixas fixas de referência | Raciocínio clínico + correlações |
| Relatórios | — | Resumo narrativo gerado por IA |
| Equipe de especialistas | Ativação manual | Cada "especialista" responde na sua área |

---

## Observações importantes

- A chave fica **só no backend** — nunca exponha no frontend.
- Se precisar de outra chave (ex.: Mapbox, etc.), use o mesmo fluxo de chaves seguras.
- Para produção, considere limites de custo/tokens e um cache de respostas frequentes.