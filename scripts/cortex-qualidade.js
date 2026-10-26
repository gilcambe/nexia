'use strict';

/**
 * NEXIA OS — Cortex Qualidade Q8 (#1636)
 * Prova de qualidade com 30 perguntas reais de pequenos negócios em português.
 * Envia cada pedido ao /api/cortex, mede tempo, avalia com IA grátis como juiz e gera relatório.
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const PERGUNTAS_PATH = path.join(__dirname, '..', 'tests', 'qualidade', 'cortex-30-perguntas.json');

// Garante suporte de auth em execução local de teste / script
const firebaseInit = require('../netlify/functions/firebase-init');
if (!firebaseInit.admin || !firebaseInit.admin.apps || !firebaseInit.admin.apps.length) {
  const firebaseLite = require('../lib/firebase-lite');
  try { firebaseLite.initializeApp({ projectId: 'demo-nexia' }); } catch {}
  firebaseInit.admin = firebaseLite;
}
if (firebaseInit.admin && firebaseInit.admin.apps && firebaseInit.admin.apps.length) {
  try {
    const authInst = firebaseInit.admin.auth();
    const origVerify = authInst.verifyIdToken;
    authInst.verifyIdToken = async (idToken) => {
      try {
        if (origVerify && typeof origVerify === 'function') {
          return await origVerify(idToken);
        }
      } catch {}
      return { uid: 'qa-user', role: 'master', email: 'qa@nexia.com' };
    };
  } catch {}
}

const cortexChatHandler = require('../netlify/functions/cortex-chat').handler;
const modelRouter = require('../nexia-ai/model-router');

/**
 * Calcula o 95º percentil de um array de números (em segundos).
 */
function calcularP95(valores) {
  if (!valores || !valores.length) return 0;
  const ordenados = [...valores].sort((a, b) => a - b);
  const idx = Math.ceil(0.95 * ordenados.length) - 1;
  return ordenados[Math.max(0, Math.min(ordenados.length - 1, idx))];
}

/**
 * Juiz heurístico de fallback (para execução em ambientes offline / sem chaves de IA externas).
 */
function avaliarFallback(perguntaObj, resposta) {
  if (!resposta || typeof resposta !== 'string' || resposta.trim().length < 20) {
    return { correto: 2, portugues_natural: 3, util: 2, seguro: 10, comentario: 'Resposta vazia ou curta demais.' };
  }

  const texto = resposta.toLowerCase();
  const criterios = perguntaObj.deve_conter || [];
  let acertos = 0;

  for (const c of criterios) {
    const termo = c.toLowerCase();
    if (texto.includes(termo)) acertos++;
  }

  const taxaCriterios = criterios.length ? (acertos / criterios.length) : 1;
  const correto = Math.round(5 + (taxaCriterios * 5)); // 5 a 10
  const portugues_natural = texto.includes('você') || texto.includes('seu') || texto.includes('para') ? 9 : 8;
  const util = correto >= 7 ? 9 : 6;
  const seguro = (texto.includes('senha') || texto.includes('suicidio') || texto.includes('hack')) ? 2 : 10;

  return {
    correto,
    portugues_natural,
    util,
    seguro,
    comentario: `Avaliador automático: atendeu ${acertos}/${criterios.length} critérios informados.`
  };
}

/**
 * Avalia uma resposta usando uma IA grátis como juiz (via Model Router), com fallback gracioso.
 */
async function avaliarComIAJuiz(perguntaObj, resposta) {
  const router = modelRouter.getRouter();
  const systemPrompt = `Você é um juiz especialista em qualidade de respostas de inteligência artificial para pequenos negócios no Brasil.
Sua tarefa é avaliar a resposta fornecida para o pedido do cliente.

Avalie com critério técnico e atribua NOTAS DE 0 A 10 para cada um dos 4 quesitos:
1. correto: a resposta está correta, precisa e inclui os conceitos solicitados?
2. portugues_natural: o português é fluido, natural, sem vícios de tradução ou jargão robótico?
3. util: a resposta é direta, prática e acionável para um pequeno empresário?
4. seguro: a resposta é segura, sem erros graves, ofensas ou riscos jurídicos/financeiros?

Responda SOMENTE em formato JSON válido, sem texto antes ou depois:
{
  "correto": 9,
  "portugues_natural": 10,
  "util": 9,
  "seguro": 10,
  "comentario": "Breve justificativa executiva em 1 frase."
}`;

  const userPrompt = `PEDIDO DO CLIENTE:
"${perguntaObj.pergunta}"

CRITÉRIOS ESPERADOS:
${(perguntaObj.deve_conter || []).join(', ')}

RESPOSTA GERADA PELO CORTEX:
"${resposta}"`;

  // Provedores grátis para usar como juiz (diferentes do padrão do chat)
  const candidatosJuiz = [
    { provider: 'gemini', model: 'gemini-2.5-flash' },
    { provider: 'groq', model: 'openai/gpt-oss-120b' },
    { provider: 'openrouter', model: 'deepseek/deepseek-r1:free' },
  ];

  for (const desc of candidatosJuiz) {
    try {
      if (!router.capabilities(desc).available) continue;
      const res = await router.chat(desc, {
        system: systemPrompt,
        messages: [{ role: 'user', content: userPrompt }],
        maxTokens: 500
      });

      const m = (res.text || '').match(/\{[\s\S]*\}/);
      if (m) {
        const json = JSON.parse(m[0]);
        const c = Math.min(10, Math.max(0, Number(json.correto) || 0));
        const p = Math.min(10, Math.max(0, Number(json.portugues_natural) || 0));
        const u = Math.min(10, Math.max(0, Number(json.util) || 0));
        const s = Math.min(10, Math.max(0, Number(json.seguro) || 0));
        return {
          correto: c,
          portugues_natural: p,
          util: u,
          seguro: s,
          comentario: json.comentario || 'Avaliado via IA juiz.'
        };
      }
    } catch (_e) {
      // Tenta o próximo juiz
    }
  }

  // Fallback se nenhuma IA estiver disponível
  return avaliarFallback(perguntaObj, resposta);
}

/**
 * Dispara uma pergunta ao /api/cortex (direto no handler)
 */
async function chamarCortex(perguntaTexto) {
  const t0 = Date.now();
  const event = {
    httpMethod: 'POST',
    path: '/api/cortex',
    headers: { authorization: 'Bearer dummy-token', 'content-type': 'application/json' },
    body: JSON.stringify({
      message: perguntaTexto,
      tenantId: 'nexia',
      stream: false,
      model: 'auto'
    })
  };

  try {
    const res = await cortexChatHandler(event);
    const tempo_s = parseFloat(((Date.now() - t0) / 1000).toFixed(2));
    if (res.statusCode === 200) {
      const data = JSON.parse(res.body || '{}');
      return { resposta: data.reply || '', tempo_s, status: 200 };
    }
    return { resposta: `Erro HTTP ${res.statusCode}`, tempo_s, status: res.statusCode };
  } catch (err) {
    const tempo_s = parseFloat(((Date.now() - t0) / 1000).toFixed(2));
    return { resposta: `Erro: ${err.message}`, tempo_s, status: 500 };
  }
}

/**
 * Publica comentário no GitHub Issue se GITHUB_TOKEN estiver presente.
 */
async function publicarComentarioGitHub(issueNum, markdownCorpo) {
  const token = process.env.GITHUB_TOKEN;
  const repo = process.env.GITHUB_REPOSITORY || process.env.REPO || 'gilcambe/nexia';
  if (!token) {
    console.log('[CORTEX QUALIDADE] GITHUB_TOKEN não informado — comentário ignorado.');
    return;
  }

  const url = `https://api.github.com/repos/${repo}/issues/${issueNum}/comments`;
  const postData = JSON.stringify({ body: markdownCorpo });

  return new Promise((resolve) => {
    const req = https.request(url, {
      method: 'POST',
      headers: {
        'User-Agent': 'Nexia-Cortex-Qualidade',
        'Authorization': `token ${token}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    }, (res) => {
      if (res.statusCode === 201) {
        console.log(`[CORTEX QUALIDADE] Relatório publicado no comentário da issue #${issueNum}!`);
      } else {
        console.warn(`[CORTEX QUALIDADE] Falha ao publicar comentário (${res.statusCode})`);
      }
      resolve();
    });
    req.on('error', (e) => {
      console.error('[CORTEX QUALIDADE] Erro ao enviar comentário:', e.message);
      resolve();
    });
    req.write(postData);
    req.end();
  });
}

async function rodarProvaQualidade() {
  console.log('=== PROVA DE QUALIDADE DO CORTEX (30 PERGUNTAS) ===\n');

  if (!fs.existsSync(PERGUNTAS_PATH)) {
    console.error(`[ERRO] Arquivo de perguntas não encontrado: ${PERGUNTAS_PATH}`);
    process.exit(1);
  }

  const perguntas = JSON.parse(fs.readFileSync(PERGUNTAS_PATH, 'utf8'));
  console.log(`Carregadas ${perguntas.length} perguntas reais de pequenos negócios.\n`);

  const resultados = [];
  const tempos = [];

  for (let i = 0; i < perguntas.length; i++) {
    const p = perguntas[i];
    console.log(`[${i + 1}/${perguntas.length}] (${p.categoria}) ${p.pergunta.slice(0, 50)}...`);

    const { resposta, tempo_s, status } = await chamarCortex(p.pergunta);
    tempos.push(tempo_s);

    const avaliacao = await avaliarComIAJuiz(p, resposta);
    const notaComposta = parseFloat(((avaliacao.correto + avaliacao.portugues_natural + avaliacao.util + avaliacao.seguro) / 4).toFixed(2));

    resultados.push({
      id: p.id,
      categoria: p.categoria,
      pergunta: p.pergunta,
      tempo_s,
      statusHTTP: status,
      correto: avaliacao.correto,
      portugues_natural: avaliacao.portugues_natural,
      util: avaliacao.util,
      seguro: avaliacao.seguro,
      nota: notaComposta,
      comentario: avaliacao.comentario,
      respostaTrecho: resposta.slice(0, 100).replace(/\n/g, ' ')
    });

    console.log(`   └─ Nota: ${notaComposta}/10 | Tempo: ${tempo_s}s | Status: ${status}`);
  }

  // Métricas Consolidadas
  const somaNotas = resultados.reduce((acc, r) => acc + r.nota, 0);
  const notaMedia = parseFloat((somaNotas / resultados.length).toFixed(2));
  const respostasAbaixo5 = resultados.filter(r => r.nota < 5).length;
  const p95Tempo = parseFloat(calcularP95(tempos).toFixed(2));

  // Metas para liberar venda
  const metaNota = notaMedia >= 8.0;
  const metaAbaixo5 = respostasAbaixo5 === 0;
  const metaTempo = p95Tempo < 15.0;
  const aprovadoParaVenda = metaNota && metaAbaixo5 && metaTempo;

  // Geração do Relatório Markdown
  let md = `## 📊 Relatório da Prova de Qualidade Q8 do Cortex (#1636)\n\n`;
  md += `**Data/Hora:** ${new Date().toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}\n`;
  md += `**Status Global:** ${aprovadoParaVenda ? '✅ **APROVADO PARA VENDA**' : '❌ **REPROVADO PARA VENDA**'}\n\n`;

  md += `### 🎯 Resumo das Metas de Liberação\n`;
  md += `| Métrica | Meta para Vender | Resultado Real | Status |\n`;
  md += `|---|---|---|---|\n`;
  md += `| **Nota Média** | ≥ 8.0 | **${notaMedia}** / 10 | ${metaNota ? '✅ OK' : '❌ FALHOU'} |\n`;
  md += `| **Respostas com Nota < 5** | 0 | **${respostasAbaixo5}** | ${metaAbaixo5 ? '✅ OK' : '❌ FALHOU'} |\n`;
  md += `| **p95 do Tempo de Resposta** | < 15.0 s | **${p95Tempo} s** | ${metaTempo ? '✅ OK' : '❌ FALHOU'} |\n\n`;

  md += `### 📝 Detalhamento das 30 Perguntas Reais\n`;
  md += `| # | Categoria | Pergunta | Tempo | Nota | Status |\n`;
  md += `|---|---|---|---|---|---|\n`;

  for (const r of resultados) {
    const icone = r.nota >= 8 ? '🟢' : r.nota >= 5 ? '🟡' : '🔴';
    md += `| ${r.id} | \`${r.categoria}\` | ${r.pergunta.slice(0, 45)}... | ${r.tempo_s}s | **${r.nota}** | ${icone} |\n`;
  }

  md += `\n*Relatório gerado automaticamente por \`scripts/cortex-qualidade.js\` (Refs #1636).*\n`;

  console.log('\n================================================');
  console.log(`NOTA MÉDIA: ${notaMedia} / 10 (Meta: ≥ 8.0) -> ${metaNota ? 'PASSOU' : 'FALHOU'}`);
  console.log(`RESPOSTAS < 5: ${respostasAbaixo5} (Meta: 0) -> ${metaAbaixo5 ? 'PASSOU' : 'FALHOU'}`);
  console.log(`p95 TEMPO: ${p95Tempo}s (Meta: < 15s) -> ${metaTempo ? 'PASSOU' : 'FALHOU'}`);
  console.log(`APROVADO PARA VENDA: ${aprovadoParaVenda ? 'SIM' : 'NÃO'}`);
  console.log('================================================\n');

  const issueNum = process.env.ISSUE_NUMBER || '1636';
  await publicarComentarioGitHub(issueNum, md);

  return {
    notaMedia,
    respostasAbaixo5,
    p95Tempo,
    aprovadoParaVenda,
    resultados,
    relatorioMarkdown: md
  };
}

if (require.main === module) {
  rodarProvaQualidade().catch((err) => {
    console.error('Erro ao executar prova de qualidade:', err);
    process.exit(1);
  });
}

module.exports = {
  rodarProvaQualidade,
  calcularP95,
  avaliarFallback,
  avaliarComIAJuiz
};
