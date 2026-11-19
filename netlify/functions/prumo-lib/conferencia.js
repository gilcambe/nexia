'use strict';
// Fase 6 do épico #4013 (manual CFO Pessoal, seções 3 e 4): confere o holerite com o espelho de ponto.
// Cada hora registrada precisa de um provento com o nome certo; falta precisa de desconto; provento sem hora também avisa.
const MES = /^\d{4}-(0[1-9]|1[0-2])$/;
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9%]+/g, ' ');
const ehExtra = (n) => /extra|\bh e\b|\bhe\b|\bhe\d/.test(n);
const CAMPOS = [
  { campo: 'he50', nome: 'Hora extra 50%', em: 'proventos', casa: (n) => ehExtra(n) && /(^|\D)50(\D|$)/.test(n) },
  { campo: 'he75', nome: 'Hora extra 75%', em: 'proventos', casa: (n) => ehExtra(n) && /(^|\D)75(\D|$)/.test(n) },
  { campo: 'he100', nome: 'Hora extra 100%', em: 'proventos', casa: (n) => ehExtra(n) && /(^|\D)100(\D|$)/.test(n) },
  { campo: 'noturnas', nome: 'Adicional noturno', em: 'proventos', casa: (n) => /noturn/.test(n) },
  { campo: 'sobreaviso', nome: 'Sobreaviso', em: 'proventos', casa: (n) => /sobre ?aviso/.test(n) },
  { campo: 'faltas', nome: 'Faltas', em: 'descontos', casa: (n) => /falta|ausencia/.test(n) },
];
const h = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : 0);
const fmtH = (v) => String(Math.round(v * 100) / 100).replace('.', ',');

function conferirFolha(holerite, ponto) {
  const hol = holerite || {};
  const itens = [];
  const divergencias = [];
  for (const c of CAMPOS) {
    const lista = Array.isArray(hol[c.em]) ? hol[c.em] : [];
    const achado = lista.find((x) => x && Number(x.valor) > 0 && c.casa(norm(x.nome)));
    const horas = ponto ? h(ponto[c.campo]) : 0;
    itens.push({ campo: c.campo, nome: c.nome, horas, provento: achado ? achado.nome : null, valor: achado ? Number(achado.valor) : 0 });
    if (!holerite || !ponto) continue;
    if (horas > 0 && !achado) {
      divergencias.push({ campo: c.campo, tipo: 'ponto_sem_pagamento', horas, texto: c.campo === 'faltas'
        ? `O ponto tem ${fmtH(horas)} h de falta, mas o holerite não mostra desconto de falta. Confira com o RH.`
        : `O ponto tem ${fmtH(horas)} h de ${c.nome.toLowerCase()}, mas o holerite não mostra esse pagamento. Pode ter ficado para o próximo mês ou faltou pagar.` });
    } else if (horas === 0 && achado) {
      divergencias.push({ campo: c.campo, tipo: 'pago_sem_ponto', valor: Number(achado.valor), texto: c.campo === 'faltas'
        ? `O holerite desconta "${achado.nome}", mas o ponto não tem falta. Confira com o RH.`
        : `O holerite paga "${achado.nome}", mas o ponto deste mês não tem essas horas. Pode ser de outro mês: confira.` });
    }
  }
  return { mes_holerite: hol.mes || null, mes_ponto: (ponto && ponto.mes) || null, itens, divergencias, ok: divergencias.length === 0 };
}

function mesAntes(m) { const [a, b] = m.split('-').map(Number); const t = a * 12 + b - 2; return `${Math.floor(t / 12)}-${String((t % 12) + 1).padStart(2, '0')}`; }

async function agirConferencia(acao, body, c) {
  if (acao !== 'folha_conferir') return null;
  const { base } = c;
  const mesH = typeof body.mes_holerite === 'string' ? body.mes_holerite : '';
  const mesP = typeof body.mes_ponto === 'string' ? body.mes_ponto : '';
  if ((mesH && !MES.test(mesH)) || (mesP && !MES.test(mesP))) return [400, { error: 'O mês precisa estar no formato AAAA-MM.' }];
  const [pagamentos, antigos, pontos] = await Promise.all([c.listar(base.collection('pagamentos')), c.listar(base.collection('holerites')), c.listar(base.collection('folhas_ponto'))]);
  const holerites = [...pagamentos.filter((p) => p.tipo === 'mensal' && MES.test(String(p.mes))), ...antigos.filter((p) => MES.test(String(p.mes)))]
    .sort((a, b) => String(b.mes).localeCompare(String(a.mes)));
  const hol = mesH ? holerites.find((x) => x.mes === mesH) : holerites[0];
  if (!hol) return [200, { ok: true, vazio: true, lacuna: 'Mande um holerite mensal para eu conferir com o ponto.', itens: [], divergencias: [] }];
  const porMes = new Map(pontos.map((p) => [p.mes, p]));
  // Hora extra costuma ser paga no mês seguinte: sem mês pedido, usa o ponto do mês anterior ao holerite, senão o mesmo mês.
  const ponto = mesP ? porMes.get(mesP) : porMes.get(mesAntes(hol.mes)) || porMes.get(hol.mes);
  if (!ponto) return [200, { ok: true, vazio: true, mes_holerite: hol.mes, lacuna: 'Lance a folha de ponto para eu conferir com o holerite.', itens: [], divergencias: [] }];
  return [200, conferirFolha(hol, ponto)];
}

module.exports = { conferirFolha, agirConferencia, CAMPOS };
