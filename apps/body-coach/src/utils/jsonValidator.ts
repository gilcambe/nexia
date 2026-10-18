// Validador de JSON de resposta da avaliação por foto (Body Coach)
// Suporta 4 tipos: suplemento, tabelaNutricional, refeicao, exameSangue
// Apenas serviços grátis: Gemini (visão) com reserva Workers AI.

export type AvaliacaoTipo =
  | 'suplemento'
  | 'tabelaNutricional'
  | 'refeicao'
  | 'exameSangue';

export interface PontoAvaliacao {
  texto: string;
  tipo: 'bom' | 'ruim';
}

export interface AvaliacaoSuplemento {
  tipo: 'suplemento';
  nome: string;
  marca: string;
  dosePorPorcao: string;
  proteinaPorPorcao?: number; // gramas
  preco?: number; // R$
  pesoGramas?: number; // g do produto, para custo por g de proteina
  custoPorGProteina?: number; // R$ por g de proteina, calculado se preço e peso informados
  pontosBons: PontoAvaliacao[];
  pontosRuins: PontoAvaliacao[];
  recomendacaoObjetivo: string;
  objetivoUsuario?: string;
}

export interface ValorNutricional {
  nutriente: string;
  quantidade: number;
  unidade: string;
  valorDiario?: number; // %VD
}

export interface AvaliacaoTabelaNutricional {
  tipo: 'tabelaNutricional';
  produto: string;
  porcao: string; // ex: "30 g"
  porcaoGramas: number;
  porPorcao: ValorNutricional[];
  por100g: ValorNutricional[];
  adicionarADieta: boolean; // acionado pelo botão "adicionar à dieta de hoje"
}

export interface AvaliacaoRefeicao {
  tipo: 'refeicao';
  nome: string;
  descricao: string;
  ingredientes: string[];
  porcaoEstimadaGramas?: number;
  macrosEstimados?: {
    calorias?: number;
    proteinaG?: number;
    carboidratoG?: number;
    gorduraG?: number;
  };
  adicionarADieta: boolean;
}

export interface ValorForaFaixa {
  exame: string;
  valor: string;
  faixaReferencia: string;
  status: 'baixo' | 'alto';
  explicacao: string;
}

export interface AvaliacaoExameSangue {
  tipo: 'exameSangue';
  valoresForaFaixa: ValorForaFaixa[];
  resumo: string;
  recomendacaoMedica: string;
}

export type AvaliacaoJSON =
  | AvaliacaoSuplemento
  | AvaliacaoTabelaNutricional
  | AvaliacaoRefeicao
  | AvaliacaoExameSangue;

export interface ValidacaoResultado<T extends AvaliacaoJSON = AvaliacaoJSON> {
  valido: boolean;
  tipo?: AvaliacaoTipo;
  dados?: T;
  erros: string[];
}

// Schemas obrigatórios por tipo
const CAMPOS_OBRIGATORIOS: Record<AvaliacaoTipo, string[]> = {
  suplemento: ['tipo', 'nome', 'marca', 'dosePorPorcao', 'pontosBons', 'pontosRuins', 'recomendacaoObjetivo'],
  tabelaNutricional: ['tipo', 'produto', 'porcao', 'porcaoGramas', 'porPorcao', 'por100g'],
  refeicao: ['tipo', 'nome', 'descricao', 'ingredientes'],
  exameSangue: ['tipo', 'valoresForaFaixa', 'resumo', 'recomendacaoMedica'],
};

function temTipo(valor: unknown): valor is { tipo: AvaliacaoTipo } {
  return typeof valor === 'object' && valor !== null && 'tipo' in valor &&
    (valor as { tipo: string }).tipo in CAMPOS_OBRIGATORIOS;
}

// Valida campos obrigatórios presenciais e não vazios
function camposObrigatoriosPresentes(
  dados: unknown,
  tipo: AvaliacaoTipo
): string[] {
  const obrigatorios = CAMPOS_OBRIGATORIOS[tipo];
  const obj = dados as Record<string, unknown>;
  const erros: string[] = [];

  for (const campo of obrigatorios) {
    const valor = obj[campo];
    if (valor === undefined || valor === null) {
      erros.push(`Campo obrigatório ausente: ${campo}`);
      continue;
    }
    if (typeof valor === 'string' && valor.trim() === '') {
      erros.push(`Campo obrigatório vazio: ${campo}`);
    }
    if (Array.isArray(valor) && valor.length === 0) {
      erros.push(`Campo obrigatório vazio (array): ${campo}`);
    }
  }
  return erros;
}

function validarSuplemento(
  dados: unknown
): ValidacaoResultado<AvaliacaoSuplemento> {
  const erros = camposObrigatoriosPresentes(dados, 'suplemento');
  const obj = dados as Record<string, unknown>;

  if (obj.pontosBons && Array.isArray(obj.pontosBons)) {
    for (const p of obj.pontosBons as unknown[]) {
      const pp = p as Record<string, unknown>;
      if (!pp.texto || typeof pp.texto !== 'string') {
        erros.push('pontosBons: item sem texto');
      }
      if (pp.tipo !== 'bom') {
        erros.push('pontosBons: tipo deve ser "bom"');
      }
    }
  }
  if (obj.pontosRuins && Array.isArray(obj.pontosRuins)) {
    for (const p of obj.pontosRuins as unknown[]) {
      const pp = p as Record<string, unknown>;
      if (!pp.texto || typeof pp.texto !== 'string') {
        erros.push('pontosRuins: item sem texto');
      }
      if (pp.tipo !== 'ruim') {
        erros.push('pontosRuins: tipo deve ser "ruim"');
      }
    }
  }

  // Custo por g de proteína só se preço e peso informados
  let custoPorGProteina: number | undefined;
  if (typeof obj.preco === 'number' && typeof obj.pesoGramas === 'number' && obj.pesoGramas > 0 && typeof obj.proteinaPorPorcao === 'number' && obj.proteinaPorPorcao > 0) {
    // proteinaPorPorcao em g; preco em R$ pelo pacote de pesoGramas
    const proteinaTotalG = (obj.proteinaPorPorcao / (obj.dosePorPorcao ? Number(obj.dosePorPorcao) : 1)) * obj.pesoGramas;
    // simplificação: usa proteinaPorPorcao direta se dose não for número
    const proteinaG = typeof obj.proteinaPorPorcao === 'number' ? obj.proteinaPorPorcao : 0;
    if (proteinaG > 0) {
      custoPorGProteina = obj.preco / proteinaG;
    }
  }

  if (erros.length > 0) {
    return { valido: false, tipo: 'suplemento', erros };
  }

  return {
    valido: true,
    tipo: 'suplemento',
    dados: {
      tipo: 'suplemento',
      nome: String(obj.nome),
      marca: String(obj.marca),
      dosePorPorcao: String(obj.dosePorPorcao),
      ...(typeof obj.proteinaPorPorcao === 'number' && { proteinaPorPorcao: obj.proteinaPorPorcao }),
      ...(typeof obj.preco === 'number' && { preco: obj.preco }),
      ...(typeof obj.pesoGramas === 'number' && { pesoGramas: obj.pesoGramas }),
      ...(custoPorGProteina !== undefined && { custoPorGProteina }),
      pontosBons: (obj.pontosBons as PontoAvaliacao[]).filter((p): p is PontoAvaliacao => typeof (p as Record<string, unknown>).texto === 'string' && (p as Record<string, unknown>).tipo === 'bom'),
      pontosRuins: (obj.pontosRuins as PontoAvaliacao[]).filter((p): p is PontoAvaliacao => typeof (p as Record<string, unknown>).texto === 'string' && (p as Record<string, unknown>).tipo === 'ruim'),
      recomendacaoObjetivo: String(obj.recomendacaoObjetivo),
      ...(typeof obj.objetivoUsuario === 'string' && { objetivoUsuario: obj.objetivoUsuario }),
    } as AvaliacaoSuplemento,
    erros: [],
  };
}

function validarTabelaNutricional(
  dados: unknown
): ValidacaoResultado<AvaliacaoTabelaNutricional> {
  const erros = camposObrigatoriosPresentes(dados, 'tabelaNutricional');
  const obj = dados as Record<string, unknown>;

  if (erros.length > 0) {
    return { valido: false, tipo: 'tabelaNutricional', erros };
  }

  const porPorcao = (obj.porPorcao as unknown[]).map((v, i) => {
    const vv = v as Record<string, unknown>;
    return {
      nutriente: String(vv.nutriente || ''),
      quantidade: typeof vv.quantidade === 'number' ? vv.quantidade : Number(vv.quantidade) || 0,
      unidade: String(vv.unidade || ''),
      ...(typeof vv.valorDiario === 'number' && { valorDiario: vv.valorDiario }),
    };
  });

  const por100g = (obj.por100g as unknown[]).map((v, i) => {
    const vv = v as Record<string, unknown>;
    return {
      nutriente: String(vv.nutriente || ''),
      quantidade: typeof vv.quantidade === 'number' ? vv.quantidade : Number(vv.quantidade) || 0,
      unidade: String(vv.unidade || ''),
      ...(typeof vv.valorDiario === 'number' && { valorDiario: vv.valorDiario }),
    };
  });

  return {
    valido: true,
    tipo: 'tabelaNutricional',
    dados: {
      tipo: 'tabelaNutricional',
      produto: String(obj.produto),
      porcao: String(obj.porcao),
      porcaoGramas: typeof obj.porcaoGramas === 'number' ? obj.porcaoGramas : Number(obj.porcaoGramas) || 0,
      porPorcao,
      por100g,
      adicionarADieta: false,
    } as AvaliacaoTabelaNutricional,
    erros: [],
  };
}

function validarRefeicao(
  dados: unknown
): ValidacaoResultado<AvaliacaoRefeicao> {
  const erros = camposObrigatoriosPresentes(dados, 'refeicao');
  const obj = dados as Record<string, unknown>;

  if (erros.length > 0) {
    return { valido: false, tipo: 'refeicao', erros };
  }

  const ingredientes = (obj.ingredientes as unknown[]).map((i) => String(i));

  return {
    valido: true,
    tipo: 'refeicao',
    dados: {
      tipo: 'refeicao',
      nome: String(obj.nome),
      descricao: String(obj.descricao),
      ingredientes,
      ...(typeof obj.porcaoEstimadaGramas === 'number' && { porcaoEstimadaGramas: obj.porcaoEstimadaGramas }),
      adicionarADieta: false,
    } as AvaliacaoRefeicao,
    erros: [],
  };
}

function validarExameSangue(
  dados: unknown
): ValidacaoResultado<AvaliacaoExameSangue> {
  const erros = camposObrigatoriosPresentes(dados, 'exameSangue');
  const obj = dados as Record<string, unknown>;

  if (erros.length > 0) {
    return { valido: false, tipo: 'exameSangue', erros };
  }

  const valoresForaFaixa = (obj.valoresForaFaixa as unknown[]).map((v) => {
    const vv = v as Record<string, unknown>;
    return {
      exame: String(vv.exame || ''),
      valor: String(vv.valor || ''),
      faixaReferencia: String(vv.faixaReferencia || ''),
      status: (vv.status === 'baixo' || vv.status === 'alto') ? (vv.status as 'baixo' | 'alto') : 'alto',
      explicacao: String(vv.explicacao || ''),
    };
  });

  // Exame de sangue: só explicar valores fora da faixa e sugerir levar ao médico
  return {
    valido: true,
    tipo: 'exameSangue',
    dados: {
      tipo: 'exameSangue',
      valoresForaFaixa,
      resumo: String(obj.resumo),
      recomendacaoMedica: String(obj.recomendacaoMedica || 'Leve este resultado ao médico ou nutricionista para avaliação profissional. Esta avaliação é apenas educativa e não substitui consulta médica.') as string,
    } as AvaliacaoExameSangue,
    erros: [],
  };
}

// Função principal: valida JSON de avaliação por tipo
// dados pode ser objeto já parseado ou string JSON
export function validarAvaliacaoJSON(
  dados: unknown,
  tipo?: AvaliacaoTipo
): ValidacaoResultado {
  let objeto: unknown;

  if (typeof dados === 'string') {
    try {
      objeto = JSON.parse(dados);
    } catch (e) {
      return { valido: false, erros: ['JSON inválido: não foi possível fazer parse'] };
    }
  } else {
    objeto = dados;
  }

  if (!objeto || typeof objeto !== 'object' || Array.isArray(objeto)) {
    return { valido: false, erros: ['O payload deve ser um objeto JSON'] };
  }

  const tipoDetectado = tipo || (temTipo(objeto) ? objeto.tipo : undefined);

  if (!tipoDetectado || !(tipoDetectado in CAMPOS_OBRIGATORIOS)) {
    return {
      valido: false,
      erros: [`Tipo de avaliação não informado ou inválido. Valores aceitos: ${Object.keys(CAMPOS_OBRIGATORIOS).join(', ')}`],
    };
  }

  switch (tipoDetectado) {
    case 'suplemento':
      return validarSuplemento(objeto);
    case 'tabelaNutricional':
      return validarTabelaNutricional(objeto);
    case 'refeicao':
      return validarRefeicao(objeto);
    case 'exameSangue':
      return validarExameSangue(objeto);
    default:
      return { valido: false, erros: ['Tipo de avaliação não suportado'] };
  }
}

// Valida se um objeto já está tipado como AvaliacaoJSON (type guard)
export function isAvaliacaoJSON(valor: unknown): valor is AvaliacaoJSON {
  return typeof valor === 'object' && valor !== null && 'tipo' in valor &&
    (valor as { tipo: string }).tipo in CAMPOS_OBRIGATORIOS;
}