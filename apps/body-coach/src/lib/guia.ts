// Guia do app: o mesmo texto aparece no tour da primeira vez e na tela "Guia do app" para consultar depois.
export interface PassoGuia { icone: string; titulo: string; texto: string; rota?: string; tour?: boolean }

export const GUIA_ALUNO: PassoGuia[] = [
  { icone: 'ri-hand-heart-line', titulo: 'Bem-vindo ao Body Coach', texto: 'Aqui você treina, come melhor e acompanha a sua evolução. Vamos mostrar o principal em poucos passos.', tour: true },
  { icone: 'ri-sun-line', titulo: 'Hoje', texto: 'A tela inicial mostra o treino do dia, as refeições, a água e o check-in de como você acordou. Comece o dia por aqui.', rota: '/', tour: true },
  { icone: 'ri-play-fill', titulo: 'Treino', texto: 'Toque no botão redondo do meio para treinar. Marque cada série com o peso e as repetições. Use "Anterior" e "Próximo" para andar entre os exercícios e "Fiz outro exercício" se trocar algum.', rota: '/workout', tour: true },
  { icone: 'ri-restaurant-line', titulo: 'Nutrição', texto: 'Veja a sua dieta, marque o que comeu e troque um alimento por outro parecido. O copo marca a água do dia.', rota: '/nutrition', tour: true },
  { icone: 'ri-line-chart-line', titulo: 'Evolução', texto: 'Peso, medidas, fotos e avaliações. Veja o antes e depois e o gráfico de cada exercício.', rota: '/evolution', tour: true },
  { icone: 'ri-calendar-line', titulo: 'Ficha de treino', texto: 'A ficha completa da semana. Se você tem coach, é ele quem monta; você só segue.', rota: '/plan' },
  { icone: 'ri-chat-3-line', titulo: 'Conversa com o coach', texto: 'Fale com o seu personal como no WhatsApp. Mande vídeo da execução para ele corrigir.', rota: '/chat', tour: true },
  { icone: 'ri-robot-2-line', titulo: 'Coach de IA', texto: 'O botão "Coach" responde dúvidas de treino, dieta e descanso a qualquer hora.', tour: true },
  { icone: 'ri-apps-2-line', titulo: 'Ferramentas', texto: 'Treinos prontos, corrida com GPS, calculadoras, lista de compras, suplementos, ranking e muito mais.', rota: '/ferramentas', tour: true },
  { icone: 'ri-notification-3-line', titulo: 'Avisos no celular', texto: 'Ligue os lembretes de treino, água e mensagens do coach.', rota: '/avisos' },
  { icone: 'ri-vip-crown-line', titulo: 'Minha assinatura', texto: 'Veja até quando o seu acesso está liberado e como pagar por Pix.', rota: '/acesso' },
  { icone: 'ri-book-open-line', titulo: 'Guia do app', texto: 'Ficou com dúvida? Abra o menu e toque em "Guia do app" para ver tudo isto de novo.', rota: '/guia', tour: true },
];

export const GUIA_COACH: PassoGuia[] = [
  { icone: 'ri-hand-heart-line', titulo: 'Bem-vindo, coach', texto: 'Aqui você cuida de todos os seus alunos num lugar só. Vamos mostrar o principal em poucos passos.', tour: true },
  { icone: 'ri-user-add-line', titulo: 'Convidar alunos', texto: 'Mande o seu link ou código pelo WhatsApp. Quem entrar vira seu aluno e já aparece na sua lista.', rota: '/coach/convites', tour: true },
  { icone: 'ri-team-line', titulo: 'Meus alunos', texto: 'Toque num aluno para montar a ficha de treino e a dieta. Ele recebe na hora no celular.', rota: '/coach/alunos', tour: true },
  { icone: 'ri-file-copy-2-line', titulo: 'Modelos', texto: 'Crie uma ficha ou dieta modelo e aplique em vários alunos de uma vez.', rota: '/coach/modelos', tour: true },
  { icone: 'ri-questionnaire-line', titulo: 'Anamnese', texto: 'Monte as perguntas que o aluno responde ao entrar (saúde, lesões, objetivo).', rota: '/coach/anamnese' },
  { icone: 'ri-chat-3-line', titulo: 'Conversa', texto: 'Fale com cada aluno separado. Veja os vídeos de execução que eles mandam e responda.', rota: '/chat', tour: true },
  { icone: 'ri-line-chart-line', titulo: 'Evolução dos alunos', texto: 'Peso, medidas, avaliações e cargas de cada aluno. Agende a próxima avaliação.', rota: '/coach/evolucao', tour: true },
  { icone: 'ri-video-add-line', titulo: 'Vídeos de execução', texto: 'Grave você fazendo o exercício. O vídeo aparece para todos os seus alunos.', rota: '/coach/demonstracoes' },
  { icone: 'ri-money-dollar-circle-line', titulo: 'Financeiro e Pix', texto: 'Cadastre a sua chave Pix, veja quem pagou a mensalidade e mande lembrete de cobrança.', rota: '/coach/financeiro', tour: true },
  { icone: 'ri-store-2-line', titulo: 'Programas à venda', texto: 'Venda treinos prontos numa loja com o seu link.', rota: '/coach/programas' },
  { icone: 'ri-palette-line', titulo: 'Minha marca', texto: 'Coloque o seu logo, nome e cor. Seus alunos veem o app com a sua marca.', rota: '/coach/marca' },
  { icone: 'ri-vip-crown-line', titulo: 'Minha assinatura', texto: 'Veja até quando o seu acesso está liberado e como pagar por Pix.', rota: '/acesso' },
  { icone: 'ri-book-open-line', titulo: 'Guia do app', texto: 'Ficou com dúvida? Abra o menu e toque em "Guia do app" para ver tudo isto de novo.', rota: '/guia', tour: true },
];

export const guiaDo = (papel: string | null) => (papel === 'coach' ? GUIA_COACH : GUIA_ALUNO);
const chave = (papel: string, uid: string) => `bc_tour_${papel === 'coach' ? 'coach' : 'aluno'}_${uid}`;
export function tourVisto(papel: string, uid: string): boolean { try { return localStorage.getItem(chave(papel, uid)) === '1'; } catch { return true; } }
export function marcarTourVisto(papel: string, uid: string) { try { localStorage.setItem(chave(papel, uid), '1'); } catch { /* sem armazenamento */ } }
// "Rever o tour" na tela do guia.
export const abrirTour = () => window.dispatchEvent(new Event('bc-tour'));
