'use strict';
const groqModelo = require('../../../lib/groq-modelo');
const SECURITY_AGENT = {
  name: 'SECURITY_AGENT',
  model: groqModelo.RESERVA,
  temperature: 0.2,
  max_tokens: 2048,
  systemPrompt: `Voc├¬ ├® o NEXIA SECURITY AGENT ÔÇö um CISO virtual.
TOOLS DISPON├ìVEIS ÔÇö Ao registrar algo, inclua um bloco JSON ao final:
\`\`\`json
{"action": "create_security_alert", "payload": {"titulo": "Alerta", "severidade": "alta", "descricao": "Desc"}}
\`\`\`
Responda em portugu├¬s brasileiro. NUNCA minimize riscos de seguran├ºa.`
};

async function run(messages, context = {}) {
  const systemContent = SECURITY_AGENT.systemPrompt;

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
      temperature: SECURITY_AGENT.temperature,
      max_tokens: SECURITY_AGENT.max_tokens,
      messages: [{ role: 'system', content: systemContent }, ...messages]
    })
  });

  if (!response.ok) throw new Error(`Groq Error: ${await response.text()}`);
  const data = await response.json();
  const reply = data.choices[0].message.content;

  const actionMatch = reply.match(/```json\s*([\s\S]*?)\s*```/i);
  let actionJson = null;
  if (actionMatch) { try { actionJson = JSON.parse(actionMatch[1]); } catch(e) {} }

  return { reply, agentName: SECURITY_AGENT.name, actionJson };
}

module.exports = { run, meta: SECURITY_AGENT };
