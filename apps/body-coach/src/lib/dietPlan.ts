// Cardápio do dia calculado das metas e das respostas do questionário (nada fixo por aluno).
// Tabela de alimentos brasileiros comuns (valores aproximados da TACO por porção).
export type Alimento = { id?: string; qtd?: number; nome: string; porcao: string; kcal: number; p: number; c: number; g: number };
export type Refeicao = { nome: string; horario: string; itens: Alimento[] };
export type Metas = { kcal: number; proteina: number; carbo: number; gordura: number };

// grupo = família de troca: só troca por outro alimento do mesmo grupo (proteína por proteína, carbo por carbo...).
export type Grupo = 'prot' | 'prot_leve' | 'leguminosa' | 'carbo' | 'carbo_cafe' | 'fruta' | 'gord' | 'leg';
export type Base = { id: string; nome: string; qtd: number; un: 'g' | 'ml' | 'un'; kcal: number; p: number; c: number; g: number; evita: string[]; grupos: Grupo[]; apelidos?: string[] };
const b = (id: string, nome: string, qtd: number, un: Base['un'], kcal: number, p: number, c: number, g: number, grupos: Grupo[], evita: string[] = [], apelidos: string[] = []): Base =>
  ({ id, nome, qtd, un, kcal, p, c, g, evita, grupos, apelidos });

export const BASE: Base[] = [
  b('frango', 'Peito de frango grelhado', 100, 'g', 159, 32, 0, 2.5, ['prot'], ['carne'], ['frango', 'file de frango', 'peito de frango']),
  b('patinho', 'Patinho moído', 100, 'g', 219, 35.9, 0, 7.3, ['prot'], ['carne'], ['patinho', 'carne moida']),
  b('alcatra', 'Alcatra grelhada', 100, 'g', 241, 31.9, 0, 11.6, ['prot'], ['carne'], ['alcatra', 'carne vermelha', 'contra file', 'file mignon', 'carne bovina', 'bife']),
  b('peru', 'Peito de peru', 50, 'g', 56, 9.5, 1, 1.3, ['prot', 'prot_leve'], ['carne'], ['peru']),
  b('peixe', 'Tilápia grelhada', 100, 'g', 128, 26, 0, 2.7, ['prot'], ['carne', 'peixe'], ['tilapia', 'peixe', 'merluza', 'pescada']),
  b('atum', 'Atum em lata', 100, 'g', 116, 26, 0, 1, ['prot'], ['carne', 'peixe'], ['atum']),
  b('sardinha', 'Sardinha em lata', 100, 'g', 208, 24.6, 0, 11.5, ['prot'], ['carne', 'peixe'], ['sardinha']),
  b('tofu', 'Tofu', 100, 'g', 76, 8, 1.9, 4.8, ['prot', 'prot_leve'], [], ['tofu']),
  b('ovo', 'Ovo cozido', 1, 'un', 72, 6.3, 0.4, 4.8, ['prot', 'prot_leve'], ['ovo'], ['ovo', 'ovos', 'omelete', 'ovo mexido']),
  b('iogurte', 'Iogurte natural', 170, 'g', 100, 8, 12, 3, ['prot_leve'], ['lactose'], ['iogurte']),
  b('queijo', 'Queijo branco', 50, 'g', 85, 7, 1.5, 5.5, ['prot_leve'], ['lactose'], ['queijo', 'ricota', 'cottage', 'mussarela']),
  b('whey', 'Whey protein', 30, 'g', 120, 24, 3, 1.5, ['prot_leve'], ['lactose'], ['whey']),
  b('leite', 'Leite desnatado', 200, 'ml', 70, 7, 10, 0.2, ['prot_leve'], ['lactose'], ['leite']),
  b('lentilha', 'Lentilha cozida', 100, 'g', 93, 6.3, 16, 0.5, ['leguminosa'], [], ['lentilha']),
  b('graobico', 'Grão-de-bico cozido', 100, 'g', 130, 7, 21, 2, ['leguminosa'], [], ['grao de bico']),
  b('feijao', 'Feijão cozido', 100, 'g', 77, 4.5, 14, 0.5, ['leguminosa'], [], ['feijao']),
  b('ervilha', 'Ervilha cozida', 100, 'g', 74, 5, 13, 0.4, ['leguminosa'], [], ['ervilha']),
  b('arroz', 'Arroz cozido', 100, 'g', 128, 2.5, 28, 0.2, ['carbo'], [], ['arroz branco', 'arroz']),
  b('arrozintegral', 'Arroz integral cozido', 100, 'g', 124, 2.6, 25.8, 1, ['carbo'], [], ['arroz integral']),
  b('batatadoce', 'Batata-doce cozida', 100, 'g', 77, 0.6, 18, 0.1, ['carbo'], [], ['batata doce']),
  b('batata', 'Batata inglesa cozida', 100, 'g', 52, 1.2, 11.9, 0, ['carbo'], [], ['batata inglesa', 'batata cozida', 'pure de batata']),
  b('inhame', 'Inhame cozido', 100, 'g', 97, 2.1, 23.2, 0.1, ['carbo'], [], ['inhame', 'cara']),
  b('mandioca', 'Mandioca cozida', 100, 'g', 125, 0.6, 30, 0.3, ['carbo'], [], ['mandioca', 'aipim', 'macaxeira']),
  b('macarrao', 'Macarrão cozido', 100, 'g', 130, 4.5, 26, 0.9, ['carbo'], ['gluten'], ['macarrao', 'massa', 'espaguete']),
  b('cuscuz', 'Cuscuz de milho', 100, 'g', 113, 2.2, 25, 0.7, ['carbo', 'carbo_cafe'], [], ['cuscuz']),
  b('paointegral', 'Pão integral', 50, 'g', 125, 5, 23, 1.5, ['carbo_cafe'], ['gluten'], ['pao integral', 'pao de forma']),
  b('paofrances', 'Pão francês', 50, 'g', 150, 4, 29, 1.6, ['carbo_cafe'], ['gluten'], ['pao frances', 'pao']),
  b('aveia', 'Aveia em flocos', 30, 'g', 118, 4.2, 20, 2.1, ['carbo_cafe'], ['gluten'], ['aveia']),
  b('tapioca', 'Tapioca', 40, 'g', 140, 0, 34, 0, ['carbo_cafe'], [], ['tapioca', 'goma de tapioca']),
  b('rap10', 'Pão de forma sem glúten', 50, 'g', 130, 2, 25, 2.5, ['carbo_cafe'], [], ['sem gluten']),
  b('banana', 'Banana', 100, 'g', 89, 1.1, 23, 0.3, ['fruta'], [], ['banana']),
  b('maca', 'Maçã', 130, 'g', 68, 0.3, 18, 0.2, ['fruta'], [], ['maca']),
  b('mamao', 'Mamão', 150, 'g', 60, 0.7, 15, 0.2, ['fruta'], [], ['mamao', 'papaia']),
  b('morango', 'Morango', 150, 'g', 45, 1, 10, 0.5, ['fruta'], [], ['morango']),
  b('laranja', 'Laranja', 150, 'g', 56, 1.4, 13, 0.2, ['fruta'], [], ['laranja', 'tangerina', 'mexerica']),
  b('pera', 'Pera', 130, 'g', 69, 0.5, 18, 0.1, ['fruta'], [], ['pera']),
  b('manga', 'Manga', 120, 'g', 77, 0.5, 19, 0.3, ['fruta'], [], ['manga']),
  b('melancia', 'Melancia', 200, 'g', 66, 1.2, 16, 0.2, ['fruta'], [], ['melancia', 'melao']),
  b('azeite', 'Azeite de oliva', 10, 'ml', 88, 0, 0, 10, ['gord'], [], ['azeite']),
  b('abacate', 'Abacate', 50, 'g', 80, 1, 4.5, 7.5, ['gord'], [], ['abacate']),
  b('amendoim', 'Amendoim', 20, 'g', 118, 5, 3, 10, ['gord'], ['amendoim'], ['amendoim']),
  b('pastaamendoim', 'Pasta de amendoim', 15, 'g', 94, 3.8, 3, 7.5, ['gord'], ['amendoim'], ['pasta de amendoim', 'manteiga de amendoim']),
  b('castanhas', 'Castanhas', 20, 'g', 130, 3, 3, 13, ['gord'], ['castanha'], ['castanha', 'nozes', 'amendoas']),
  b('chia', 'Chia', 15, 'g', 73, 2.5, 6, 4.6, ['gord'], [], ['chia', 'linhaca']),
  b('brocolis', 'Brócolis cozido', 100, 'g', 35, 3, 5, 0.4, ['leg'], [], ['brocolis', 'couve flor']),
  b('salada', 'Salada de folhas e tomate', 100, 'g', 20, 1, 4, 0.2, ['leg'], [], ['salada', 'alface', 'folhas', 'tomate']),
  b('abobrinha', 'Abobrinha refogada', 100, 'g', 25, 1.1, 4.3, 0.3, ['leg'], [], ['abobrinha', 'berinjela', 'chuchu']),
  b('cenoura', 'Cenoura cozida', 100, 'g', 30, 0.8, 6.7, 0.2, ['leg'], [], ['cenoura', 'beterraba', 'legumes']),
];
export const POR_ID: Record<string, Base> = Object.fromEntries(BASE.map((x) => [x.id, x]));

export const semAcento = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();

// Restrições citadas pelo aluno → etiquetas de alimentos que ele não pode comer.
export function restricoes(ob: Record<string, unknown>): Set<string> {
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

// Refeições do dia (nome e horário sugerido) pelo número de refeições do questionário.
export function refeicoesPadrao(ob: Record<string, unknown>): { nome: string; horario: string }[] {
  const nRaw = Number(ob.meals ?? ob.refeicoes ?? 4);
  const n = limita(Number.isFinite(nRaw) ? Math.round(nRaw) : 4, 3, 6);
  return ESQUEMAS[n].map(({ nome, horario }) => ({ nome, horario }));
}

// evitar = alimentos que o aluno marcou como "não quero mais no meu cardápio".
export function montarCardapio(ob: Record<string, unknown>, metas: Metas, dia: number = new Date().getDay(), evitar: string[] = []): Refeicao[] {
  const proibidas = restricoes(ob);
  const liberado = (id: string) => !evitar.includes(id) && !POR_ID[id].evita.some((t) => proibidas.has(t));
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
    itens: itens.map(({ alim, mult }) => porcaoDe(alim, mult)),
  }));
}

export function porcaoDe(alim: Base, mult: number): Alimento {
  return {
    id: alim.id,
    qtd: Math.round(alim.qtd * mult),
    nome: alim.nome,
    porcao: `${Math.round(alim.qtd * mult)} ${alim.un === 'un' ? (Math.round(alim.qtd * mult) === 1 ? 'unidade' : 'unidades') : alim.un}`,
    kcal: Math.round(alim.kcal * mult),
    p: Math.round(alim.p * mult * 10) / 10,
    c: Math.round(alim.c * mult * 10) / 10,
    g: Math.round(alim.g * mult * 10) / 10,
  };
}
