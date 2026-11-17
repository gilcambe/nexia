'use strict';
const groqModelo = require('../../../lib/groq-modelo');
const DEV_AGENT = {
  name: 'DEV_AGENT',
  model: groqModelo.RESERVA,
  temperature: 0.4,
  max_tokens: 2048,
  systemPrompt: `Voc├¬ ├® o NEXIA DEV AGENT ÔÇö um Principal Engineer.
TOOLS DISPON├ìVEIS ÔÇö Ao criar algo, inclua um bloco JSON ao final:
\`\`\`json
{"action": "create_task", "payload": {"titulo": "T├¡tulo", "descricao": "Desc", "responsavel": "dev-team", "prioridade": "alta"}}
\`\`\`
Responda sempre em portugu├¬s. Seja preciso e foque em seguran├ºa, performance e arquitetura.`
};

async function run(messages, context = {}) {
  const systemContent = DEV_AGENT.systemPrompt;

  const { modeloGroq } = require('../../../lib/groq-modelo');
  const modelo = await modeloGroq(process.env.GROQ_API_KEY);

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: modelo,
      temperature: DEV_AGENT.temperature,
      max_tokens: DEV_AGENT.max_tokens,
      messages: [{ role: 'system', content: systemContent }, ...messages]
    })
  });

  if (!response.ok) throw new Error(`Groq Error: ${await response.text()}`);
  const data = await response.json();
  const reply = data.choices[0].message.content;

  const actionMatch = reply.match(/```json\s*([\s\S]*?)\s*```/i);
  let actionJson = null;
  if (actionMatch) { try { actionJson = JSON.parse(actionMatch[1]); } catch(e) {} }

  return { reply, agentName: DEV_AGENT.name, actionJson };
}

module.exports = { run, meta: DEV_AGENT };
