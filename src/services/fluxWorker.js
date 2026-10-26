// Serviço do Workers AI (FLUX.1 schnell)
export async function generateImageWithFlux(prompt) {
  // Chamada para o binding AI do Workers AI / Cloudflare Workers
  // Em ambiente de worker do Cloudflare, env.AI é injetado. Caso contrário, tenta fetch na API ou endpoint interno de IA.
  try {
    // Se estiver rodando no Cloudflare Workers com env global ou globalThis.AI / context
    // @ts-ignore
    const aiBinding = typeof AI !== 'undefined' ? AI : (globalThis.AI || (typeof process !== 'undefined' && process.env?.AI));
    
    if (aiBinding && typeof aiBinding.run === 'function') {
      const response = await aiBinding.run('@cf/black-forest-labs/flux-1-schnell', {
        prompt: prompt,
      });
      
      // O Workers AI FLUX.1 schnell costuma retornar um objeto com image (base64 ou binary)
      if (response && response.image) {
        let base64Data = response.image;
        if (typeof base64Data !== 'string') {
          // Se for arraybuffer ou similar
          const uint8Array = new Uint8Array(base64Data);
          let binary = '';
          for (let i = 0; i < uint8Array.byteLength; i++) {
            binary += String.fromCharCode(uint8Array[i]);
          }
          base64Data = btoa(binary);
        }
        const url = `data:image/jpeg;base64,${base64Data}`;
        return { url, format: 'image/jpeg' };
      }
    }

    // Alternativa via endpoint HTTP do Worker se disponível
    const res = await fetch('/api/ai-analysis', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'flux', prompt })
    });
    
    if (res.ok) {
      const data = await res.json();
      if (data && data.url) {
        return { url: data.url, format: 'image/jpeg' };
      }
      if (data && data.image) {
        return { url: `data:image/jpeg;base64,${data.image}`, format: 'image/jpeg' };
      }
    }

    throw new Error('Workers AI binding or endpoint unavailable');
  } catch (error) {
    throw new Error(`FluxWorker error: ${error && error.message ? error.message : String(error)}`);
  }
}
