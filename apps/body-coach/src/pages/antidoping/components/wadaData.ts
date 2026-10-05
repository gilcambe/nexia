// Anti-Doping: cruzamento por regras com a lista de substâncias proibidas da WADA.
// Baseado nas classes do Código Mundial Antidopagem (categorias S0–S9, M1–M3, P1).
// IMPORTANTE: é uma triagem por palavras-chave, para orientação. Não substitui consulta
// com o médico do esporte nem verificação oficial (ex.: Global DRO / site da WADA).

export interface WadaCategory {
  code: string;
  name: string;
  examples: string[];
}

export const wadaCategories: WadaCategory[] = [
  { code: 'S0', name: 'Substâncias não aprovadas', examples: ['fármacos em pesquisa', 'SARMs não aprovados'] },
  { code: 'S1', name: 'Agentes anabolizantes', examples: ['esteroides', 'testosterona', 'nandrolona', 'SARMs', 'clenbuterol (anabolizante)'] },
  { code: 'S2', name: 'Hormônios peptídicos e fatores de crescimento', examples: ['EPO', 'hGH', 'IGF-1', 'insulina'] },
  { code: 'S3', name: 'Beta-2 agonistas', examples: ['salbutamol (via oral/injeta)', 'formoterol (acima do limite)'] },
  { code: 'S4', name: 'Moduladores hormonais e metabólicos', examples: ['tamoxifeno', 'anastrozol', 'HCG', 'DHEA'] },
  { code: 'S5', name: 'Diuréticos e agentes mascarantes', examples: ['furosemida', 'espironolactona'] },
  { code: 'S6', name: 'Estimulantes', examples: ['anfetamina', 'efedrina', 'sibutramina', 'DMAA', 'cocaína'] },
  { code: 'S7', name: 'Narcóticos', examples: ['morfina', 'heroína'] },
  { code: 'S8', name: 'Canabinoides', examples: ['THC', 'maconha'] },
  { code: 'S9', name: 'Glicocorticoides', examples: ['dexametasona', 'prednisona (algumas vias)'] },
  { code: 'P1', name: 'Beta-bloqueadores (esportes específicos)', examples: ['propranolol', 'metoprolol'] },
  { code: 'M1–M3', name: 'Manipulação (sangue, química, genética)', examples: ['transfusão', 'diluição', 'terapia gênica'] },
];

interface TermDef {
  term: string;
  aliases: string[];
  category: string;
}

const PROHIBITED: TermDef[] = [
  { term: 'Esteroides anabolizantes', aliases: ['esteroide', 'anabolizante', 'anabolico', 'testosterona', 'nandrolona', 'deca', 'trembolona', 'stanozolol', 'dianabol', 'oxandrolona', 'anavar', 'boldenona', 'durateston', 'primobolan', 'winstrol', 'masteron'], category: 'S1' },
  { term: 'SARMs', aliases: ['sarm', 'ostarine', 'ligandrol', 'rad140', 'rad-140', 'andarine', 'cardarine', 'gw1516', 'mk677', 'ibutamoren'], category: 'S1' },
  { term: 'Hormônios peptídicos', aliases: ['epo', 'eritropoetina', 'hgh', 'hormonio do crescimento', 'igf-1', 'igf1', 'insulina', 'mecasermina'], category: 'S2' },
  { term: 'Beta-2 agonista', aliases: ['clenbuterol', 'clembuterol'], category: 'S3' },
  { term: 'Modulador hormonal', aliases: ['tamoxifeno', 'anastrozol', 'letrozol', 'exemestano', 'clomifeno', 'hcg', 'gonadotrofina', 'dhea', 'dehidroepiandrosterona'], category: 'S4' },
  { term: 'Diurético / agente mascarante', aliases: ['diuretico', 'furosemida', 'espironolactona', 'hidroclorotiazida', 'mascarante', 'desintoxicante', 'detox'], category: 'S5' },
  { term: 'Estimulante', aliases: ['anfetamina', 'efedrina', 'sibutramina', 'dmma', 'metanfetamina', 'cocaina', 'modafinila', 'ritalina', 'metilfenidato', 'prorodol', 'tenuate'], category: 'S6' },
  { term: 'Narcótico', aliases: ['morfina', 'heroina', 'oxicodona', 'metadona'], category: 'S7' },
  { term: 'Canabinoide', aliases: ['thc', 'maconha', 'cannabis', 'haxixe', 'skunk'], category: 'S8' },
  { term: 'Glicocorticoide (algumas vias)', aliases: ['glicocorticoide', 'dexametasona', 'prednisona', 'prednisolona', 'betametasona'], category: 'S9' },
  { term: 'Beta-bloqueador', aliases: ['betabloqueador', 'beta bloqueador', 'propranolol', 'metoprolol', 'atenolol'], category: 'P1' },
];

const CAUTION: TermDef[] = [
  { term: 'Pré-treino / estimulante não declarado', aliases: ['pre-treino', 'pre treino', 'preworkout', 'pre workout', 'thermogenico', 'termogenico', 'queimador'], category: 'S6 (risco de DMAA/estimulantes escondidos)' },
  { term: 'Cafeína (monitorada, limite alto)', aliases: ['cafeina'], category: 'Monitorado — só vira problema acima do limite urinário' },
  { term: 'Tribulus / boosters "naturais"', aliases: ['tribulus', 'booster', 'testo booster', 'zma'], category: 'Permitido, mas eficácia não comprovada e risco de contaminação' },
  { term: 'Tramadol', aliases: ['tramadol'], category: 'Em monitoramento WADA — atenção em competição' },
  { term: 'Originários de farmácia sem receita', aliases: ['manipulado', 'injetavel'], category: 'Risco elevado de contaminação — exigir laudo do fabricante' },
];

const PERMITTED: TermDef[] = [
  { term: 'Whey / proteína', aliases: ['whey', 'proteina', 'albumina', 'caseina', 'bcaa', 'eaa', 'glutamina', 'aminoacido'], category: 'Proteínas e aminoácidos' },
  { term: 'Creatina', aliases: ['creatina', 'creatine'], category: 'Suplemento seguro e permitido' },
  { term: 'Beta-alanina', aliases: ['beta-alanina', 'beta alanina'], category: 'Permitido' },
  { term: 'Carboidratos', aliases: ['maltodextrina', 'dextrose', 'waxy maize', 'palatinose'], category: 'Permitido' },
  { term: 'Vitaminas / minerais', aliases: ['vitamina', 'multivitaminico', 'omega 3', 'omega-3', 'zinco', 'magnesio', 'vitamina d'], category: 'Permitido' },
  { term: 'Prebióticos / termogênicos suaves', aliases: ['probiotico', 'fibra', 'colageno'], category: 'Permitido' },
];

export type Verdict = 'proibido' | 'cuidado' | 'permitido' | 'desconhecido';

export interface CheckResult {
  status: Verdict;
  matched: string[];
  category: string | null;
  advice: string;
}

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function findMatches(text: string, list: TermDef[]): { hits: TermDef[] } {
  const norm = normalize(text);
  const hits = list.filter((d) => d.aliases.some((a) => norm.includes(normalize(a))));
  return { hits };
}

export function checkSubstance(raw: string): CheckResult {
  const text = raw.trim();
  if (!text) {
    return {
      status: 'desconhecido',
      matched: [],
      category: null,
      advice: 'Digite o nome do suplemento, do produto ou os ingredientes que estão na rotulagem.',
    };
  }

  const prohibited = findMatches(text, PROHIBITED);
  if (prohibited.hits.length > 0) {
    const category = prohibited.hits.map((h) => h.category).filter((v, i, arr) => arr.indexOf(v) === i).join(' · ');
    return {
      status: 'proibido',
      matched: prohibited.hits.map((h) => h.term),
      category,
      advice:
        'PROIBIDO como uso de substância dopante segundo o Código WADA. Não use este produto no esporte e consulte o médico do esporte. Se for tratamento legítimo, pode existir Autorização de Uso Terapêutico (AUT) — apenas um médico pode solicitar.',
    };
  }

  const caution = findMatches(text, CAUTION);
  if (caution.hits.length > 0) {
    return {
      status: 'cuidado',
      matched: caution.hits.map((h) => h.term),
      category: caution.hits.map((h) => h.category).join(' · '),
      advice:
        'Atenção: este item exige cuidado. Suplementos manipulados ou pré-treinos podem conter substâncias escondidas. Prefira produtos com selo de lote testado (ex.: Informed Sport) e guarde o laudo do fabricante.',
    };
  }

  const permitted = findMatches(text, PERMITTED);
  if (permitted.hits.length > 0) {
    return {
      status: 'permitido',
      matched: permitted.hits.map((h) => h.term),
      category: permitted.hits[0].category,
      advice: 'Ingrediente(s) permitido(s) pela WADA. Boas escolhas dentro de uma rotina de performance.',
    };
  }

  return {
    status: 'desconhecido',
    matched: [],
    category: null,
    advice:
      'Não encontrei esse item na minha base por regras. Isso NÃO significa que está liberado. Verifique no site oficial da WADA (Global DRO) ou com o farmacêutico/anti-doping antes de usar.',
  };
}

export const sampleSupplements = [
  'Whey protein isolado',
  'Creatina monoidratada',
  'Pré-treino explosivo',
  'BCAA',
  'Termogênico com DMAA',
  'Tribulus terrestris',
  'Multivitamínico',
  'Cafeína 200mg',
  'Anastrozol',
  'Detox / diurético',
];