'use strict';

const { listFor } = require('nexia-ai/model-router');
const { LICOES } = require('nexia-ai/orchestrator/licoes');
const { github } = require('nexia-ai/tool-gateway/tools/github');

/**
 * Calcula a similaridade entre duas frases com base na porcentagem de palavras compartilhadas
 * @param {string} frase1 - Primeira frase
 * @param {string} frase2 - Segunda frase
 * @returns {number} Porcentagem de similaridade (0-100)
 */
function calcularSimilaridade(frase1, frase2) {
  const palavras1 = frase1.toLowerCase().split(/\s+/).filter(p => p.length > 0);
  const palavras2 = frase2.toLowerCase().split(/\s+/).filter(p => p.length > 0);
  
  if (palavras1.length === 0 || palavras2.length === 0) return 0;
  
  const palavrasComuns = palavras1.filter(palavra => palavras2.includes(palavra));
  const totalPalavras = Math.max(palavras1.length, palavras2.length);
  
  return (palavrasComuns.length / totalPalavras) * 100;
}

/**
 * Verifica se uma lição já existe nas lições conhecidas
 * @param {string} novaLicao - Nova lição a ser verificada
 * @returns {boolean} True se já existe, false se for nova
 */
function verificarLicaoExistente(novaLicao) {
  for (const licaoExistente of LICOES) {
    const similaridade = calcularSimilaridade(novaLicao, licaoExistente);
    if (similaridade >= 60) {
      return true;
    }
  }
  return false;
}

/**
 * Monta o prompt para a IA gerar uma lição a partir de um issue e PR
 * @param {Object} issue - Objeto issue do GitHub
 * @param {Object} pr - Objeto pull request do GitHub
 * @returns {Promise<string>} Prompt formatado para a IA
 */
async function montarPedidoLicao(issue, pr) {
  const prompt = `Com base no seguinte issue e pull request, extraia uma lição aprendida curta e específica:

Issue:
- Título: ${issue.title}
- Corpo: ${issue.body || 'Sem descrição'}
- Labels: ${issue.labels ? issue.labels.map(l => l.name).join(', ') : 'Sem labels'}

Pull Request:
- Título: ${pr.title}
- Corpo: ${pr.body || 'Sem descrição'}
- Arquivos alterados: ${pr.files ? pr.files.map(f => f.filename).join(', ') : 'Sem arquivos'}

A lição deve:
1. Ser específica ao erro cometido
2. Ter no máximo 80 caracteres
3. Usar linguagem direta
4. Focar no que foi aprendido, não no que foi feito

Formato esperado: "[Erro]: [Solução correta]"`;
  
  return prompt;
}

/**
 * Gera uma nova lição usando a IA e a adiciona se for original
 * @param {Object} issue - Objeto issue do GitHub
 * @param {Object} pr - Objeto pull request do GitHub
 * @returns {Promise<string|null>} A lição gerada ou null se não for nova
 */
async function gerarEAdicionarLicao(issue, pr) {
  try {
    // Gerar prompt para a IA
    const prompt = await montarPedidoLicao(issue, pr);
    
    // Chamar a IA grátis (fast)
    const response = await listFor('fast', [
      {
        role: 'user',
        content: prompt
      }
    ], {
      max_tokens: 100,
      temperature: 0.3
    });
    
    const fraseGerada = response.content.trim();
    
    // Verificar se a lição já existe
    if (verificarLicaoExistente(fraseGerada)) {
      console.log('Lição já existe ou é muito similar:', fraseGerada);
      return null;
    }
    
    // Abrir issue cortex-fila com a nova lição
    const issueTitle = `Nova lição aprendida: ${fraseGerada.substring(0, 50)}...`;
    const issueBody = `Lição aprendida gerada automaticamente:

${fraseGerada}

Extraída do issue #${issue.number} e PR #${pr.number}.

Para adicionar ao livro de lições, copie esta linha e adicione ao final do arquivo nexia-ai/orchestrator/licoes.js:
\`\`\`
${fraseGerada}
\`\`\``;
    
    const newIssue = await github.createIssue({
      owner: issue.repository.owner.login,
      repo: issue.repository.name,
      title: issueTitle,
      body: issueBody,
      labels: ['cortex-fila', 'lição-aprendida']
    });
    
    console.log('Nova lição criada na issue:', newIssue.html_url);
    return fraseGerada;
    
  } catch (error) {
    console.error('Erro ao gerar lição:', error.message);
    return null;
  }
}

// Exportar a função pura
module.exports = {
  montarPedidoLicao,
  gerarEAdicionarLicao,
  calcularSimilaridade,
  verificarLicaoExistente
};

// Execução automática quando o script é chamado diretamente
if (require.main === module) {
  (async () => {
    console.log('Script de lição automática executado');
    
    // Exemplo de uso - pode ser adaptado para receber parâmetros reais
    const exemploIssue = {
      number: 123,
      title: 'Exemplo de issue com erro de importação',
      body: 'Tentei usar router.complete que não existe',
      labels: [{ name: 'bug' }],
      repository: {
        owner: { login: 'gilcambe' },
        name: 'nexia'
      }
    };
    
    const exemploPR = {
      number: 456,
      title: 'Corrigir importação do router',
      body: 'Trocar router.complete por router.chat',
      files: [{ filename: 'src/router.js' }]
    };
    
    try {
      const licao = await gerarEAdicionarLicao(exemploIssue, exemploPR);
      if (licao) {
        console.log('Nova lição gerada:', licao);
      } else {
        console.log('Nenhuma lição nova gerada');
      }
    } catch (error) {
      console.error('Erro na execução:', error.message);
    }
  })();
}