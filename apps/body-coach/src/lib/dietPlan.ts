// Cardápio do dia calculado das metas e das respostas do questionário (nada fixo por aluno).
// Tabela de alimentos brasileiros comuns (valores aproximados da TACO por porção).
export type Alimento = { nome: string; porcao: string; kcal: number; p: number; c: number; g: number };
export type Refeicao = { nome: string; horario: string; itens: Alimento[] };
export type Metas = { kcal: number; proteina: number; carbo: number; gordura: number };

type Base = { id: string; nome: string; qtd: number; un: 'g' | 'ml' | 'un'; kcal: number; p: number; c: number; g: number; evita: string[] };
const b = (id: string, nome: string, qtd: number, un: Base['un'], kcal: number, p: number, c: number, g: number, evita: string[] = []): Base =>
  ({ id, nome, qtd, un, kcal, p, c, g, evita });

const BASE: Base[] = [
  b('frango', 'Peito de frango grelhado', 100, 'g', 159, 32, 0, 2.5, ['carne']),
  b('patinho', 'Patinho moído', 100, 'g', 219, 35.9, 0, 7.3, ['carne']),
  b('peixe', 'Tilápia grelhada', 100, 'g', 128, 26, 0, 2.7, ['carne', 'peixe']),
  b('atum', 'Atum em lata', 100, 'g', 116, 26, 0, 1, ['carne', 'peixe']),
  b('ovo', 'Ovo cozido', 1, 'un', 72, 6.3, 0.4, 4.8, ['ovo']),
  b('iogurte', 'Iogurte natural', 170, 'g', 100, 8, 12, 3, ['lactose']),
  b('queijo', 'Queijo branco', 50, 'g', 85, 7, 1.5, 5.5, ['lactose']),
  b('whey', 'Whey protein', 30, 'g', 120, 24, 3, 1.5, ['lactose']),
  b('leite', 'Leite desnatado', 200, 'ml', 70, 7, 10, 0.2, ['lactose']),
  b('lentilha', 'Lentilha cozida', 100, 'g', 93, 6.3, 16, 0.5),
  b('graobico', 'Grão-de-bico cozido', 100, 'g', 130, 7, 21, 2),
  b('feijao', 'Feijão cozido', 100, 'g', 77, 4.5, 14, 0.5),
  b('arroz', 'Arroz cozido', 100, 'g', 128, 2.5, 28, 0.2),
  b('batatadoce', 'Batata-doce cozida', 100, 'g', 77, 0.6, 18, 0.1),
  b('mandioca', 'Mandioca cozida', 100, 'g', 125, 0.6, 30, 0.3),
  b('macarrao', 'Macarrão cozido', 100, 'g', 130, 4.5, 26, 0.9, ['gluten']),
  b('paointegral', 'Pão integral', 50, 'g', 125, 5, 23, 1.5, ['gluten']),
  b('aveia', 'Aveia em flocos', 30, 'g', 118, 4.2, 20, 2.1, ['gluten']),
  b('tapioca', 'Tapioca', 40, 'g', 140, 0, 34, 0),
  b('cuscuz', 'Cuscuz de milho', 100, 'g', 113, 2.2, 25, 0.7),
  b('banana', 'Banana', 100, 'g', 89, 1.1, 23, 0.3),
  b('maca', 'Maçã', 130, 'g', 68, 0.3, 18, 0.2),
  b('mamao', 'Mamão', 150, 'g', 60, 0.7, 15, 0.2),
  b('azeite', 'Azeite de oliva', 10, 'ml', 88, 0, 0, 10),
  b('abacate', 'Abacate', 50, 'g', 80, 1, 4.5, 7.5),
  b('amendoim', 'Amendoim', 20, 'g', 118, 5, 3, 10, ['amendoim']),
  b('castanhas', 'Castanhas', 20, 'g', 130, 3, 3, 13, ['castanha']),
  b('brocolis', 'Brócolis cozido', 100, 'g', 35, 3, 5, 0.4),
  b('salada', 'Salada de folhas e tomate', 100, 'g', 20, 1, 4, 0.2),
];
const POR_ID = Object.fromEntries(BASE.map((x) => [x.id, x]));

const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Restrições citadas pelo aluno → etiquetas de alimentos que ele não pode comer.
function restricoes(ob: Record<string, unknown>): Set<string> {
  const bruto = ob.restrictions ?? ob.restricoes ?? ob.allergies;
  const texto = semAcento(Array.isArray(bruto) ? bruto.join(' ') : String(bruto ?? ''));
  const out = new Set<string>();
  if (/lactose|leite|laticin/.test(texto)) out.add('lactose');
  if (/gluten|trigo|celiac/.test(texto)) out.add('gluten');
  if (/vegetarian|vegan|sem carne/.test(texto)) out.add('carne');
  if (/vegan/.test(texto)) { out.add('lactose'); out.add('ovo'); }
  if (/ovo/.test(texto)) out.add('ovo');
  if (/amendoim|oleaginosa/.test(texto)) out.add('amendoim');
  if (/castanha|oleaginosa|nozes/.test(texto)) out.add('castanha');
  if (/peixe|frutos do mar/.test(texto)) out.add('peixe');
  return out;
}

type Tipo = 'cafe' | 'almoco' | 'lanche' | 'jantar';
const ESQUEMAS: Record<number, { nome: string; tipo: Tipo; horario: string; peso: number }[]> = {
  3: [
    { nome: 'Café da manhã', tipo: 'cafe', horario: '07:30', peso: 0.3 },
    { nome: 'Almoço', tipo: 'almoco', horario: '12:30', peso: 0.4 },
    { nome: 'Jantar', tipo: 'jantar', horario: '20:00', peso: 0.3 },
  ],
  4: [
    { nome: 'Café da manhã', tipo: 'cafe', horario: '07:30', peso: 0.25 },
    { nome: 'Almoço', tipo: 'almoco', horario: '12:30', peso: 0.35 },
    { nome: 'Lanche da tarde', tipo: 'lanche', horario: '16:00', peso: 0.15 },
    { nome: 'Jantar', tipo: 'jantar', horario: '20:00', peso: 0.25 },
  ],
  5: [
    { nome: 'Café da manhã', tipo: 'cafe', horario: '07:30', peso: 0.22 },
    { nome: 'Almoço', tipo: 'almoco', horario: '12:30', peso: 0.3 },
    { nome: 'Lanche da tarde', tipo: 'lanche', horario: '16:00', peso: 0.12 },
    { nome: 'Jantar', tipo: 'jantar', horario: '20:00', peso: 0.24 },
    { nome: 'Ceia', tipo: 'lanche', horario: '22:00', peso: 0.12 },
  ],
  6: [
    { nome: 'Café da manhã', tipo: 'cafe', horario: '07:00', peso: 0.2 },
    { nome: 'Lanche da manhã', tipo: 'lanche', horario: '10:00', peso: 0.1 },
    { nome: 'Almoço', tipo: 'almoco', horario: '12:30', peso: 0.3 },
    { nome: 'Lanche da tarde', tipo: 'lanche', horario: '16:00', peso: 0.12 },
    { nome: 'Jantar', tipo: 'jantar', horario: '20:00', peso: 0.2 },
    { nome: 'Ceia', tipo: 'lanche', horario: '22:00', peso: 0.08 },
  ],
};

// Opções por papel em cada tipo de refeição (a escolha roda com o dia, para variar).
const OPCOES: Record<Tipo, { prot: string[]; carbo: string[]; lado: string[]; gord: string[] }> = {
  cafe: { prot: ['ovo', 'iogurte', 'queijo', 'whey', 'leite'], carbo: ['paointegral', 'aveia', 'tapioca', 'cuscuz', 'banana', 'mamao', 'maca'], lado: [], gord: ['abacate', 'amendoim', 'castanhas'] },
  almoco: { prot: ['frango', 'patinho', 'peixe', 'atum', 'lentilha', 'graobico', 'ovo'], carbo: ['arroz', 'batatadoce', 'mandioca', 'macarrao'], lado: ['feijao', 'brocolis', 'salada'], gord: ['azeite'] },
  jantar: { prot: ['frango', 'peixe', 'patinho', 'atum', 'ovo', 'lentilha', 'graobico'], carbo: ['batatadoce', 'arroz', 'mandioca', 'cuscuz', 'macarrao'], lado: ['brocolis', 'salada', 'feijao'], gord: ['azeite'] },
  lanche: { prot: ['iogurte', 'whey', 'queijo', 'ovo', 'atum'], carbo: ['banana', 'maca', 'mamao', 'aveia', 'tapioca'], lado: [], gord: ['castanhas', 'amendoim', 'abacate'] },
};

const meio = (n: number) => Math.round(n * 2) / 2;
const limita = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

type Escolha = { alim: Base; mult: number };

export function montarCardapio(ob: Record<string, unknown>, metas: Metas, dia: number = new Date().getDay()): Refeicao[] {
  const proibidas = restricoes(ob);
  const liberado = (id: string) => !POR_ID[id].evita.some((t) => proibidas.has(t));
  const nRaw = Number(ob.meals ?? ob.refeicoes ?? 4);
  const n = limita(Number.isFinite(nRaw) ? Math.round(nRaw) : 4, 3, 6);
  const esquema = ESQUEMAS[n];

  const refeicoes = esquema.map((r, idx) => {
    const op = OPCOES[r.tipo];
    const pega = (ids: string[], deslocamento: number) => {
      const livres = ids.filter(liberado);
      return livres.length ? POR_ID[livres[(dia + idx + deslocamento) % livres.length]] : null;
    };
    const P = pega(op.prot, 0), C = pega(op.carbo, 1), S = pega(op.lado, 2), F = pega(op.gord, 3);
    const mp = metas.proteina * r.peso, mc = metas.carbo * r.peso, mg = metas.gordura * r.peso;
    const itens: Escolha[] = [];
    let p = 0, c = 0, g = 0;
    const soma = (a: Base, m: number) => { p += a.p * m; c += a.c * m; g += a.g * m; };
    if (P) { const m = limita(meio((mp * 0.8) / Math.max(P.p, 1)), 0.5, 4); itens.push({ alim: P, mult: m }); soma(P, m); }
    if (S) { itens.push({ alim: S, mult: 1 }); soma(S, 1); }
    if (C) { const m = limita(meio((mc - c) / Math.max(C.c, 1)), 0.5, 4); itens.push({ alim: C, mult: m }); soma(C, m); }
    if (F) { const m = limita(meio((mg - g) / Math.max(F.g, 1)), 0, 3); if (m >= 0.5) itens.push({ alim: F, mult: m }); }
    return { r, itens };
  });

  // Ajuste final: aproxima o total de kcal da meta (até 10%), mexendo nas porções em múltiplos de 0,5.
  const total = () => refeicoes.reduce((s, x) => s + x.itens.reduce((t, i) => t + i.alim.kcal * i.mult, 0), 0);
  for (let volta = 0; volta < 4 && metas.kcal > 0; volta += 1) {
    const atual = total();
    if (atual <= 0 || Math.abs(atual - metas.kcal) / metas.kcal <= 0.1) break;
    const fator = metas.kcal / atual;
    for (const x of refeicoes) for (const i of x.itens) {
      if (i.alim.id === 'feijao' || i.alim.id === 'brocolis' || i.alim.id === 'salada') continue;
      i.mult = limita(meio(i.mult * fator), 0.5, 5);
    }
  }

  return refeicoes.map(({ r, itens }) => ({
    nome: r.nome,
    horario: r.horario,
    itens: itens.map(({ alim, mult }) => ({
      nome: alim.nome,
      porcao: `${Math.round(alim.qtd * mult)} ${alim.un === 'un' ? (Math.round(mult) === 1 ? 'unidade' : 'unidades') : alim.un}`,
      kcal: Math.round(alim.kcal * mult),
      p: Math.round(alim.p * mult * 10) / 10,
      c: Math.round(alim.c * mult * 10) / 10,
      g: Math.round(alim.g * mult * 10) / 10,
    })),
  }));
}
