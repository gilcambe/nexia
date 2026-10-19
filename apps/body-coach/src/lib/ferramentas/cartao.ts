// Cartão do treino para o Instagram/WhatsApp (formato story 1080×1920), desenhado no próprio
// celular com canvas. Leva a marca Body Coach e o link de indicação: cada post vira divulgação grátis.
import qrcode from 'qrcode-generator';

// Endereço oficial do app (o QR e o link de indicação sempre apontam para cá, nunca para o endereço antigo).
export const APP_URL = 'https://nexiabodycoach.pages.dev';

export interface DadosCartao {
  titulo: string;
  data: Date;
  itens: { rotulo: string; valor: string }[];
  destaque?: string; // ex.: "Novo recorde no supino: 80 kg"
  nome?: string;
  link?: string;
  selo?: boolean; // QR do app no canto (padrão: o que a pessoa escolheu em "Mostrar selo do app")
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
    ctx.fillText(d.link.replace(/^https?:\/\//, '').split('/')[0], 90, 1755);
  }
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillText('@nexiabodycoach', 90, 1805);
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.font = '28px system-ui, sans-serif';
  ctx.fillText('Feito com NEXIA', 90, 1830);
  if (d.link && (d.selo ?? seloLigado())) selo(ctx, 1080, 1920, d.link);
}

// Resumo da semana no formato do feed do Instagram (1080×1350, retrato 4:5) com @nexiabodycoach:
// quem posta a evolução divulga o app. Mesmas cores e selo do cartão do treino.
export const FEED = { largura: 1080, altura: 1350 };
export function desenharResumoSemanal(c: HTMLCanvasElement, d: DadosCartao): void {
  const W = FEED.largura;
  const H = FEED.altura;
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  if (!ctx) return;
  const g = ctx.createLinearGradient(0, 0, W, H);
  g.addColorStop(0, '#0b0b0f');
  g.addColorStop(0.6, '#1a1208');
  g.addColorStop(1, '#f97316');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const r = ctx.createRadialGradient(880, 220, 10, 880, 220, 520);
  r.addColorStop(0, 'rgba(249,115,22,0.45)');
  r.addColorStop(1, 'rgba(249,115,22,0)');
  ctx.fillStyle = r;
  ctx.fillRect(0, 0, W, H);

  ctx.fillStyle = '#f97316';
  ctx.font = 'bold 40px system-ui, sans-serif';
  ctx.fillText('BODY COACH', 80, 130);
  const inicio = new Date(d.data.getTime() - 6 * 86400000);
  const curta = (x: Date) => x.toLocaleDateString('pt-BR', { day: 'numeric', month: 'short' });
  ctx.fillStyle = 'rgba(255,255,255,0.7)';
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillText(`${curta(inicio)} – ${curta(d.data)}`, 80, 180);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 88px system-ui, sans-serif';
  const linhas = quebrar(ctx, d.titulo || 'Minha semana', 920).slice(0, 2);
  linhas.forEach((l, i) => ctx.fillText(l, 80, 320 + i * 100));
  let y = 320 + linhas.length * 100 - 30;
  if (d.nome) {
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = '40px system-ui, sans-serif';
    ctx.fillText(`${d.nome} segue firme 💪`, 80, y + 40);
    y += 60;
  }
  y += 40;

  d.itens.slice(0, 4).forEach((it, i) => {
    const x = 80 + (i % 2) * 470;
    const yy = y + Math.floor(i / 2) * 250;
    ctx.fillStyle = 'rgba(255,255,255,0.08)';
    ctx.beginPath();
    ctx.roundRect(x, yy, 450, 220, 32);
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 76px system-ui, sans-serif';
    ctx.fillText(it.valor, x + 36, yy + 120);
    ctx.fillStyle = 'rgba(255,255,255,0.65)';
    ctx.font = '32px system-ui, sans-serif';
    ctx.fillText(it.rotulo, x + 36, yy + 178);
  });
  y += Math.ceil(Math.min(4, d.itens.length) / 2) * 250 + 10;

  if (d.destaque && y < H - 330) {
    ctx.fillStyle = 'rgba(249,115,22,0.95)';
    ctx.beginPath();
    ctx.roundRect(80, y, 920, 120, 32);
    ctx.fill();
    ctx.fillStyle = '#0b0b0f';
    ctx.font = 'bold 36px system-ui, sans-serif';
    quebrar(ctx, d.destaque, 860).slice(0, 2).forEach((l, i) => ctx.fillText(l, 110, y + 55 + i * 42));
  }

  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  ctx.font = 'bold 38px system-ui, sans-serif';
  ctx.fillText('Evolua comigo no Body Coach', 80, H - 140);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.font = '32px system-ui, sans-serif';
  ctx.fillText('@nexiabodycoach', 80, H - 90);
  if (d.link && (d.selo ?? seloLigado())) selo(ctx, W, H, d.link);
}

// "Mostrar selo do app" (ligado por padrão), lembrado no aparelho.
export function seloLigado(): boolean {
  try { return localStorage.getItem('bc_selo') !== '0'; } catch { return true; }
}
export function guardarSelo(ligado: boolean): void {
  try { localStorage.setItem('bc_selo', ligado ? '1' : '0'); } catch { /* sem armazenamento */ }
}

const qrs = new Map<string, boolean[][]>();
function matrizQr(link: string): boolean[][] {
  let m = qrs.get(link);
  if (!m) {
    const q = qrcode(0, 'M');
    q.addData(link);
    q.make();
    const n = q.getModuleCount();
    m = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => q.isDark(r, c)));
    qrs.set(link, m);
  }
  return m;
}

// Selo do app no canto de baixo à direita: faixa escura com o QR do link e "Body Coach / @nexiabodycoach · escaneie".
// Desenho síncrono: dá para chamar em todo quadro do vídeo.
export function selo(ctx: CanvasRenderingContext2D, w: number, h: number, link: string): void {
  if (!link) return;
  const u = w / 1080;
  const lado = Math.round(w * 0.12);
  const pad = 16 * u;
  const margem = 32 * u;
  ctx.save();
  ctx.globalAlpha = 1;
  ctx.shadowColor = 'transparent';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'alphabetic';
  ctx.font = `800 ${34 * u}px system-ui, sans-serif`;
  const l1 = ctx.measureText('Body Coach').width;
  ctx.font = `500 ${23 * u}px system-ui, sans-serif`;
  const l2 = ctx.measureText('@nexiabodycoach · escaneie').width;
  const largura = pad + lado + 18 * u + Math.max(l1, l2) + pad * 1.4;
  const altura = lado + pad * 2;
  const x = w - margem - largura;
  const y = h - margem - altura;
  ctx.fillStyle = 'rgba(10,10,14,0.68)';
  ctx.beginPath();
  ctx.roundRect(x, y, largura, altura, 22 * u);
  ctx.fill();
  // QR com borda branca (zona de silêncio) para qualquer câmera ler.
  const qx = x + pad;
  const qy = y + pad;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.roundRect(qx, qy, lado, lado, 8 * u);
  ctx.fill();
  const m = matrizQr(link);
  const borda = lado * 0.07;
  const cel = (lado - borda * 2) / m.length;
  ctx.fillStyle = '#000000';
  m.forEach((linha, r) => linha.forEach((escuro, c) => {
    if (escuro) ctx.fillRect(qx + borda + c * cel, qy + borda + r * cel, Math.ceil(cel), Math.ceil(cel));
  }));
  const tx = qx + lado + 18 * u;
  ctx.fillStyle = '#ffffff';
  ctx.font = `800 ${34 * u}px system-ui, sans-serif`;
  ctx.fillText('Body Coach', tx, y + altura / 2 - 4 * u);
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.font = `500 ${23 * u}px system-ui, sans-serif`;
  ctx.fillText('@nexiabodycoach · escaneie', tx, y + altura / 2 + 30 * u);
  ctx.restore();
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
  return `${APP_URL}/body-coach/auth?ref=${codigoIndicacao(uid)}`;
}
// Guarda quem indicou (vem no link ?ref=) para gravar no perfil depois do cadastro.
export function capturarIndicacao(): void {
  try {
    const ref = new URLSearchParams(window.location.search).get('ref');
    if (ref && /^[A-Za-z0-9]{6,40}$/.test(ref)) localStorage.setItem('bc_indicado_por', ref);
    // ?cupom=: desconto do convite, aplicado sozinho na tela de pagamento
    const cupom = (new URLSearchParams(window.location.search).get('cupom') ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 20);
    if (cupom) localStorage.setItem('bc_cupom', cupom);
  } catch { /* sem armazenamento */ }
}
