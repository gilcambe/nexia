// Plano B do chat (IA fora do ar): respostas com os dados da pessoa e variadas, nunca a mesma frase pronta.
// Cada assunto tem várias formas de responder; a escolha muda a cada mensagem e nunca repete a última.
export interface DadosLocais {
  nome: string;
  objetivos: string[];
  sexo: 'F' | 'M' | null;
  local: string;
  treinoHoje: string | null;
  prontidao: number | null;
  status: 'pronto' | 'atencao' | 'reduzir' | null;
  peso: number | null;
  kcal: number | null;
  kcalMeta: number | null;
  proteina: number | null;
  proteinaMeta: number | null;
  hora: number;
}

let ultima = '';
let giro = 0;
function uma(opcoes: string[]): string {
  const validas = opcoes.filter(Boolean);
  for (let i = 0; i < validas.length; i++) {
    const r = validas[(giro++ + i) % validas.length];
    if (r !== ultima || validas.length === 1) { ultima = r; return r; }
  }
  return validas[0];
}

const num = (n: number) => n.toLocaleString('pt-BR');

function objetivoTexto(d: DadosLocais): string {
  const o = d.objetivos.map((x) => x.toLowerCase());
  if (o.includes('perda de gordura') && (o.includes('hipertrofia') || o.includes('estética'))) return 'secar e ganhar músculo ao mesmo tempo';
  if (o.includes('perda de gordura')) return 'emagrecer';
  if (o.includes('hipertrofia')) return 'ganhar massa';
  if (o.includes('força')) return 'ficar mais forte';
  if (o.includes('saúde')) return 'cuidar da saúde';
  return o[0] ?? 'evoluir';
}

export function respostaLocal(texto: string, d: DadosLocais): string {
  const t = texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
  const n = d.nome;
  const obj = objetivoTexto(d);
  const periodo = d.hora < 12 ? 'manhã' : d.hora < 18 ? 'tarde' : 'noite';
  const casa = /casa/i.test(d.local);

  if (/^(oi|ola|opa|e ai|bom dia|boa tarde|boa noite|eai|salve)\b/.test(t.trim())) {
    return uma([
      `Oi, ${n}! Como está a ${periodo}? Vai dar para treinar hoje?`,
      `E aí, ${n}! Dormiu bem? Me conta como está a energia hoje.`,
      d.treinoHoje ? `Opa, ${n}! Hoje tem ${d.treinoHoje}. Bora?` : `Fala, ${n}! Tudo certo por aí?`,
      `Oi, ${n}! Bom te ver por aqui. Como você está se sentindo hoje?`,
    ]);
  }
  if (/obrigad|valeu|vlw|tmj/.test(t)) {
    return uma([`Tamo junto, ${n}!`, `Imagina, ${n}. Conta comigo!`, `Por nada! Qualquer coisa, me chama.`, `É nós, ${n}! Segue firme.`]);
  }
  if (/cansad|sono|exaust|sem energia|desanim|preguic|sem vontade/.test(t)) {
    return uma([
      `Poxa, ${n}, entendo. Que tal um treino mais leve hoje, só os 3 primeiros exercícios? Já conta muito.`,
      `Acontece, ${n}. Se dormiu pouco, baixa a carga e deixa 2 ou 3 repetições sobrando em cada série. Consistência ganha de intensidade.`,
      `Entendo. Só de aparecer você já vence o dia. Faz o aquecimento e vê como o corpo responde, combinado?`,
      `Respeita o corpo hoje, ${n}. Uma caminhada de 20 minutos já ajuda a ${obj}.`,
    ]);
  }
  if (/dor|doendo|machuc|lesao|lesionei/.test(t)) {
    return uma([
      `Cuidado com isso, ${n}. Se a dor for forte, aguda ou com inchaço, pare e procure um profissional. No treino, use "Trocar exercício" para fugir do movimento que incomoda.`,
      `Dor não é para aguentar. Me diga onde dói em "Como você está hoje" que eu tiro do treino os exercícios que forçam essa região.`,
    ]);
  }
  if (/comer|caloria|kcal|proteina|dieta|fome|refeic|almoc|janta|lanche/.test(t)) {
    if (!d.kcalMeta) return uma([`Ainda não tenho suas metas de comida, ${n}. Registre uma refeição em Nutrição que eu começo a acompanhar.`, `Me passa seu peso no Perfil que eu calculo quanto você precisa comer para ${obj}.`]);
    const falta = Math.max(0, d.kcalMeta - (d.kcal ?? 0));
    const faltaP = Math.max(0, (d.proteinaMeta ?? 0) - (d.proteina ?? 0));
    return uma([
      `Hoje ainda cabem ~${num(falta)} kcal, ${n}. Capricha na proteína: faltam ${faltaP} g.`,
      faltaP > 30 ? `Faltam ${faltaP} g de proteína. Frango, ovos, iogurte ou atum resolvem rápido.` : `Proteína quase batida! Ainda tem ~${num(falta)} kcal livres hoje.`,
      `Para ${obj}, o segredo é constância. Você está em ${num(d.kcal ?? 0)} de ${num(d.kcalMeta)} kcal hoje.`,
    ]);
  }
  if (/peso|balanc|gordura|emagrec|engord/.test(t)) {
    if (d.peso == null) return `Ainda não tenho seu peso registrado, ${n}. Registra em Evolução que eu acompanho a tendência da semana.`;
    return uma([
      `Último peso: ${d.peso.toFixed(1).replace('.', ',')} kg. Olha a média da semana, não o dia: o peso oscila com água e sal.`,
      `Você está com ${d.peso.toFixed(1).replace('.', ',')} kg. Para ${obj}, pese-se de manhã, em jejum, 2 ou 3 vezes por semana.`,
    ]);
  }
  if (/treino|treinar|exercicio|academia|perna|peito|costas|braco|ombro|gluteo|hoje/.test(t)) {
    if (d.status === 'reduzir') return uma([`Seu corpo pede recuperação hoje, ${n}. Treino leve ou mobilidade é a melhor escolha.`, `Hoje é dia de pegar leve: menos séries e carga confortável.`]);
    return uma([
      d.treinoHoje ? `Hoje é ${d.treinoHoje}, ${n}. Montei pensando em ${obj}${casa ? ', com o que você tem em casa' : ''}.` : `Abre a aba Treino que o de hoje já está montado para você.`,
      d.prontidao != null ? `Sua prontidão está em ${d.prontidao}/100. ${d.status === 'pronto' ? 'Dá para ir forte!' : 'Treina, mas com ajustes.'}` : `Faz o check-in de hoje que eu ajusto o treino ao seu sono e energia.`,
      `Foco na técnica e em deixar 1 ou 2 repetições sobrando. É assim que se ${obj === 'emagrecer' ? 'emagrece sem perder músculo' : 'evolui sem se machucar'}.`,
    ]);
  }
  return uma([
    `Estou meio sem conexão agora, ${n}, mas sigo aqui. Pergunte sobre seu treino de hoje, sua dieta ou seu peso.`,
    `A conexão está instável. Enquanto isso: me conta como foi o treino ou o que comeu, que eu te ajudo.`,
    `Não consegui pensar numa resposta completa agora. Tenta de novo em instantes? Se for sobre treino ou dieta, já te respondo com seus dados.`,
  ]);
}
