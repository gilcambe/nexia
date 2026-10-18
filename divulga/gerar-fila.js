'use strict';
// Refaz as 6 imagens do feed do Body Coach (divulga/imagens/body-coach-N.jpg) no visual de marca com tela do app.
// Uso: node divulga/gerar-fila.js   (precisa do Chromium do Playwright; DIVULGA_CHROMIUM aponta para o executável)
const path = require('node:path');
const { postUnico } = require('./lib/visual');

const POSTS = [
  { titulo: 'Seu personal', destaque: 'no bolso.', texto: 'Treino, dieta e evolução com inteligência artificial. Comece grátis.', tela: 'hoje' },
  { titulo: 'Chega de ficha', destaque: 'copiada.', texto: 'Diga seu objetivo e o app monta o seu treino, com vídeo de cada exercício.', tela: 'hoje' },
  { titulo: 'Dieta que cabe', destaque: 'na sua rotina.', texto: 'Ajustada toda semana pelo seu peso, com lista de compras pronta.', tela: 'dieta' },
  { titulo: 'O que não é medido', destaque: 'não melhora.', texto: 'Peso, medidas e fotos de antes e depois num lugar só.', tela: 'evolucao' },
  { titulo: 'Personal,', destaque: 'o app é seu.', texto: 'Fichas, dietas e cobrança por Pix com a sua marca. 30 dias grátis.', tela: 'coach', botao: 'Teste 30 dias grátis' },
  { titulo: 'Topa o desafio', destaque: '30 dias?', texto: 'Um treino por dia, ranking e certificado. Comente EU VOU.', tela: 'hoje', botao: 'Comente EU VOU' },
];

async function main(saida = path.join(__dirname, 'imagens')) {
  let chromium; try { ({ chromium } = require('@playwright/test')); } catch { ({ chromium } = require('playwright')); }
  const navegador = await chromium.launch(process.env.DIVULGA_CHROMIUM ? { executablePath: process.env.DIVULGA_CHROMIUM } : {});
  try {
    for (const [i, p] of POSTS.entries()) {
      const pg = await navegador.newPage({ viewport: { width: 1080, height: 1350 } });
      await pg.setContent(postUnico({ nome: 'Body Coach' }, p), { waitUntil: 'load' });
      await pg.screenshot({ path: path.join(saida, `body-coach-${i + 1}.jpg`), type: 'jpeg', quality: 88 });
      await pg.close();
    }
  } finally { await navegador.close(); }
}

module.exports = { POSTS, main };
if (require.main === module) main(process.argv[2]).then(() => console.log('6 imagens geradas')).catch(e => { console.error(e.message); process.exitCode = 1; });
