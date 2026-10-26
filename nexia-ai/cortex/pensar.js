'use strict';
// Modo Pensar: cadeia de raciocínio com conferência e autocorreção

const { modoValido } = require('./modos');
const { gerarPlano } = require('../orchestrator');
const { executarPasso } = require('../model-router');

/**
 * Função principal do modo Pensar
 * @param {Object} params - Parâmetros da execução
 * @param {string} params.prompt - Prompt do usuário
 * @param {string} params.modelo - Modelo de raciocínio (padrão: modelo gratuito)
 * @param {number} params.timeout - Timeout em ms (padrão: 40000)
 * @returns {Object} Resultado estruturado com histórico e status
 */
async function pensar(params) {
  const { prompt, modelo = 'gratuito', timeout = 40000 } = params;
  
  if (!prompt) {
    throw new Error('Prompt é obrigatório para o modo Pensar');
  }
  
  // Timeout global para toda a operação
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new Error('Timeout global de 40s excedido')), timeout);
  });
  
  const resultado = {
    modo: 'pensar',
    prompt,
    modelo,
    passos: [],
    certezas: [],
    voltas: 0,
    status: 'pendente',
    resposta: null,
    erro: null
  };
  
  let ultimaResposta = null;
  let tentativa = 0;
  const maxTentativas = 2;
  
  // Executa o modo Pensar com timeout global
  const resultadoOperacao = await Promise.race([
    (async () => {
      while (tentativa < maxTentativas) {
    tentativa++;
    resultado.voltas = tentativa;
    
    try {
      // 1. Geração de plano e resposta pelo modelo de raciocínio grátis
      const inicioPlano = Date.now();
      const plano = await gerarPlano({
        prompt,
        modelo,
        intent: 'reasoning',
        maxTokens: 0
      });
      
      const duracaoPlano = Date.now() - inicioPlano;
      
      // Executa o plano passo a passo
      const passosExecutados = [];
      let respostaFinal = null;
      
      for (const passo of plano.passos) {
        const inicioPasso = Date.now();
        const resultadoPasso = await executarPasso(passo);
        const duracaoPasso = Date.now() - inicioPasso;
        
        passosExecutados.push({
          id: passo.id || `passo-${passosExecutados.length + 1}`,
          tipo: passo.tipo || 'raciocinio',
          input: passo.input || prompt,
          output: resultadoPasso.output || null,
          duracao: duracaoPasso,
          sucesso: resultadoPasso.sucesso !== false,
          erro: resultadoPasso.erro || null
        });
        
        if (resultadoPasso.output) {
          respostaFinal = resultadoPasso.output;
        }
      }
      
      // 2. Conferência por um segundo modelo ou ferramentas
      const inicioConferencia = Date.now();
      const resultadoConferencia = await conferirResposta({
        prompt,
        resposta: respostaFinal,
        modelo: modelo === 'gratuito' ? 'gratuito' : 'gratuito',
        timeout: Math.max(10000, timeout - (Date.now() - inicioPlano))
      });
      
      const duracaoConferencia = Date.now() - inicioConferencia;
      
      // Registra passo da conferência
      passosExecutados.push({
        id: 'conferencia',
        tipo: 'conferencia',
        input: respostaFinal,
        output: resultadoConferencia.output,
        duracao: duracaoConferencia,
        sucesso: resultadoConferencia.ok,
        erro: resultadoConferencia.erro || null
      });
      
      // Adiciona ao histórico
      resultado.passos.push({
        tentativa,
        plano: {
          duracao: duracaoPlano,
          passos: plano.passos.length
        },
        passos: passosExecutados,
        conferencia: resultadoConferencia
      });
      
      // Calcula certeza geral
      const passosSucesso = passosExecutados.filter(p => p.sucesso).length;
      const certezaGeral = passosSucesso / passosExecutados.length;
      resultado.certezas.push(certezaGeral);
      
      // Se a conferência confirmou, termina com sucesso
      if (resultadoConferencia.ok) {
        resultado.status = 'sucesso';
        resultado.resposta = respostaFinal;
        return resultado;
      }
      
      // Se não passou na conferência e ainda tem tentativas, refaz
      if (tentativa < maxTentativas) {
        ultimaResposta = respostaFinal;
        continue;
      }
      
      // 3. Se esgotou as tentativas, retorna com baixa certeza
      resultado.status = 'falha';
      resultado.resposta = respostaFinal;
      resultado.erro = 'Falha na conferência após 2 tentativas';
      
    } catch (error) {
      resultado.passos.push({
        tentativa,
        erro: error.message,
        duracao: Date.now() - (passosExecutados[0]?.inicio || Date.now())
      });
      
      resultado.certezas.push(0);
      
      if (tentativa < maxTentativas) {
        continue;
      }
      
      resultado.status = 'erro';
      resultado.erro = error.message;
        }
      }
      return resultado;
    })(),
    timeoutPromise
  ]);
  
  return resultadoOperacao;
}

/**
 * Função de conferência usando execução isolada de código com timeout
 */
async function conferirResposta(params) {
  const { prompt, resposta, modelo, timeout = 10000 } = params;
  
  try {
    // Timeout wrapper
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Timeout na conferência')), timeout);
    });
    
    // Função de verificação isolada em new Function com timeout
    const verificarResposta = () => {
      return new Promise((resolve) => {
        // Timeout para a execução isolada
        const execTimeout = setTimeout(() => {
          resolve({ ok: false, output: 'Timeout na execução isolada', erro: 'Execução muito longa' });
        }, Math.min(timeout, 5000)); // Máximo 5s para execução isolada
        
        try {
          // Execução isolada do código de verificação
          const resultadoVerificacao = (new Function(
            'prompt', 'resposta',
            `
              // Verifica básica: resposta não vazia e contém conteúdo relevante
              if (!resposta || typeof resposta !== 'string' || resposta.trim().length < 10) {
                return { ok: false, output: 'Resposta vazia ou muito curta', erro: 'Resposta inválida' };
              }
              
              // Verificação de consistência: prompt e resposta devem ter relação
              const promptPalavras = prompt.toLowerCase().split(' ').filter(p => p.length > 2);
              const respostaPalavras = resposta.toLowerCase().split(' ').filter(r => r.length > 2);
              
              const palavrasComuns = promptPalavras.filter(p => respostaPalavras.includes(p));
              const consistencia = palavrasComuns.length / promptPalavras.length;
              
              if (consistencia < 0.1) {
                return { 
                  ok: false, 
                  output: 'Baixa consistência: resposta não parece relacionada ao prompt',
                  erro: 'Consistência insuficiente'
                };
              }
              
              // Verificação de estrutura básica
              if (!resposta.includes('.') && !resposta.includes('?') && !resposta.includes('!')) {
                return { 
                  ok: false, 
                  output: 'Resposta sem pontuação básica',
                  erro: 'Formato de resposta inválido'
                };
              }
              
              return { ok: true, output: 'Conferência passou', erro: null };
            `
          ))(prompt, resposta);
          
          clearTimeout(execTimeout);
          resolve(resultadoVerificacao);
        } catch (error) {
          clearTimeout(execTimeout);
          resolve({ ok: false, output: 'Erro na execução isolada: ' + error.message, erro: error.message });
        }
      });
    };
    
    // Executa com timeout
    const resultado = await Promise.race([verificarResposta(), timeoutPromise]);
    return resultado;
    
  } catch (error) {
    return { 
      ok: false, 
      output: error.message, 
      erro: error.message 
    };
  }
}

module.exports = { pensar };
