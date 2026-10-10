// Body Coach: fotos de corpo realista geradas com o Workers AI (plano grátis, binding AI).
// Só gera a partir de uma lista fechada (sexo, pele, biotipo, vista): ninguém manda texto livre.
// Usado uma vez para criar as imagens de public/imagens/corpos do Body Coach.
const SEXO = { m: 'man', f: 'woman' };
const ROUPA = { m: 'wearing only plain black athletic shorts, shirtless', f: 'wearing a plain black sports bra and plain black athletic shorts' };
const PELE = { clara: 'fair white skin', media: 'light olive tan skin, brazilian', morena: 'brown skin, latino', negra: 'dark black skin, african descent' };
const NIVEL = {
  magro: 'lean muscular athletic body with visible abs, low body fat',
  medio: 'average fit body, slightly soft belly, moderate body fat',
  alto: 'overweight body with a round belly and love handles, high body fat',
};
const VISTA = {
  frente: 'facing the camera, front view',
  lado: 'standing in strict side profile facing right, side view',
  costas: 'seen from behind, back view, facing away from the camera',
};
const CHAVE = /^(m|f)-(clara|media|morena|negra)-(magro|medio|alto)-(frente|lado|costas)$/;

export async function corpoIa(request, env) {
  const chave = new URL(request.url).searchParams.get('k') || '';
  const m = CHAVE.exec(chave);
  if (!m) return new Response('chave inválida', { status: 400 });
  if (!env.AI) return new Response('Workers AI indisponível', { status: 503 });
  const [, s, p, n, v] = m;
  const prompt = `Ultra realistic full length studio photograph of one adult ${SEXO[s]}, ${PELE[p]}, ${NIVEL[n]}, ${ROUPA[s]}, barefoot, `
    + `standing straight and relaxed with arms hanging slightly away from the body, ${VISTA[v]}. The whole body from the top of the head `
    + 'to the feet is visible, small in the frame with empty space above the head and below the feet, centered. Plain light gray seamless '
    + 'studio background, soft even lighting, natural realistic skin texture, sharp focus, DSLR photo, 85mm lens.';
  try {
    const r = await env.AI.run('@cf/black-forest-labs/flux-1-schnell', { prompt, steps: 8 });
    const bin = Uint8Array.from(atob(r.image), (c) => c.charCodeAt(0));
    return new Response(bin, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=31536000' } });
  } catch (e) {
    return new Response(`falhou: ${e && e.message}`, { status: 502 });
  }
}
