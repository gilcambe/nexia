'use strict';

// Script de vigilância para divulgação automática
// Detecta problemas e cria issues no GitHub quando necessário

const { Octokit } = require('@octokit/rest');
const sanitizeError = require('./lib/canais').sanitizeError;

// Configuração
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_REPOSITORY = process.env.GITHUB_REPOSITORY;
const ESTADO_BRANCH = 'divulga-dados';
const ESTADO_ARQUIVO = 'divulga-estado.json';
const MAX_ERROS_SEGUIDOS = 2;
const MAX_TEMPO_SEM_SUCESSO = 30 * 60 * 60 * 1000; // 30 horas em milissegundos
const ALERTA_LABEL = 'cortex-alerta';

// Inicializa Octokit
const octokit = new Octokit({ auth: GITHUB_TOKEN });

/**
 * Converte timestamp para objeto Date
 */
function parseTimestamp(timestamp) {
  if (!timestamp) return null;
  try {
    return new Date(timestamp);
  } catch (err) {
    console.error('Timestamp inválido:', timestamp, err);
    return null;
  }
}

/**
 * Converte erro sanitizado para mensagem amigável
 */
function sanitizeErrorMessage(error) {
  if (!error) return 'Erro desconhecido';
  
  // Sanitiza o erro primeiro
  const sanitized = sanitizeError(error);
  
  // Aplica regras específicas
  if (sanitized.includes('190')) {
    return 'rode de novo o configurar-meta.bat';
  }
  if (sanitized.includes('4') || sanitized.includes('17') || sanitized.includes('32')) {
    return 'espera sozinho';
  }
  if (sanitized.includes('mídia') || sanitized.includes('imagem')) {
    return 'imagem fora do padrão';
  }
  
  return sanitized;
}

/**
 * Busca o estado atual da divulgação
 */
async function buscarEstadoAtual() {
  try {
    const response = await octokit.rest.repos.getContent({
      owner: GITHUB_REPOSITORY.split('/')[0],
      repo: GITHUB_REPOSITORY.split('/')[1],
      path: ESTADO_ARQUIVO,
      ref: ESTADO_BRANCH
    });
    
    const content = Buffer.from(response.data.content, 'base64').toString('utf8');
    const dados = JSON.parse(content);
    
    // Processa o histórico para gerar estado atual
    const estadoAtual = processarHistorico(dados);
    return estadoAtual;
  } catch (err) {
    console.error('Erro ao buscar estado:', err);
    throw new Error(`Não foi possível ler o arquivo ${ESTADO_ARQUIVO} do branch ${ESTADO_BRANCH}`);
  }
}

/**
 * Processa o histórico para gerar estado atual de cada rede
 */
function processarHistorico(dados) {
  const estado = {
    redes: {}
  };
  
  // Pega os canais únicos do histórico
  const canais = new Set();
  dados.historico.forEach(entry => {
    if (entry.resultados) {
      entry.resultados.forEach(result => {
        canais.add(result.canal);
      });
    }
  });
  
  // Inicializa estado para cada canal
  canais.forEach(canal => {
    estado.redes[canal] = {
      canal: canal,
      status: 'desconhecido',
      ultima_tentativa: null,
      erros_consecutivos: 0,
      erro: null
    };
  });
  
  // Processa o histórico do mais recente para o mais antigo
  const resultadosOrdenados = [...dados.historico].sort((a, b) => 
    new Date(b.quando) - new Date(a.quando)
  );
  
  // Conta erros consecutivos
  const errosConsecutivos = {};
  canais.forEach(canal => {
    errosConsecutivos[canal] = 0;
  });
  
  // Encontra a última tentativa bem-sucedida para cada canal
  const ultimaSucesso = {};
  canais.forEach(canal => {
    ultimaSucesso[canal] = null;
  });
  
  resultadosOrdenados.forEach(entry => {
    const timestamp = new Date(entry.quando);
    
    entry.resultados.forEach(result => {
      const canal = result.canal;
      if (!estado.redes[canal]) return;
      
      // Atualiza última tentativa
      estado.redes[canal].ultima_tentativa = timestamp;
      
      if (result.ok) {
        // Se houve sucesso, zera contador de erros consecutivos
        errosConsecutivos[canal] = 0;
        estado.redes[canal].status = 'sucesso';
        estado.redes[canal].erro = null;
        
        // Atualiza última sucesso se for mais recente
        if (!ultimaSucesso[canal] || timestamp > ultimaSucesso[canal]) {
          ultimaSucesso[canal] = timestamp;
        }
      } else {
        // Se houve erro, incrementa contador
        errosConsecutivos[canal]++;
        estado.redes[canal].status = 'erro';
        estado.redes[canal].erro = result.erro || 'Erro desconhecido';
      }
    });
  });
  
  // Define os contadores finais de erros consecutivos
  canais.forEach(canal => {
    estado.redes[canal].erros_consecutivos = errosConsecutivos[canal];
    
    // Se não houve sucesso, define status como erro
    if (!ultimaSucesso[canal]) {
      estado.redes[canal].status = 'erro';
    }
  });
  
  return estado;
}

/**
 * Verifica se uma issue já existe para a rede
 */
async function existeIssueAberta(nomeRede) {
  try {
    const titulo = `Divulga parado: ${nomeRede}`;
    
    const response = await octokit.rest.issues.listForRepo({
      owner: GITHUB_REPOSITORY.split('/')[0],
      repo: GITHUB_REPOSITORY.split('/')[1],
      state: 'open',
      labels: ALERTA_LABEL,
      per_page: 100
    });
    
    return response.data.some(issue => issue.title === titulo);
  } catch (err) {
    console.error('Erro ao verificar issues existentes:', err);
    return false;
  }
}

/**
 * Cria uma nova issue de alerta
 */
async function criarIssueAlerta(nomeRede, erro, estado) {
  try {
    const titulo = `Divulga parado: ${nomeRede}`;
    const corpo = `🚨 **Alerta de Divulgação Parada** 🚨

**Rede:** ${nomeRede}
**Erro:** ${sanitizeErrorMessage(erro)}
**Timestamp do erro:** ${new Date().toISOString()}

### Detalhes:
- Status atual: ${estado.status}
- Última tentativa: ${new Date(estado.ultima_tentativa).toISOString()}
- Contador de erros: ${estado.erros_consecutivos || 0}

### Ações sugeridas:
- Verifique as credenciais da rede
- Confira a mídia/postagem
- Verifique a conexão com a API

### Recuperação:
- Quando a rede voltar a postar com sucesso, esta issue será fechada automaticamente.

---
*Este alerta foi gerado automaticamente pelo script de vigilância.*`;
    
    const response = await octokit.rest.issues.create({
      owner: GITHUB_REPOSITORY.split('/')[0],
      repo: GITHUB_REPOSITORY.split('/')[1],
      title: titulo,
      body: corpo,
      labels: [ALERTA_LABEL, 'divulgação', 'alerta']
    });
    
    console.log(`Issue criada: #${response.data.number}`);
    return response.data;
  } catch (err) {
    console.error('Erro ao criar issue:', err);
    throw err;
  }
}

/**
 * Fecha uma issue de alerta quando a rede se recuperar
 */
async function fecharIssueAlerta(nomeRede) {
  try {
    const titulo = `Divulga parado: ${nomeRede}`;
    
    const response = await octokit.rest.issues.listForRepo({
      owner: GITHUB_REPOSITORY.split('/')[0],
      repo: GITHUB_REPOSITORY.split('/')[1],
      state: 'open',
      labels: ALERTA_LABEL,
      per_page: 100
    });
    
    const issue = response.data.find(i => i.title === titulo);
    if (issue) {
      await octokit.rest.issues.update({
        owner: GITHUB_REPOSITORY.split('/')[0],
        repo: GITHUB_REPOSITORY.split('/')[1],
        issue_number: issue.number,
        state: 'closed'
      });
      
      console.log(`Issue fechada: #${issue.number}`);
      return issue;
    }
    return null;
  } catch (err) {
    console.error('Erro ao fechar issue:', err);
    throw err;
  }
}

/**
 * Verifica se houve sucesso na publicação
 */
function houveSucesso(estado) {
  if (!estado || !estado.ultima_tentativa) return false;
  
  const ultimaTentativa = parseTimestamp(estado.ultima_tentativa);
  if (!ultimaTentativa) return false;
  
  const tempoSemSucesso = Date.now() - ultimaTentativa.getTime();
  return tempoSemSucesso < MAX_TEMPO_SEM_SUCESSO && estado.status === 'sucesso';
}

/**
 * Verifica se houve sucesso na publicação nos últimos 30h
 */
function houveSucessoUltimas30h(estado) {
  if (!estado || !estado.ultima_tentativa) return false;
  
  const ultimaTentativa = parseTimestamp(estado.ultima_tentativa);
  if (!ultimaTentativa) return false;
  
  const tempoSemSucesso = Date.now() - ultimaTentativa.getTime();
  return tempoSemSucesso < MAX_TEMPO_SEM_SUCESSO;
}

/**
 * Verifica se há erro consecutivo
 */
function temErroConsecutivo(estado) {
  if (!estado || !estado.erros_consecutivos) return false;
  return estado.erros_consecutivos >= MAX_ERROS_SEGUIDOS;
}

/**
 * Função principal de verificação
 */
async function verificarRede(nomeRede, estado) {
  console.log(`Verificando rede: ${nomeRede}`);
  
  // Se a rede voltou a postar com sucesso, fecha a issue existente
  if (houveSucesso(estado)) {
    console.log(`Rede ${nomeRede} voltou a postar com sucesso`);
    try {
      await fecharIssueAlerta(nomeRede);
      return { acao: 'fechar_issue', rede: nomeRede };
    } catch (err) {
      console.error(`Erro ao fechar issue para ${nomeRede}:`, err);
    }
  }
  
  // Se há erro consecutivo ou não houve sucesso nos últimos 30h, cria alerta
  if (temErroConsecutivo(estado) || !houveSucessoUltimas30h(estado)) {
    console.log(`Rede ${nomeRede} precisa de alerta`);
    
    // Verifica se já existe issue
    const issueExiste = await existeIssueAberta(nomeRede);
    if (!issueExiste) {
      try {
        await criarIssueAlerta(nomeRede, estado.erro || 'Erro desconhecido', estado);
        return { acao: 'criar_issue', rede: nomeRede };
      } catch (err) {
        console.error(`Erro ao criar issue para ${nomeRede}:`, err);
      }
    }
  }
  
  return { acao: 'nenhuma', rede: nomeRede };
}

/**
 * Função principal
 */
async function main() {
  try {
    if (!GITHUB_TOKEN || !GITHUB_REPOSITORY) {
      throw new Error('GITHUB_TOKEN e GITHUB_REPOSITORY são obrigatórios');
    }
    
    console.log('Iniciando verificação de divulgação...');
    
    // Busca o estado atual
    const estado = await buscarEstadoAtual();
    console.log('Estado atual:', JSON.stringify(estado, null, 2));
    
    const resultados = [];
    
    // Verifica cada rede
    if (estado.redes) {
      for (const [nomeRede, dadosRede] of Object.entries(estado.redes)) {
        try {
          const resultado = await verificarRede(nomeRede, dadosRede);
          resultados.push(resultado);
        } catch (err) {
          console.error(`Erro ao verificar rede ${nomeRede}:`, err);
        }
      }
    }
    
    console.log('Resultados:', resultados);
    
    // Se não houver redes no estado, tenta a estrutura antiga
    if (!estado.redes && estado.rede) {
      try {
        const resultado = await verificarRede(estado.rede, estado);
        resultados.push(resultado);
      } catch (err) {
        console.error('Erro ao verificar rede única:', err);
      }
    }
    
    console.log('Verificação concluída');
    return resultados;
  } catch (err) {
    console.error('Erro na execução:', err);
    throw err;
  }
}

// Executa se for chamado diretamente
if (require.main === module) {
  main()
    .then(resultados => {
      console.log('Script executado com sucesso:', resultados);
      process.exit(0);
    })
    .catch(err => {
      console.error('Falha na execução:', err);
      process.exit(1);
    });
}

module.exports = { main, verificarRede, existeIssueAberta, criarIssueAlerta, fecharIssueAlerta };