// Bebida no fim de semana: registra o que vai beber (ou bebeu), soma as calorias e dá um plano para
// caber na semana, sem culpa e sem mentira. Valores médios por dose comum no Brasil.

export interface Bebida { id: string; nome: string; dose: string; kcal: number; c: number; alcoolG: number }
export const BEBIDAS: Bebida[] = [
  { id: 'cerveja-lata', nome: 'Cerveja (lata 350 ml)', dose: '350 ml', kcal: 150, c: 12, alcoolG: 13 },
  { id: 'cerveja-long', nome: 'Cerveja long neck', dose: '355 ml', kcal: 150, c: 12, alcoolG: 13 },
  { id: 'chopp', nome: 'Chopp (tulipa 300 ml)', dose: '300 ml', kcal: 130, c: 10, alcoolG: 11 },
  { id: 'cerveja-zero', nome: 'Cerveja sem álcool', dose: '350 ml', kcal: 70, c: 15, alcoolG: 0 },
  { id: 'vinho', nome: 'Vinho (taça 150 ml)', dose: '150 ml', kcal: 125, c: 4, alcoolG: 14 },
  { id: 'espumante', nome: 'Espumante (taça)', dose: '120 ml', kcal: 90, c: 2, alcoolG: 11 },
  { id: 'caipirinha', nome: 'Caipirinha', dose: '1 copo', kcal: 290, c: 35, alcoolG: 20 },
  { id: 'caipi-adocante', nome: 'Caipirinha com adoçante', dose: '1 copo', kcal: 150, c: 4, alcoolG: 20 },
  { id: 'gin-tonica', nome: 'Gin tônica', dose: '1 copo', kcal: 170, c: 15, alcoolG: 16 },
  { id: 'gin-zero', nome: 'Gin com tônica zero', dose: '1 copo', kcal: 100, c: 0, alcoolG: 16 },
  { id: 'whisky', nome: 'Whisky / vodka (dose 50 ml)', dose: '50 ml', kcal: 110, c: 0, alcoolG: 16 },
  { id: 'energetico', nome: 'Vodka com energético', dose: '1 copo', kcal: 220, c: 27, alcoolG: 16 },
  { id: 'cachaca', nome: 'Cachaça (dose 50 ml)', dose: '50 ml', kcal: 115, c: 0, alcoolG: 16 },
];

export interface ResumoBebida { kcal: number; doses: number; alcoolG: number; carbo: number }
export function somar(itens: { id: string; qtd: number }[]): ResumoBebida {
  return itens.reduce((s, it) => {
    const b = BEBIDAS.find((x) => x.id === it.id);
    if (!b || !(it.qtd > 0)) return s;
    return { kcal: s.kcal + b.kcal * it.qtd, doses: s.doses + it.qtd, alcoolG: s.alcoolG + b.alcoolG * it.qtd, carbo: s.carbo + b.c * it.qtd };
  }, { kcal: 0, doses: 0, alcoolG: 0, carbo: 0 });
}

// Plano para caber: divide as calorias em tirar um pouco de carbo e gordura nos dias antes (nunca proteína),
// e diz quanto de água beber. Sem compensar com jejum ou exercício exagerado.
export function planoParaCaber(r: ResumoBebida, diasAntes = 3): string[] {
  if (!r.doses) return [];
  const porDia = Math.round(r.kcal / Math.max(1, diasAntes) / 10) * 10;
  const dicas = [
    `Essas bebidas somam cerca de ${Math.round(r.kcal)} kcal (${r.doses} ${r.doses === 1 ? 'dose' : 'doses'}).`,
    porDia <= 400
      ? `Para caber na semana: tire cerca de ${porDia} kcal por dia nos ${diasAntes} dias antes, cortando carbo e gordura (ex.: menos arroz, pão ou óleo). Mantenha a proteína.`
      : 'É muita caloria para compensar sem passar fome: troque metade por versões zero (tônica zero, adoçante) ou alterne com água.',
    `Beba 1 copo de água a cada dose: ${r.doses} copos a mais no dia.`,
    'Coma uma refeição com proteína antes de beber: o álcool sobe menos e você belisca menos.',
  ];
  if (r.alcoolG >= 60) dicas.push('Acima de 4 doses o álcool atrapalha a recuperação muscular e o sono: no dia seguinte, treino leve.');
  return dicas;
}
