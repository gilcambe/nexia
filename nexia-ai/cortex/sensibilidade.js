/**
 * Módulo de sensibilidade do Cortex NEXIA.
 * Verifica se um texto contém palavras-chave sensíveis (saúde, direito, finanças).
 */

const PALAVRAS_CHAVE_SENSIVEIS = [
  // Saúde
  'saúde', 'medico', 'médico', 'medicina', 'hospital', 'doença', 'cancer', 'câncer',
  'tumor', 'tratamento', 'sintoma', 'diagnostico', 'diagnóstico', 'remedio', 'remédio',
  'farmaco', 'fármaco', 'medicamento', 'cirurgia', 'exame', 'paciente', 'psiquiatria',
  'psicologia', 'terapia', 'cardiologia', 'oncologia', 'pediatria', 'neurologia',

  // Direito / Jurídico
  'direito', 'jurisprudencia', 'jurisprudência', 'lei', 'artigo', 'codigo', 'código',
  'processo', 'juiz', 'tribunal', 'stf', 'stj', 'trf', 'tjsp', 'advogado', 'advocacia',
  'defensoria', 'promotor', 'ministerio publico', 'ministério público', 'sentenca',
  'sentença', 'acordao', 'acórdão', 'peticao', 'petição', 'habeas corpus', 'mandado',
  'inquerito', 'inquérito', 'licitacao', 'licitação', 'contrato', 'clausula', 'cláusula',

  // Finanças / Investimentos
  'financas', 'finanças', 'financeiro', 'investimento', 'investir', 'renda', 'rendimento',
  'acoes', 'ações', 'fii', 'fiis', 'cdb', 'tesouro direto', 'criptomoeda', 'bitcoin',
  'bolsa de valores', 'b3', 'dividendos', 'juros', 'inflacao', 'inflação', 'taxa selic',
  'banco', 'emprestimo', 'empréstimo', 'financiamento', 'cartao de credito', 'cartão de crédito',
  'imposto', 'receita federal', 'declaracao', 'declaração', 'patrimonio', 'patrimônio',
  'poupanca', 'poupança', 'previdencia', 'previdência', 'corretora'
];

/**
 * Normaliza o texto removendo acentos e convertendo para minúsculas para comparação robusta.
 * @param {string} str 
 * @returns {string}
 */
function normalizar(str) {
  if (!str || typeof str !== 'string') return '';
  return str
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

/**
 * Verifica se o texto contém palavras-chave de saúde, direito ou finanças.
 * @param {string} texto - O texto a ser analisado.
 * @returns {boolean} True se contiver termos sensíveis, false caso contrário.
 */
function ehSensivel(texto) {
  if (!texto || typeof texto !== 'string') {
    return false;
  }

  const textoNormalizado = normalizar(texto);

  // Verifica cada palavra-chave (também normalizada)
  for (const termo of PALAVRAS_CHAVE_SENSIVEIS) {
    const termoNormalizado = normalizar(termo);
    
    // Verifica correspondência por palavra inteira ou substring relevante
    // Usamos expressão regular para garantir correspondência de palavra inteira em termos simples
    // ou inclusão direta para termos compostos.
    const regex = new RegExp(`\\b${termoNormalizado.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    
    if (regex.test(textoNormalizado) || textoNormalizado.includes(termoNormalizado)) {
      return true;
    }
  }

  return false;
}

module.exports = {
  ehSensivel,
  PALAVRAS_CHAVE_SENSIVEIS
};
