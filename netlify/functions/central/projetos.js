'use strict';
// #3224: % de cada projeto calculado SÓ com evidência (docs/roadmaps/<id>.md). Sem roteiro aprovado: "ainda não definido".
const ITEM = /^\s*-\s*\[( |x|X)\]\s*(.+?)\s*\(peso\s*(\d+)\)\s*(.*)$/;

function percentual(md) {
  const texto = String(md || '').replace(/<!--[\s\S]*?-->/g, '');
  const nome = (/^#\s+(.+)$/m.exec(texto) || [])[1] || '';
  // 09/11: o Cortex propõe (status: proposto) e o dono aprova (status: aprovado) com 1 clique na Central.
  const proposto = /status:\s*proposto/i.test(texto);
  const definido = !/status:\s*ainda-nao-definido/i.test(texto) && !proposto;
  let total = 0, feito = 0;
  const faltam = [], feitos = [];
  for (const linha of texto.split('\n')) {
    const m = ITEM.exec(linha);
    if (!m) continue;
    const peso = Number(m[3]) || 0;
    total += peso;
    const resto = m[4] || '';
    const evidencia = (/evidencia:\s*(\S.*)$/i.exec(resto) || [])[1] || '';
    const comProva = /PR\s*#\d+|https?:\/\/|teste/i.test(evidencia);
    if (m[1].toLowerCase() === 'x' && comProva) { feito += peso; feitos.push({ texto: m[2], evidencia }); }
    else faltam.push({ texto: m[2], quem: (/quem:\s*([^\s].*)$/i.exec(resto) || [])[1] || 'não definido' });
  }
  return { nome, proposto: proposto && total > 0, definido: definido && total > 0, pct: total ? Math.round((feito / total) * 100) : 0, feitos, faltam };
}

async function carregar(gh, repo) {
  const lista = await gh('/repos/' + repo + '/contents/docs/roadmaps?ref=develop').catch(() => []);
  const arquivos = (Array.isArray(lista) ? lista : []).filter((f) => /\.md$/.test(f.name));
  const projetos = await Promise.all(arquivos.map(async (f) => {
    const c = await gh('/repos/' + repo + '/contents/docs/roadmaps/' + f.name + '?ref=develop').catch(() => null);
    const md = c && c.content ? Buffer.from(c.content, 'base64').toString('utf8') : '';
    return { id: f.name.replace(/\.md$/, ''), link: f.html_url, ...percentual(md) };
  }));
  return { projetos, conferidoEm: new Date().toISOString(), origem: 'docs/roadmaps no GitHub (só conta item com prova)' };
}

module.exports = { percentual, carregar };
