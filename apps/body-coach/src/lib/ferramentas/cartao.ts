// Cartão do treino para o Instagram/WhatsApp (formato story 1080×1920), desenhado no próprio
// celular com canvas. Leva a marca Body Coach e o link de indicação: cada post vira divulgação grátis.

export interface DadosCartao {
  titulo: string;
  data: Date;
  itens: { rotulo: string; valor: string }[];
  destaque?: string; // ex.: "Novo recorde no supino: 80 kg"
  nome?: string;
  link?: string;
}

function quebrar(ctx: CanvasRenderingContext2D, texto: string, largura: number): string[] {
  const palavras = texto.split(/\s+/);
  const linhas: string[] = [];
  let atual = '';
  for (const p of palavras) {
    const teste = atual ? `${atual} ${p}` : p;
    if (ctx.measureText(teste).width > largura && atual) { linhas.push(atual); atual = p; } else atual = teste;
  }
  if (atual) linhas.push(atual);
  return linhas;
}

export function desenharCartao(c: HTMLCanvasElement, d: DadosCartao): void {
  c.width = 1080;
  c.height = 1920;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, 1080, 1920);
  g.addColorStop(0, '#0b0b0f');
  g.addColorStop(0.55, '#1a1208');
  g.addColorStop(1, '#f97316');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 1080, 1920);
  // Brilho decorativo.
  const r = ctx.createRadialGradient(900, 300, 10, 900, 300, 600);
  r.addColorStop(0, 'rgba(249,115,22,0.45)');
  r.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, 1080, 1920);

  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 44px system-ui, sans-serif';
  ctx.fillText('BODY COACH', 90, 170);
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '34px system-ui, sans-serif';
  ctx.fillText(d.data.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' }), 90, 225);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 96px system-ui, sans-serif';
  const linhasTitulo = quebrar(ctx, d.titulo || 'Treino concluído', 900).slice(0, 3);
  linhasTitulo.forEach((l, i) => ctx.fillText(l, 90, 420 + i * 110));
  let y = 420 + linhasTitulo.length * 110 + 20;
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = '44px system-ui, sans-serif';
  ctx.fillText(d.nome ? `${d.nome} mandou bem hoje 💪` : 'Treino concluído 💪', 90, y);
  y += 110;

  // Números do treino em blocos 2×2.
  const itens = d.itens.slice(0, 4);
  itens.forEach((it, i) => {
    const x = 90 + (i % 2) * 460;
    const yy = y + Math.floor(i / 2) * 300;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(x, yy, 430, 260, 36);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 84px system-ui, sans-serif';
    ctx.fillText(it.valor, x + 40, yy + 140);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '36px system-ui, sans-serif';
    ctx.fillText(it.rotulo, x + 40, yy + 205);
  });
  y += Math.ceil(itens.length / 2) * 300 + 30;

  if (d.destaque) {
    ctx.fillStyle = 'rgba(249,115,22,0.95)';
    ctx.beginPath();
    ctx.roundRect(90, y, 900, 150, 36);
    ctx.fill();
    ctx.fillStyle = '#0b0b0f';
    ctx.font = 'bold 42px system-ui, sans-serif';
    quebrar(ctx, `🏆 ${d.destaque}`, 820).slice(0, 2).forEach((l, i) => ctx.fillText(l, 130, y + 68 + i * 50));
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('Treine comigo no Body Coach', 90, 1700);
  if (d.link) {
    ctx.fillStyle = 'rgba(255,255,255,0.75)';
    ctx.font = '32px system-ui, sans-serif';
    ctx.fillText(d.link.replace(/^https?:\/\//, ''), 90, 1755);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('Feito com NEXIA', 90, 1830);
}

export async function compartilharCanvas(c: HTMLCanvasElement, texto: string, url?: string): Promise<'compartilhado' | 'baixado'> {
  const blob: Blob | null = await new Promise((ok) => c.toBlob(ok, 'image/png'));
  if (!blob) throw new Error('Não consegui gerar a imagem.');
  const arquivo = new File([blob], 'meu-treino-body-coach.png', { type: 'image/png' });
  const nav = navigator as Navigator & { canShare?: (d: { files?: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files: [arquivo] })) {
    try {
      await nav.share({ files: [arquivo], text: url ? `${texto} ${url}` : texto });
      return 'compartilhado';
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 'compartilhado';
    }
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = arquivo.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  return 'baixado';
}

// Link de indicação: o código é o começo do id do usuário (não expõe e-mail nem nome).
export function codigoIndicacao(uid: string): string {
  return uid.slice(0, 10);
}
export function linkIndicacao(uid: string): string {
  return `${window.location.origin}${import.meta.env.BASE_URL}auth?ref=${codigoIndicacao(uid)}`;
}
// Guarda quem indicou (vem no link ?ref=) para gravar no perfil depois do cadastro.
export function capturarIndicacao(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9]{6,40}$/.test(ref)) localStorage.setItem('bc_indicado_por', ref);
  } catch { /* sem armazenamento */ }
}
