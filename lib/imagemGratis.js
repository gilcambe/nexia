'use strict';
// Imagem grátis com reserva (#licao 28): o mesmo FLUX.1-schnell em dois lugares grátis.
//  1) Workers AI (binding AI, 10 mil neurônios/dia, dividido com os clientes);
//  2) Hugging Face Spaces (sem chave; cota de GPU por IP que volta sozinha em minutos).
// Quando a cota do Workers AI acaba (erro 4006) ou o freio de 80% liga, passa para o Hugging Face.
// No dia seguinte o Workers AI volta a ser o primeiro sozinho: a ordem é fixa, não tem estado.
// Nada pago aqui, nunca (sem DALL-E/OpenAI).

const HF = 'https://black-forest-labs-flux-1-schnell.hf.space';

function base64ParaBytes(b64) {
  if (typeof Buffer !== 'undefined') return new Uint8Array(Buffer.from(b64, 'base64'));
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

async function workersAi(ai, prompt, o) {
  const r = await ai.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: o.steps || 8 });
  if (!r || !r.image) throw new Error('Workers AI sem imagem');
  return { bytes: base64ParaBytes(r.image), tipo: 'image/jpeg', fonte: 'Workers AI' };
}

async function huggingFace(prompt, o, f) {
  const corpo = { data: [prompt, o.seed ?? 0, o.seed == null, o.width || 768, o.height || 1024, o.steps || 6] };
  const r1 = await f(`${HF}/gradio_api/call/infer`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(corpo) });
  if (!r1.ok) throw new Error(`HF ${r1.status}`);
  const { event_id: id } = await r1.json();
  if (!id) throw new Error('HF sem event_id');
  const txt = await (await f(`${HF}/gradio_api/call/infer/${id}`)).text();
  const dados = txt.split('\n').filter((l) => l.startsWith('data: ')).map((l) => l.slice(6));
  if (!/event: complete/.test(txt) || !dados.length) throw new Error('HF sem cota de GPU agora');
  const url = JSON.parse(dados[dados.length - 1])?.[0]?.url;
  if (!url || !url.startsWith(`${HF}/`)) throw new Error('HF resposta estranha');
  const img = await f(url);
  if (!img.ok) throw new Error(`HF arquivo ${img.status}`);
  return { bytes: new Uint8Array(await img.arrayBuffer()), tipo: img.headers.get('content-type') || 'image/webp', fonte: 'Hugging Face' };
}

// o: { steps, width, height, seed, pularWorkersAi }. Devolve { bytes, tipo, fonte } ou lança com os motivos.
async function gerarImagem(ai, prompt, o = {}, f = fetch) {
  const motivos = [];
  if (ai && typeof ai.run === 'function' && !o.pularWorkersAi) {
    try { return await workersAi(ai, prompt, o); } catch (e) { motivos.push(`Workers AI: ${e && e.message}`); }
  }
  try { return await huggingFace(prompt, o, f); } catch (e) { motivos.push(`Hugging Face: ${e && e.message}`); }
  throw new Error(motivos.join(' | '));
}

module.exports = { gerarImagem, HF };
