// Dicas de saúde curtas (baseadas em recomendações gerais: OMS, Sociedade Brasileira de Cardiologia, ACSM).
export interface Dica { cat: 'Sono' | 'Hidratação' | 'Alimentação' | 'Treino' | 'Recuperação' | 'Mente' | 'Postura'; titulo: string; texto: string }

export const DICAS: Dica[] = [
  { cat: 'Sono', titulo: '7 a 9 horas', texto: 'É no sono profundo que o músculo se recupera e o hormônio do crescimento sobe. Dormir pouco aumenta a fome no dia seguinte.' },
  { cat: 'Sono', titulo: 'Tela longe antes de dormir', texto: 'A luz do celular atrasa a melatonina. Desligue as telas 30 a 60 minutos antes de deitar.' },
  { cat: 'Sono', titulo: 'Cafeína tem hora', texto: 'A cafeína fica de 5 a 6 horas no corpo. Evite café e pré-treino depois das 16h se treina à noite e dorme mal.' },
  { cat: 'Sono', titulo: 'Quarto escuro e fresco', texto: 'Entre 18 e 22 °C e escuro total. O corpo precisa baixar a temperatura para dormir fundo.' },
  { cat: 'Sono', titulo: 'Mesmo horário', texto: 'Acordar sempre no mesmo horário, até no fim de semana, regula o relógio biológico e melhora a disposição.' },
  { cat: 'Hidratação', titulo: 'Xixi claro', texto: 'A cor do xixi é o melhor termômetro: amarelo claro está ótimo; escuro, beba mais água.' },
  { cat: 'Hidratação', titulo: '2% a menos, rendimento cai', texto: 'Perder 2% do peso em suor já reduz força e foco. Beba 500 ml até 2 horas antes de treinar.' },
  { cat: 'Hidratação', titulo: 'Treino longo pede sal', texto: 'Acima de 1 hora suando muito, água pura não basta: use bebida com sódio ou uma pitada de sal com limão.' },
  { cat: 'Hidratação', titulo: 'Garrafa à vista', texto: 'Deixe uma garrafa na mesa. Quem vê a água bebe até 50% mais ao longo do dia.' },
  { cat: 'Alimentação', titulo: 'Proteína em todas as refeições', texto: '1,6 a 2,2 g por kg de peso por dia, dividida em 3 a 5 refeições, maximiza o ganho de músculo.' },
  { cat: 'Alimentação', titulo: 'Prato colorido', texto: 'Metade do prato com verduras e legumes: fibras, vitaminas e saciedade com poucas calorias.' },
  { cat: 'Alimentação', titulo: 'Pré-treino simples', texto: '1 a 2 horas antes: carboidrato + um pouco de proteína (ex.: pão com ovo, banana com iogurte).' },
  { cat: 'Alimentação', titulo: 'Pós-treino sem pressa', texto: 'A "janela de 30 minutos" é exagero. Comer proteína e carboidrato nas 2 horas seguintes já é ótimo.' },
  { cat: 'Alimentação', titulo: 'Ultraprocessados', texto: 'Quanto maior a lista de ingredientes que você não reconhece, menos deveria estar no seu dia a dia.' },
  { cat: 'Alimentação', titulo: 'Coma devagar', texto: 'A saciedade leva uns 20 minutos para chegar. Mastigar bem evita comer além da conta.' },
  { cat: 'Alimentação', titulo: 'Creatina funciona', texto: 'É o suplemento mais estudado: 3 a 5 g por dia, todos os dias, em qualquer horário. Não precisa de fase de saturação.' },
  { cat: 'Alimentação', titulo: 'Álcool e músculo', texto: 'Álcool reduz a síntese de proteína e piora o sono. Se beber, prefira longe do treino e com água junto.' },
  { cat: 'Treino', titulo: 'Sobrecarga progressiva', texto: 'O músculo só cresce se o desafio aumenta: mais carga, mais repetições ou mais séries ao longo das semanas.' },
  { cat: 'Treino', titulo: 'Técnica antes de carga', texto: 'Carga alta com técnica ruim troca o músculo-alvo por articulação. Controle a descida (2 a 3 s).' },
  { cat: 'Treino', titulo: '10 a 20 séries por músculo', texto: 'Por semana, cada grupo muscular cresce bem com 10 a 20 séries efetivas, perto da falha.' },
  { cat: 'Treino', titulo: 'Aqueça de verdade', texto: '5 minutos de cardio leve + 1 a 2 séries leves do primeiro exercício reduzem o risco de lesão.' },
  { cat: 'Treino', titulo: '150 minutos', texto: 'A OMS recomenda 150 a 300 minutos de atividade moderada por semana, mais força 2 vezes. Cada minuto conta.' },
  { cat: 'Treino', titulo: 'Passos contam', texto: '7 a 10 mil passos por dia estão ligados a menos risco de doenças do coração. Suba escadas, estacione longe.' },
  { cat: 'Treino', titulo: 'Zona 2', texto: 'Cardio em que dá para conversar (zona 2) melhora o coração e a queima de gordura sem atrapalhar a musculação.' },
  { cat: 'Recuperação', titulo: 'Descanso faz parte', texto: 'Treine o mesmo músculo com 48 a 72 horas de intervalo. É no descanso que ele cresce.' },
  { cat: 'Recuperação', titulo: 'Dor tardia é normal', texto: 'A dor de 24 a 72 horas depois do treino é normal. Dor aguda, em pontada ou na articulação, não é: pare e avalie.' },
  { cat: 'Recuperação', titulo: 'Semana de descarga', texto: 'A cada 4 a 8 semanas, reduza o volume pela metade por uma semana. Você volta mais forte.' },
  { cat: 'Recuperação', titulo: 'Caminhar no dia de folga', texto: 'Recuperação ativa (caminhada, bike leve) acelera a recuperação mais do que ficar parado.' },
  { cat: 'Mente', titulo: 'Nunca falhe duas vezes', texto: 'Perder um treino é normal. O que quebra o hábito é perder dois seguidos. Faça nem que sejam 10 minutos.' },
  { cat: 'Mente', titulo: 'Respire para baixar o estresse', texto: '3 minutos de respiração lenta (4 s entra, 6 s sai) baixam o cortisol e a frequência cardíaca.' },
  { cat: 'Mente', titulo: 'Exercício é antidepressivo', texto: 'Treinar 3 vezes por semana reduz sintomas de ansiedade e depressão de forma comparável a terapias leves.' },
  { cat: 'Mente', titulo: 'Compare-se com você', texto: 'Use as fotos e medidas do app. Comparar com o seu "eu" de 3 meses atrás é o que motiva de verdade.' },
  { cat: 'Mente', titulo: 'Meta de processo', texto: 'Em vez de "perder 10 kg", mire em "treinar 4 vezes e bater a proteína todo dia". O resultado vem junto.' },
  { cat: 'Postura', titulo: 'Levante a cada 50 minutos', texto: 'Ficar sentado horas seguidas trava o quadril e a lombar. Levante, ande 2 minutos, alongue.' },
  { cat: 'Postura', titulo: 'Tela na altura dos olhos', texto: 'Celular baixo = pescoço inclinado = até 25 kg de carga na cervical. Suba a tela.' },
  { cat: 'Postura', titulo: 'Fortaleça as costas', texto: 'Para cada exercício de empurrar (supino), faça um de puxar (remada). Ombros saudáveis agradecem.' },
  { cat: 'Postura', titulo: 'Glúteo protege a lombar', texto: 'Glúteo fraco sobrecarrega a lombar. Ponte e agachamento ajudam quem tem dor nas costas.' },
];

export function dicaDoDia(agora = new Date()): Dica {
  const dia = Math.floor(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate()).getTime() / 86400000);
  return DICAS[((dia % DICAS.length) + DICAS.length) % DICAS.length];
}

// Pressão arterial (Diretriz Brasileira de Hipertensão 2020) e glicemia (SBD).
export function classificarPressao(s: number, d: number): { nome: string; cor: string; texto: string } {
  if (s >= 180 || d >= 110) return { nome: 'Hipertensão estágio 3', cor: 'bg-red-600', texto: 'Muito alta. Procure atendimento médico logo, principalmente se tiver dor de cabeça forte, dor no peito ou falta de ar.' };
  if (s >= 160 || d >= 100) return { nome: 'Hipertensão estágio 2', cor: 'bg-red-500', texto: 'Alta. Evite treinos muito pesados e procure seu médico.' };
  if (s >= 140 || d >= 90) return { nome: 'Hipertensão estágio 1', cor: 'bg-orange-500', texto: 'Acima do normal. Meça de novo em repouso e mostre os valores ao seu médico.' };
  if (s >= 130 || d >= 85) return { nome: 'Pré-hipertensão', cor: 'bg-amber-500', texto: 'Limítrofe. Exercício aeróbico, menos sal e menos álcool ajudam a baixar.' };
  if (s < 90 || d < 60) return { nome: 'Pressão baixa', cor: 'bg-sky-500', texto: 'Baixa. Se sentir tontura, hidrate-se e levante devagar.' };
  return { nome: 'Normal', cor: 'bg-emerald-500', texto: 'Ótima. Continue com treino regular e boa alimentação.' };
}
export function classificarGlicemia(mg: number, jejum: boolean): { nome: string; cor: string } {
  if (jejum) {
    if (mg < 70) return { nome: 'Baixa (hipoglicemia)', cor: 'bg-sky-500' };
    if (mg < 100) return { nome: 'Normal', cor: 'bg-emerald-500' };
    if (mg < 126) return { nome: 'Alterada (pré-diabetes)', cor: 'bg-amber-500' };
    return { nome: 'Alta: procure seu médico', cor: 'bg-red-500' };
  }
  if (mg < 70) return { nome: 'Baixa (hipoglicemia)', cor: 'bg-sky-500' };
  if (mg < 140) return { nome: 'Normal', cor: 'bg-emerald-500' };
  if (mg < 200) return { nome: 'Alterada', cor: 'bg-amber-500' };
  return { nome: 'Alta: procure seu médico', cor: 'bg-red-500' };
}
