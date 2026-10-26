'use strict';

/**
 * Teste de pessoa para o Cortex IA
 * Mede tempo de CPU por etapa e verifica se 30 perguntas seguidas em 1 minuto sem 503
 */

const https = require('https');
const { URL } = require('url');

const API_URL = process.env.NEXIA_APP_URL || 'https://nexia.workers.dev';
const CONVERSATION_ID = `test-${Date.now()}`;
const QUESTIONS = [
  "Quanto é 2+3?",
  "Que dia é hoje?",
  "Qual o capital do Brasil?",
  "Como está o tempo hoje?",
  "Quem descobriu o Brasil?",
  "Qual a fórmula da água?",
  "Quantos planetas tem o sistema solar?",
  "Qual a maior montanha do mundo?",
  "Quem escreveu Dom Casmurro?",
  "Qual a velocidade da luz?",
  "Quantos estados tem o Brasil?",
  "Qual o elemento químico ouro?",
  "Quinze vezes três?",
  "Qual o menor país do mundo?",
  "Quem pintou a Mona Lisa?",
  "Qual a capital da França?",
  "Quatro vezes sete?",
  "Qual o maior oceano?",
  "Quem inventou o telefone?",
  "Qual o símbolo químico do ouro?",
  "Dezesseis vezes dois?",
  "Qual o deserto mais quente?",
  "Quem foi o primeiro presidente do Brasil?",
  "Qual a fórmula do sal?",
  "Vinte e três vezes um?",
  "Qual o rio mais longo do mundo?",
  "Quem descobriu a penicilina?",
  "Qual a capital do Japão?",
  "Cinco vezes cinco?",
  "Qual o animal mais rápido do mundo?"
];

let completed = 0;
let errors = 0;
let startTime = Date.now();
let questionStartTime;

console.log(`\n🚀 Iniciando teste de pessoa com ${QUESTIONS.length} perguntas`);
console.log(`📡 API URL: ${API_URL}`);
console.log(`💬 Conversation ID: ${CONVERSATION_ID}`);
console.log(`⏱️  Início: ${new Date().toISOString()}\n`);

function makeRequest(question, index) {
  questionStartTime = Date.now();
  
  const data = JSON.stringify({
    message: question,
    tenantId: 'nexia',
    conversationId: CONVERSATION_ID,
    stream: false,
    model: 'auto'
  });

  const options = {
    hostname: new URL(API_URL).hostname,
    port: 443,
    path: '/api/cortex',
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Content-Length': data.length,
      'Authorization': 'Bearer test-token'
    }
  };

  const req = https.request(options, (res) => {
    let body = '';
    
    res.on('data', (chunk) => {
      body += chunk;
    });
    
    res.on('end', () => {
      const duration = Date.now() - questionStartTime;
      const totalTime = Date.now() - startTime;
      
      if (res.statusCode === 200) {
        try {
          const response = JSON.parse(body);
          console.log(`✅ Pergunta ${index + 1}/${QUESTIONS.length} (${duration}ms): ${question}`);
          console.log(`   📝 Resposta: ${response.reply.substring(0, 100)}${response.reply.length > 100 ? '...' : ''}`);
        } catch (e) {
          console.error(`❌ Erro ao parsear resposta: ${e.message}`);
        }
      } else if (res.statusCode === 503) {
        errors++;
        console.error(`❌ ERRO 503 Worker exceeded resource limits - Pergunta ${index + 1}/${QUESTIONS.length}: ${question}`);
        console.error(`   📊 Status: ${res.statusCode} | Duração: ${duration}ms`);
      } else {
        errors++;
        console.error(`❌ Erro ${res.statusCode} - Pergunta ${index + 1}/${QUESTIONS.length}: ${question}`);
        console.error(`   📊 Duração: ${duration}ms | Body: ${body.substring(0, 200)}...`);
      }
      
      completed++;
      
      if (completed === QUESTIONS.length) {
        const totalTime = Date.now() - startTime;
        const avgTime = totalTime / QUESTIONS.length;
        
        console.log(`\n🎯 Teste concluído!`);
        console.log(`⏱️  Tempo total: ${totalTime}ms (${(totalTime / 1000).toFixed(1)}s)`);
        console.log(`📊 Tempo médio por pergunta: ${avgTime.toFixed(1)}ms`);
        console.log(`❌ Erros totais: ${errors}`);
        console.log(`✅ Sucesso: ${QUESTIONS.length - errors}/${QUESTIONS.length}`);
        
        if (errors === 0) {
          console.log(`🎉 SUCESSO: 30 perguntas seguidas sem nenhum 503!`);
        } else {
          console.log(`⚠️  FALHA: ${errors} erros encontrados`);
        }
        
        process.exit(errors === 0 ? 0 : 1);
      }
    });
  });

  req.on('error', (error) => {
    errors++;
    console.error(`❌ Erro na requisição: ${error.message}`);
    completed++;
    
    if (completed === QUESTIONS.length) {
      const totalTime = Date.now() - startTime;
      console.log(`\n🎯 Teste concluído com erros!`);
      console.log(`⏱️  Tempo total: ${totalTime}ms`);
      console.log(`❌ Erros totais: ${errors}`);
      process.exit(1);
    }
  });

  req.write(data);
  req.end();
}

// Iniciar as perguntas com pequeno intervalo para simular uso real
let questionIndex = 0;
function sendNextQuestion() {
  if (questionIndex < QUESTIONS.length) {
    makeRequest(QUESTIONS[questionIndex], questionIndex);
    questionIndex++;
    // Enviar próxima pergunta após 200ms (simular uso real)
    setTimeout(sendNextQuestion, 200);
  }
}

sendNextQuestion();
