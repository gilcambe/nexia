import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import type { MedidasCorpo, Regiao } from '@/lib/avaliacao/corpo';

export type PoseCorpo = 'relaxado' | 'biceps' | 'frente';

export interface Corpo3DProps {
  medidas: MedidasCorpo;
  cores: Partial<Record<Regiao, string>>;
  fantasma?: MedidasCorpo | null;
  pose: PoseCorpo;
  girar: boolean;
  anguloInicial?: number;
}

const PELE = '#d4d8de';

// ── geometria: anéis ao longo de um eixo (tubo de seções variáveis) ──
// Cada anel é uma "superelipse": n = 2 é elipse, n maior fica mais quadrado (peito, costas).
// f e t esticam a frente e as costas (barriga, glúteos, panturrilha) sem mexer no perímetro geral.
interface Anel { y: number; a: number; b: number; x?: number; z?: number; n?: number; f?: number; t?: number }

function pontoAnel(p: Anel, ang: number): [number, number] {
  const n = p.n ?? 2;
  const c = Math.cos(ang);
  const sn = Math.sin(ang);
  const px = p.a * Math.sign(c) * Math.abs(c) ** (2 / n);
  const pz = p.b * Math.sign(sn) * Math.abs(sn) ** (2 / n) * (sn >= 0 ? p.f ?? 1 : p.t ?? 1);
  return [px + (p.x ?? 0), pz + (p.z ?? 0)];
}

// Ajusta a e b para o anel ter exatamente o perímetro medido (em metros).
function comPerimetro(perimetroM: number, razao: number, extra: Omit<Anel, 'a' | 'b' | 'y'> = {}): { a: number; b: number } {
  const teste: Anel = { y: 0, a: 1, b: razao, ...extra, x: 0, z: 0 };
  let per = 0;
  let ant = pontoAnel(teste, 0);
  for (let i = 1; i <= 96; i += 1) {
    const pt = pontoAnel(teste, (i / 96) * Math.PI * 2);
    per += Math.hypot(pt[0] - ant[0], pt[1] - ant[1]);
    ant = pt;
  }
  const k = perimetroM / per;
  return { a: k, b: razao * k };
}

function tubo(aneis: Anel[], lados = 40, passos = 6): THREE.BufferGeometry {
  const pts: Anel[] = [];
  const chaves: (keyof Anel)[] = ['y', 'a', 'b', 'x', 'z', 'n', 'f', 't'];
  const padrao: Record<string, number> = { x: 0, z: 0, n: 2, f: 1, t: 1 };
  for (let i = 0; i < aneis.length - 1; i += 1) {
    const q = [aneis[Math.max(0, i - 1)], aneis[i], aneis[i + 1], aneis[Math.min(aneis.length - 1, i + 2)]];
    for (let s = 0; s < passos; s += 1) {
      const t = s / passos;
      const p: Anel = { y: 0, a: 0, b: 0 };
      for (const k of chaves) {
        const [v0, v1, v2, v3] = q.map((x) => (x[k] ?? padrao[k] ?? 0) as number);
        (p as unknown as Record<string, number>)[k] = 0.5 * (2 * v1 + (-v0 + v2) * t + (2 * v0 - 5 * v1 + 4 * v2 - v3) * t * t + (-v0 + 3 * v1 - 3 * v2 + v3) * t * t * t);
      }
      p.a = Math.max(0.003, p.a);
      p.b = Math.max(0.003, p.b);
      pts.push(p);
    }
  }
  pts.push(aneis[aneis.length - 1]);
  const pos: number[] = [];
  const idx: number[] = [];
  for (const p of pts) {
    for (let j = 0; j <= lados; j += 1) {
      const [x, z] = pontoAnel(p, (j / lados) * Math.PI * 2);
      pos.push(x, p.y, z);
    }
  }
  // Tampas nas pontas (não deixa buraco ao girar).
  const base = pos.length / 3;
  const ini = pts[0];
  const fim = pts[pts.length - 1];
  pos.push(ini.x ?? 0, ini.y, ini.z ?? 0, fim.x ?? 0, fim.y, fim.z ?? 0);
  const linha = lados + 1;
  for (let i = 0; i < pts.length - 1; i += 1) {
    for (let j = 0; j < lados; j += 1) {
      const a = i * linha + j;
      const b = a + linha;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const ultimo = (pts.length - 1) * linha;
  for (let j = 0; j < lados; j += 1) {
    idx.push(base, j, j + 1);
    idx.push(base + 1, ultimo + j + 1, ultimo + j);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

// Pinta cada vértice pela região do corpo (escolhida pela altura do vértice).
// A cor é a média de amostras acima e abaixo do vértice: a passagem entre regiões fica suave.
function pintar(g: THREE.BufferGeometry, regiaoDe: (y: number) => Regiao | null, cores: Partial<Record<Regiao, string>>, suave = 0.018) {
  const pos = g.getAttribute('position');
  const cs: number[] = [];
  const pele = new THREE.Color(PELE);
  const corDe = (y: number) => {
    const reg = regiaoDe(y);
    return reg && cores[reg] ? new THREE.Color(cores[reg]) : pele;
  };
  for (let i = 0; i < pos.count; i += 1) {
    const y = pos.getY(i);
    const c = new THREE.Color(0, 0, 0);
    for (const d of [-1, -0.5, 0, 0.5, 1]) {
      const a = corDe(y + d * suave);
      c.r += a.r / 5; c.g += a.g / 5; c.b += a.b / 5;
    }
    cs.push(c.r, c.g, c.b);
  }
  g.setAttribute('color', new THREE.Float32BufferAttribute(cs, 3));
}

const r = (cm: number) => cm / 100 / (2 * Math.PI);

interface Partes {
  raiz: THREE.Group;
  bracos: { ombro: THREE.Group; cotovelo: THREE.Group; lado: 1 | -1 }[];
  tronco: THREE.Mesh;
}

function montar(m: MedidasCorpo, cores: Partial<Record<Regiao, string>>, fantasma = false): Partes {
  const H = m.altura;
  const k = H / 1.75;
  const F = m.sexo === 'F';
  const raiz = new THREE.Group();
  const material = fantasma
    ? new THREE.MeshBasicMaterial({ color: '#64748b', wireframe: true, transparent: true, opacity: 0.18 })
    : new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.48, metalness: 0.04, side: THREE.DoubleSide });
  const malha = (g: THREE.BufferGeometry, reg: (y: number) => Regiao | null) => {
    if (!fantasma) pintar(g, reg, cores);
    return new THREE.Mesh(g, material);
  };

  const per = (cm: number) => cm / 100;
  const biacromial = Math.min(0.28 * H, Math.max((F ? 0.215 : 0.235) * H, (m.ombro / 100 / Math.PI) * 1.1));
  const rb = r(m.braco);
  const ra = r(m.antebraco);
  const rc = r(m.coxa);
  const rp = r(m.panturrilha);
  const pesc = r(m.pescoco);

  // ── tronco ──
  const quad = comPerimetro(per(m.quadril), 0.74, { t: 1.1, f: 0.92 });
  const abd = comPerimetro(per(m.abdomen), 0.74, { f: 1.12, t: 0.92 });
  const cin = comPerimetro(per(m.cintura), 0.7);
  const pei = comPerimetro(per(m.torax), F ? 0.72 : 0.66, { n: 2.3, f: 1.04, t: 0.98 });
  const ombroA = biacromial / 2 - rb * 0.55;
  const aneis: Anel[] = [
    { y: 0.45 * H, a: quad.a * 0.5, b: quad.b * 0.55, t: 1.05, f: 0.92 },
    { y: 0.485 * H, a: quad.a * 0.95, b: quad.b * 0.95, t: 1.1, f: 0.92 },
    { y: 0.52 * H, a: quad.a, b: quad.b, t: 1.1, f: 0.92 },
    { y: 0.575 * H, a: abd.a, b: abd.b, f: 1.12, t: 0.92 },
    { y: 0.615 * H, a: cin.a, b: cin.b, z: -0.004 * k },
    { y: 0.665 * H, a: (cin.a + pei.a) / 2, b: (cin.b + pei.b) / 2, n: 2.2 },
    { y: 0.715 * H, a: pei.a, b: pei.b, n: 2.3, f: 1.04, t: 0.98 },
    { y: 0.755 * H, a: Math.max(pei.a, ombroA * 0.96), b: pei.b * 0.98, n: 2.6, f: 1.02 },
    { y: 0.79 * H, a: ombroA, b: pei.b * 0.82, n: 2.6 },
    { y: 0.812 * H, a: ombroA * 0.78, b: pei.b * 0.68, n: 2.3, z: -0.004 * k },
    { y: 0.83 * H, a: pesc * 1.18, b: pesc * 1.08, z: -0.005 * k },
    { y: 0.845 * H, a: pesc * 0.85, b: pesc * 0.8, z: -0.004 * k },
  ];
  const tronco = malha(tubo(aneis, 48, 8), (y) => {
    const yf = y / H;
    if (yf < 0.55) return 'quadril';
    if (yf < 0.655) return 'abdomen';
    if (yf < 0.79) return 'peito';
    return 'ombros';
  });
  raiz.add(tronco);

  // ── pescoço e cabeça ──
  raiz.add(malha(tubo([
    { y: 0.81 * H, a: pesc * 1.1, b: pesc, z: -0.004 * k },
    { y: 0.875 * H, a: pesc * 0.95, b: pesc * 0.95, z: 0.002 * k },
    { y: 0.895 * H, a: pesc * 0.9, b: pesc * 0.9, z: 0.004 * k },
  ], 24, 4), () => null));
  const cabeca = malha(new THREE.SphereGeometry(1, 40, 28), () => null);
  cabeca.scale.set(0.072 * k, 0.1 * k, 0.086 * k);
  cabeca.position.set(0, 0.935 * H, 0.004 * k);
  raiz.add(cabeca);

  // ── pernas (uma peça do quadril ao tornozelo) ──
  // As coxas nunca passam da largura do quadril: em coxas grossas elas se encostam, como no corpo real.
  const aTopo = Math.min(rc * 1.08, quad.a * 0.56);
  const xQ = Math.max(quad.a * 0.3, quad.a * 0.98 - aTopo);
  for (const lado of [-1, 1] as const) {
    const xs = (f: number) => lado * xQ * (1 - (0.5 - f) * 0.35); // joelhos e pés um pouco mais juntos
    const perna = malha(tubo([
      { y: 0.55 * H, a: aTopo * 0.6, b: aTopo * 0.6, x: xs(0.55) * 0.7 },
      { y: 0.5 * H, a: aTopo, b: aTopo * 0.98, x: xs(0.5) },
      { y: 0.46 * H, a: Math.min(rc * 1.08, aTopo * 1.02), b: rc * 1.04, x: xs(0.46), t: 1.06 },
      { y: 0.42 * H, a: rc * 1.03, b: rc * 1.0, x: xs(0.42), f: 1.05 },
      { y: 0.36 * H, a: rc * 0.86, b: rc * 0.86, x: xs(0.36), f: 1.06 },
      { y: 0.31 * H, a: rc * 0.66, b: rc * 0.66, x: xs(0.31) },
      { y: 0.285 * H, a: rc * 0.6, b: rc * 0.6, x: xs(0.285) },
      { y: 0.255 * H, a: rp * 0.88, b: rp * 0.86, x: xs(0.255), t: 1.12 },
      { y: 0.215 * H, a: rp * 0.98, b: rp * 0.98, x: xs(0.215), t: 1.22, f: 0.86 },
      { y: 0.16 * H, a: rp * 0.78, b: rp * 0.76, x: xs(0.16), t: 1.08 },
      { y: 0.09 * H, a: rp * 0.54, b: rp * 0.52, x: xs(0.09) },
      { y: 0.045 * H, a: rp * 0.46, b: rp * 0.48, x: xs(0.045) },
      { y: 0.03 * H, a: rp * 0.42, b: rp * 0.44, x: xs(0.03) },
    ], 32, 6), (y) => (y / H > 0.3 ? 'coxa' : 'panturrilha'));
    raiz.add(perna);
    const pe = malha(new THREE.SphereGeometry(1, 20, 14), () => null);
    pe.scale.set(0.042 * k, 0.03 * k, 0.11 * k);
    pe.position.set(xs(0.03), 0.026 * H, 0.05 * k);
    raiz.add(pe);
  }

  // ── braços (ombro → cotovelo → punho), articulados para as poses ──
  const bracos: Partes['bracos'] = [];
  const ub = 0.186 * H;
  const fa = 0.146 * H;
  for (const lado of [-1, 1] as const) {
    const ombro = new THREE.Group();
    ombro.position.set(lado * (biacromial / 2 - rb * 0.3), 0.79 * H, -0.004 * k);
    const braco = malha(tubo([
      { y: rb * 0.9, a: rb * 0.55, b: rb * 0.6 },
      { y: rb * 0.35, a: rb * 1.2, b: rb * 1.15, x: lado * rb * 0.12 },
      { y: -0.04 * H, a: rb * 1.18, b: rb * 1.12, x: lado * rb * 0.1 },
      { y: -0.08 * H, a: rb * 1.0, b: rb * 1.05, f: 1.08 },
      { y: -0.13 * H, a: rb * 0.95, b: rb * 1.0, f: 1.1 },
      { y: -0.17 * H, a: rb * 0.74, b: rb * 0.72 },
      { y: -ub, a: ra * 0.78, b: ra * 0.74 },
    ], 28, 6), (y) => (y > -0.045 * H ? 'ombros' : 'braco'));
    ombro.add(braco);
    const cotovelo = new THREE.Group();
    cotovelo.position.set(0, -ub, 0);
    const junta = malha(new THREE.SphereGeometry(ra * 0.88, 20, 14), () => 'antebraco');
    cotovelo.add(junta);
    const antebraco = malha(tubo([
      { y: 0, a: ra * 0.9, b: ra * 0.85 },
      { y: -0.03 * H, a: ra * 1.08, b: ra * 0.98 },
      { y: -0.08 * H, a: ra * 0.9, b: ra * 0.78 },
      { y: -fa, a: ra * 0.6, b: ra * 0.46 },
    ], 24, 6), () => 'antebraco');
    cotovelo.add(antebraco);
    const mao = malha(new THREE.SphereGeometry(1, 18, 12), () => null);
    mao.scale.set(0.026 * k, 0.05 * k, 0.04 * k);
    mao.position.set(0, -fa - 0.045 * k, 0);
    cotovelo.add(mao);
    ombro.add(cotovelo);
    raiz.add(ombro);
    bracos.push({ ombro, cotovelo, lado });
  }
  raiz.position.y = -H / 2;
  return { raiz, bracos, tronco };
}

// Ângulos de cada pose (ombro abre para o lado em z; cotovelo dobra para cima).
const POSES: Record<PoseCorpo, { ombroZ: number; ombroX: number; cotoveloZ: number; cotoveloX: number }> = {
  relaxado: { ombroZ: 0.16, ombroX: 0, cotoveloZ: 0, cotoveloX: -0.08 },
  biceps: { ombroZ: 1.38, ombroX: -0.15, cotoveloZ: 2.05, cotoveloX: 0 },
  frente: { ombroZ: 0.05, ombroX: -1.5, cotoveloZ: 0, cotoveloX: 0 },
};

function aplicarPose(p: Partes, alvo: PoseCorpo, k: number) {
  const a = POSES[alvo];
  for (const b of p.bracos) {
    b.ombro.rotation.z += (b.lado * a.ombroZ - b.ombro.rotation.z) * k;
    b.ombro.rotation.x += (a.ombroX - b.ombro.rotation.x) * k;
    b.cotovelo.rotation.z += (b.lado * a.cotoveloZ - b.cotovelo.rotation.z) * k;
    b.cotovelo.rotation.x += (a.cotoveloX - b.cotovelo.rotation.x) * k;
  }
}

// Corpo 3D que gira (arrastando o dedo ou sozinho), respira e muda de pose.
export default function Corpo3D({ medidas, cores, fantasma, pose, girar, anguloInicial = 0 }: Corpo3DProps) {
  const caixa = useRef<HTMLDivElement>(null);
  const estado = useRef({ pose, girar });
  estado.current = { pose, girar };

  useEffect(() => {
    const el = caixa.current;
    if (!el) return;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    el.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = 'pan-y';

    const cena = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 20);
    camera.position.set(0, 0.05, 3.6 * (medidas.altura / 1.75));
    cena.add(new THREE.HemisphereLight('#ffffff', '#8a8f98', 1.6));
    const luz = new THREE.DirectionalLight('#ffffff', 2.2);
    luz.position.set(1.5, 2.5, 2.5);
    cena.add(luz);
    const contra = new THREE.DirectionalLight('#ffd8b0', 0.9);
    contra.position.set(-2, 1, -2);
    cena.add(contra);

    const corpo = montar(medidas, cores);
    const giro = new THREE.Group();
    giro.rotation.y = anguloInicial;
    giro.add(corpo.raiz);
    let sombra: Partes | null = null;
    if (fantasma) {
      sombra = montar(fantasma, {}, true);
      giro.add(sombra.raiz);
    }
    cena.add(giro);
    const chao = new THREE.Mesh(new THREE.CircleGeometry(0.45, 40), new THREE.MeshBasicMaterial({ color: '#000', transparent: true, opacity: 0.08 }));
    chao.rotation.x = -Math.PI / 2;
    chao.position.y = -medidas.altura / 2 + 0.002;
    cena.add(chao);
    aplicarPose(corpo, estado.current.pose, 1);
    if (sombra) aplicarPose(sombra, estado.current.pose, 1);

    const ajustar = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      renderer.setSize(w, h, false);
      renderer.domElement.style.width = '100%';
      renderer.domElement.style.height = '100%';
      camera.aspect = w / Math.max(1, h);
      camera.updateProjectionMatrix();
    };
    ajustar();
    const obs = new ResizeObserver(ajustar);
    obs.observe(el);

    // Arrastar para girar
    let arrastando = false;
    let xAnt = 0;
    let vel = 0;
    const down = (e: PointerEvent) => { arrastando = true; xAnt = e.clientX; vel = 0; };
    const move = (e: PointerEvent) => {
      if (!arrastando) return;
      const dx = e.clientX - xAnt;
      xAnt = e.clientX;
      giro.rotation.y += dx * 0.012;
      vel = dx * 0.012;
    };
    const up = () => { arrastando = false; };
    renderer.domElement.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);

    let quadro = 0;
    const t0 = performance.now();
    const loop = () => {
      const t = (performance.now() - t0) / 1000;
      if (!arrastando) {
        if (Math.abs(vel) > 0.0005) { giro.rotation.y += vel; vel *= 0.94; } else if (estado.current.girar) giro.rotation.y += 0.006;
      }
      // Respiração: o tronco expande um pouco.
      const resp = 1 + Math.sin(t * 1.6) * 0.012;
      corpo.tronco.scale.set(resp, 1, resp);
      aplicarPose(corpo, estado.current.pose, 0.08);
      if (sombra) aplicarPose(sombra, estado.current.pose, 0.08);
      renderer.render(cena, camera);
      quadro = requestAnimationFrame(loop);
    };
    loop();

    return () => {
      cancelAnimationFrame(quadro);
      obs.disconnect();
      renderer.domElement.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cena.traverse((o) => {
        if (o instanceof THREE.Mesh) {
          o.geometry.dispose();
          (Array.isArray(o.material) ? o.material : [o.material]).forEach((mt) => mt.dispose());
        }
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [medidas, cores, fantasma, anguloInicial]);

  return <div ref={caixa} className="h-full w-full cursor-grab active:cursor-grabbing" data-testid="corpo-3d" />;
}
