#!/usr/bin/env node
'use strict';
// Kernex Locação: cria o site + painel de um NOVO cliente copiando o sistema do Splash (sites/splash).
//   node scripts/novo-cliente-locacao.js --slug chacara-sol --nome "Chácara do Sol" [--instagram chacaradosol] [--unidades 1|2] [--destino sites/chacara-sol]
// O que faz:
//   1) copia sites/splash para sites/<slug> (menos as fotos de midia/, que são do Splash);
//   2) troca a conta (meta locacao-site / agenda-site), o nome no texto, o nome do app instalado e a vinheta Kernex;
//   3) mostra o código de primeiro acesso e o bloco para colar em clientes/locacoes.js.
// Depois: PR para develop, merge, e publicar com o workflow "Publicar site de cliente" (slug do Pages = <slug>, pasta = sites/<slug>).
// O backend (netlify/functions/locacao.js) já é multi-cliente: cada conta é uma chave de clientes/locacoes.js (?site=<slug>).
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

function args(argv) {
  const o = {};
  for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) o[argv[i].slice(2)] = argv[i + 1], i++;
  return o;
}

// Troca "Splash" de texto visível, sem mexer em nomes de código (SplashPainel, SplashCalendario, splash_token...).
function trocarNome(s, nome) {
  return s
    .replace(/Splash Piscina e Lazer/g, nome)
    .replace(/Splash Santa Adélia/g, nome)
    .replace(/Splash Santa Bárbara/g, nome + ' 2')
    .replace(/Painel da Amanda/g, 'Painel')
    .replace(/WhatsApp da Amanda/g, 'WhatsApp da dona')
    .replace(/a Amanda/g, 'a equipe').replace(/A Amanda/g, 'A equipe').replace(/Amanda · /g, '')
    .replace(/\bAmanda\b/g, 'a equipe')
    .replace(/\bSplash\b(?![A-Za-z_])/g, nome);
}

const FOTO_EXEMPLO = '<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600">' +
  '<rect width="800" height="600" fill="#e8eef5"/><text x="400" y="310" font-family="sans-serif" font-size="36" fill="#6b7d96" text-anchor="middle">Sua foto aqui</text></svg>';

function criar({ slug, nome, instagram = '', destino, origem }) {
  if (!/^[a-z0-9-]{3,40}$/.test(slug || '')) throw new Error('slug inválido: use letras minúsculas, números e hífen (3 a 40)');
  if (!nome) throw new Error('falta --nome');
  if (slug.startsWith('splash')) throw new Error('slug reservado');
  if (fs.existsSync(destino)) throw new Error('pasta já existe: ' + destino);
  fs.cpSync(origem, destino, { recursive: true, filter: src => !src.includes(path.sep + 'midia' + path.sep) });
  fs.mkdirSync(path.join(destino, 'midia'), { recursive: true });
  fs.writeFileSync(path.join(destino, 'midia', 'foto-exemplo.svg'), FOTO_EXEMPLO);

  const ed = (rel, f) => { const p = path.join(destino, rel); fs.writeFileSync(p, f(fs.readFileSync(p, 'utf8'))); };
  ed('index.html', s => trocarNome(s, nome)
    .replace('<meta name="locacao-site" content="splash">', `<meta name="locacao-site" content="${slug}">`)
    .replace(/data-produto="SPLASH"/, `data-produto="${nome.toUpperCase().replace(/"/g, '')}"`)
    .replace(/midia\/[A-Za-z0-9._-]+\.(jpe?g|png|webp|mp4)/g, 'midia/foto-exemplo.svg')
    .replace(/splasheventos\.pages\.dev/g, `${slug}.pages.dev`)
    .replace(/utm_source=splash/g, `utm_source=${slug}`)
    .replace(/splash_santaadelia/g, instagram || 'seuinstagram'));
  ed('agenda/index.html', s => trocarNome(s, nome)
    .replace('<meta name="agenda-site" content="splash">', `<meta name="agenda-site" content="${slug}">`)
    .replace(/data-produto="SPLASH"/, `data-produto="${nome.toUpperCase().replace(/"/g, '')}"`)
    .replace(/splash_santaadelia/g, instagram || 'seuinstagram'));
  ed('agenda/manifest.webmanifest', s => {
    const m = JSON.parse(s);
    m.name = 'Painel ' + nome;
    m.short_name = nome.slice(0, 12);
    return JSON.stringify(m, null, 2);
  });
  ed('agenda/sw.js', s => s.replace(/splash-painel-v\d+/g, `${slug}-painel-v1`));
  for (const f of ['sitemap.xml', 'robots.txt', 'privacidade.html']) {
    if (fs.existsSync(path.join(destino, f))) ed(f, s => trocarNome(s.replace(/splasheventos\.pages\.dev/g, `${slug}.pages.dev`), nome));
  }
}

async function main() {
  const a = args(process.argv.slice(2));
  const raiz = path.join(__dirname, '..');
  const destino = path.resolve(raiz, a.destino || path.join('sites', a.slug || ''));
  criar({ slug: a.slug, nome: a.nome, instagram: a.instagram, destino, origem: path.join(raiz, 'sites/splash') });
  const { hashSenha } = require('../netlify/functions/locacao.js');
  const ALFA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const codigo = Array.from(crypto.randomBytes(10)).map(b => ALFA[b % ALFA.length]).join('');
  const salt = crypto.randomBytes(16).toString('hex');
  console.log(`Pronto: ${path.relative(raiz, destino)}`);
  console.log('Falta: trocar logo-splash.png e agenda/icone-*.png pelo logo do cliente, e as fotos pelo painel (Ajustes > Fotos).');
  console.log(`Código de primeiro acesso para a dona (mostre só a ela): ${codigo.slice(0, 5)}-${codigo.slice(5)}`);
  console.log('\nCole em clientes/locacoes.js, dentro de LOCACOES:\n');
  console.log(`  '${a.slug}': {
    nome: ${JSON.stringify(a.nome)},
    versao: 1,
    codigo_salt: '${salt}',
    codigo_hash: '${await hashSenha(codigo, salt)}',
    config: {
      nome: ${JSON.stringify(a.nome)},
      whatsapp: '',
      instagram: ${JSON.stringify(a.instagram || '')},
      // Os ids das unidades são os do sistema base (o site tem 2 lugares); com 1 unidade o site esconde a segunda.
      unidades: [{ id: 'santa-adelia', nome: ${JSON.stringify(a.nome)}, endereco: '' }${a.unidades === '2' ? `, { id: 'santa-barbara', nome: ${JSON.stringify(a.nome + ' 2')}, endereco: '' }` : ''}],
      extras: [],
      sinal: { tipo: 'percentual', valor: 0 },
      pix: { chave: '', titular: '' },
      prazo_horas: 48,
      antecedencia_dias: 0,
      dias_a_frente: 540,
      aviso: '',
      mensagem_pedido: 'Pedido de reserva recebido com sucesso! Aguarde o contato para confirmação do sinal.',
    },
  },`);
}

if (require.main === module) main().catch(e => { console.error('Erro:', e.message); process.exit(1); });
module.exports = { criar, trocarNome };
