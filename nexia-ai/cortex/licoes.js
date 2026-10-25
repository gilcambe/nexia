/**
 * Lições do Cortex em CommonJS
 * Sistema de aprendizado baseado em falhas repetidas
 */

const fs = require('fs');
const path = require('path');

const LICOES_FILE = path.join(__dirname, '../../../docs/cortex/licoes.md');
const MAX_LICOES = 30;

// Função pura para adicionar uma nova lição
function adicionarLicao(data, oqueFoiTentado, oqueDeuErrado, regraParaNaoRepetir) {
  const novaLicao = {
    data: data || new Date().toISOString().split('T')[0],
    oqueFoiTentado,
    oqueDeuErrado,
    regraParaNaoRepetir
  };
  
  // Lê lições existentes
  const licoes = lerLicoes();
  
  // Adiciona a nova lição
  licoes.unshift(novaLicao);
  
  // Limita ao máximo de lições (remove as mais antigas)
  const licoesLimitadas = licoes.slice(0, MAX_LICOES);
  
  // Salva as lições
  salvarLicoes(licoesLimitadas);
  
  return licoesLimitadas;
}

// Função pura para ler as lições
function lerLicoes() {
  try {
    if (!fs.existsSync(LICOES_FILE)) {
      return [];
    }
    
    const conteudo = fs.readFileSync(LICOES_FILE, 'utf8');
    const linhas = conteudo.split('\n');
    const licoes = [];
    let licaoAtual = null;
    
    for (const linha of linhas) {
      const match = linha.match(/^\s*-\s*Data:\s*(.+)$/);
      if (match) {
        if (licaoAtual) {
          licoes.push(licaoAtual);
        }
        licaoAtual = {
          data: match[1].trim(),
          oqueFoiTentado: '',
          oqueDeuErrado: '',
          regraParaNaoRepetir: ''
        };
      } else if (licaoAtual) {
        const oqueMatch = linha.match(/^\s*-\s*O que foi tentado:\s*(.+)$/);
        if (oqueMatch) {
          licaoAtual.oqueFoiTentado = oqueMatch[1].trim();
        }
        
        const erradoMatch = linha.match(/^\s*-\s*O que deu errado:\s*(.+)$/);
        if (erradoMatch) {
          licaoAtual.oqueDeuErrado = erradoMatch[1].trim();
        }
        
        const regraMatch = linha.match(/^\s*-\s*Regra para não repetir:\s*(.+)$/);
        if (regraMatch) {
          licaoAtual.regraParaNaoRepetir = regraMatch[1].trim();
        }
      }
    }
    
    if (licaoAtual) {
      licoes.push(licaoAtual);
    }
    
    return licoes;
  } catch (error) {
    console.error('[LICOES] Erro ao ler lições:', error.message);
    return [];
  }
}

// Função pura para salvar as lições
function salvarLicoes(licoes) {
  try {
    // Garante que o diretório existe
    const dir = path.dirname(LICOES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    let conteudo = '# Lições do Cortex\n\nEste arquivo armazena lições aprendidas pelo Cortex a partir de falhas repetidas.\n\n## Formato\nCada lição contém:\n- Data: quando a lição foi registrada\n- O que foi tentado: descrição da ação que falhou\n- O que deu errado: descrição do erro que se repetiu\n- Regra para não repetir: como evitar o erro no futuro\n\n## Lições\n\n';
    
    for (const licao of licoes) {
      conteudo += `- Data: ${licao.data}\n`;
      conteudo += `- O que foi tentado: ${licao.oqueFoiTentado}\n`;
      conteudo += `- O que deu errado: ${licao.oqueDeuErrado}\n`;
      conteudo += `- Regra para não repetir: ${licao.regraParaNaoRepetir}\n\n`;
    }
    
    fs.writeFileSync(LICOES_FILE, conteudo, 'utf8');
    return true;
  } catch (error) {
    console.error('[LICOES] Erro ao salvar lições:', error.message);
    return false;
  }
}

// Função pura para formatar lições para o prompt
function licoesParaPrompt(quantidade = 7) {
  const licoes = lerLicoes();
  const licoesRecentes = licoes.slice(0, Math.min(quantidade, licoes.length));
  
  if (licoesRecentes.length === 0) {
    return 'Nenhuma lição aprendida ainda.';
  }
  
  return licoesRecentes.map((licao, index) => {
    return `${index + 1}. [${licao.data}] ${licao.oqueFoiTentado} → ${licao.oqueDeuErrado}. Regra: ${licao.regraParaNaoRepetir}`;
  }).join('\n');
}

// Função pura para registrar lição de falha repetida
function registrarLicaoFalhaRepetida(tipoFalha, contexto) {
  const data = new Date().toISOString().split('T')[0];
  
  // Mapeia tipos de falha para mensagens padrão
  const mensagensPadrao = {
    'revisao-manual': {
      tentado: 'Implementação conforme análise do Architect',
      errado: 'Revisor humano marcou como requiring manual review',
      regra: 'Siga as diretrizes de código e documentação do projeto para evitar revisões manuais'
    },
    'ci-falha': {
      tentado: 'Implementação e submissão ao CI/CD',
      errado: 'Falha nos testes automatizados',
      regra: 'Verifique todos os testes e regras de qualidade antes de commitar'
    },
    'rejeicao-reviewer': {
      tentado: 'Implementação conforme especificação',
      errado: 'Reviewer Agent rejeitou as mudanças',
      regra: 'Atenda todos os pontos da revisão antes de submeter novamente'
    },
    'rejeicao-security': {
      tentado: 'Implementação funcional',
      errado: 'Security Agent rejeitou as mudanças',
      regra: 'Siga as práticas de segurança e evite vulnerabilidades conhecidas'
    }
  };
  
  const padrao = mensagensPadrao[tipoFalha] || {
    tentado: contexto || 'Execução da tarefa',
    errado: 'Falha repetida detectada',
    regra: 'Evite repetir o mesmo erro padrão'
  };
  
  return adicionarLicao(
    data,
    padrao.tentado,
    padrao.errado,
    padrao.regra
  );
}

module.exports = {
  LICOES: lerLicoes(),
  adicionarLicao,
  lerLicoes,
  salvarLicoes,
  licoesParaPrompt,
  registrarLicaoFalhaRepetida,
  MAX_LICOES
};
