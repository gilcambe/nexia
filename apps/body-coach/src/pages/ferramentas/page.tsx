import { Link, useParams } from 'react-router-dom';
import { carregar } from '@/router/carregar';
import Abas, { useAba } from '@/components/base/Abas';

// Cada ferramenta só baixa quando o aluno abre (app mais leve).
const Conquistas = carregar(() => import('./Conquistas'));
const Calculadoras = carregar(() => import('./Calculadoras'));
const Corrida = carregar(() => import('./Corrida'));
const Jejum = carregar(() => import('./Jejum'));
const Suplementos = carregar(() => import('./Suplementos'));
const Ciclo = carregar(() => import('./Ciclo'));
const ListaCompras = carregar(() => import('./ListaCompras'));
const Indique = carregar(() => import('./Indique'));
const Planos = carregar(() => import('./Planos'));
const Relogio = carregar(() => import('./Relogio'));
const TreinosProntos = carregar(() => import('./TreinosProntos'));
const ContadorReps = carregar(() => import('./ContadorReps'));
const EvolucaoCarga = carregar(() => import('./EvolucaoCarga'));
const Periodizacao = carregar(() => import('./Periodizacao'));
const Retrospectiva = carregar(() => import('./Retrospectiva'));
const Dicas = carregar(() => import('./Dicas'));
const Saude = carregar(() => import('./Saude'));
const Loja = carregar(() => import('./Loja'));
const MeusDados = carregar(() => import('./MeusDados'));
const Dupla = carregar(() => import('./Dupla'));
const Ranking = carregar(() => import('./Ranking'));
const Mapa = carregar(() => import('./Mapa'));
const ModoViagem = carregar(() => import('./ModoViagem'));
const Mensalidade = carregar(() => import('./Mensalidade'));
const Resumo = carregar(() => import('./Resumo'));
const PostInstagram = carregar(() => import('./PostInstagram'));
const Desafio30 = carregar(() => import('./Desafio30'));
const Cardio = carregar(() => import('./Cardio'));
const AvaliarFoto = carregar(() => import('./AvaliarFoto'));

// Ferramentas extras do Body Coach, todas grátis e feitas no próprio aparelho.
export const FERRAMENTAS = [
  { id: 'treinos-prontos', grupo: 'Treino', nome: 'Treinos prontos', desc: 'HIIT, abdômen, yoga, alongamento, casa e corrida, guiados por voz', icone: 'ri-play-circle-line', el: TreinosProntos },
  { id: 'contador', grupo: 'Treino', nome: 'Contador por câmera', desc: 'A câmera conta suas repetições e avisa a amplitude', icone: 'ri-camera-lens-line', el: ContadorReps },
  { id: 'relogio', grupo: 'Treino', nome: 'Relógio e batimentos', desc: 'Cinta/relógio ao vivo e importar treino (GPX/TCX)', icone: 'ri-heart-pulse-line', el: Relogio },
  { id: 'cardio', grupo: 'Treino', nome: 'Cardio por foto', desc: 'Foto do painel da esteira, bike ou escada: lê tempo, km e calorias e soma na semana', icone: 'ri-camera-lens-line', el: Cardio },
  { id: 'corrida', grupo: 'Treino', nome: 'Corrida com GPS', desc: 'Distância, ritmo e percurso pelo celular', icone: 'ri-run-line', el: Corrida },
  { id: 'periodizacao', grupo: 'Treino', nome: 'Periodização', desc: 'Seu ciclo de 4 a 16 semanas com descarga', icone: 'ri-stack-line', el: Periodizacao },
  { id: 'dupla', grupo: 'Treino', nome: 'Treino em dupla ao vivo', desc: 'Treine com um amigo e veja a série e os batimentos dele', icone: 'ri-team-line', el: Dupla },
  { id: 'viagem', grupo: 'Treino', nome: 'Modo viagem', desc: 'Treino no hotel com o tempo e o que tiver, guiado por voz', icone: 'ri-suitcase-3-line', el: ModoViagem },
  { id: 'mapa', grupo: 'Treino', nome: 'Onde treinar perto', desc: 'Academias, parques, pistas e aparelhos ao ar livre', icone: 'ri-map-2-line', el: Mapa },
  { id: 'calculadoras', grupo: 'Treino', nome: 'Calculadoras', desc: '1RM, anilhas, zonas cardíacas, ritmo, gasto e água', icone: 'ri-calculator-line', el: Calculadoras },
  { id: 'desafio30', grupo: 'Treino', nome: 'Desafio 30 dias', desc: 'Uma tarefa por dia, sequência e certificado para postar (Premium)', icone: 'ri-fire-line', el: Desafio30 },
  { id: 'resumo', grupo: 'Evolução', nome: 'Resumo da semana', desc: 'Sequência, prontidão, último treino, peso e relatório semanal', icone: 'ri-dashboard-line', el: Resumo },
  { id: 'evolucao-carga', grupo: 'Evolução', nome: 'Evolução de carga', desc: 'Gráfico e recordes de cada exercício', icone: 'ri-line-chart-line', el: EvolucaoCarga },
  { id: 'conquistas', grupo: 'Evolução', nome: 'Conquistas e nível', desc: 'Medalhas, XP e sequência de treinos', icone: 'ri-trophy-line', el: Conquistas },
  { id: 'ranking', grupo: 'Evolução', nome: 'Ranking e desafios', desc: 'Pontos da semana na equipe do seu coach', icone: 'ri-medal-line', el: Ranking },
  { id: 'retrospectiva', grupo: 'Evolução', nome: 'Retrospectiva do mês', desc: 'Seus números do mês, prontos para postar', icone: 'ri-movie-2-line', el: Retrospectiva },
  { id: 'avaliar', grupo: 'Nutrição', nome: 'Avaliar por foto', desc: 'Foto de suplemento, rótulo, prato ou exame: a IA avalia e recomenda', icone: 'ri-scan-2-line', el: AvaliarFoto },
  { id: 'lista-compras', grupo: 'Nutrição', nome: 'Lista de compras', desc: 'Tudo da sua dieta para a semana', icone: 'ri-shopping-cart-2-line', el: ListaCompras },
  { id: 'jejum', grupo: 'Nutrição', nome: 'Jejum intermitente', desc: 'Cronômetro 12:12 até 20:4 (opcional)', icone: 'ri-hourglass-line', el: Jejum },
  { id: 'suplementos', grupo: 'Nutrição', nome: 'Suplementos', desc: 'Lista, horários, lembrete e check do dia', icone: 'ri-capsule-line', el: Suplementos },
  { id: 'saude', grupo: 'Saúde', nome: 'Pressão, glicemia e check-up', desc: 'Registro com gráfico e lembretes de exames', icone: 'ri-heart-add-line', el: Saude },
  { id: 'dicas', grupo: 'Saúde', nome: 'Dicas de saúde', desc: 'Sono, água, comida, treino, mente e postura', icone: 'ri-lightbulb-flash-line', el: Dicas },
  { id: 'ciclo', grupo: 'Saúde', nome: 'Ciclo menstrual', desc: 'Treino e dieta ajustados à fase (opcional)', icone: 'ri-drop-line', el: Ciclo },
  { id: 'post', grupo: 'Loja e comunidade', nome: 'Post para o Instagram', desc: 'Fotos e vídeos do treino viram post ou vídeo com a sua marca', icone: 'ri-instagram-line', el: PostInstagram },
  { id: 'loja', grupo: 'Loja e comunidade', nome: 'Loja', desc: 'Suplementos, acessórios e tênis recomendados para você', icone: 'ri-store-2-line', el: Loja },
  { id: 'mensalidade', grupo: 'Loja e comunidade', nome: 'Mensalidade por Pix', desc: 'Aluno paga o personal direto, sem taxa; o coach marca quem pagou', icone: 'ri-qr-code-line', el: Mensalidade },
  { id: 'indique', grupo: 'Loja e comunidade', nome: 'Indique e compartilhe', desc: 'Seu link, cartão do treino e embaixador', icone: 'ri-gift-line', el: Indique },
  { id: 'planos', grupo: 'Loja e comunidade', nome: 'Planos', desc: 'Grátis, Premium e para personais', icone: 'ri-vip-crown-line', el: Planos },
  { id: 'meus-dados', grupo: 'Conta', nome: 'Meus dados', desc: 'Baixar uma cópia de tudo (LGPD)', icone: 'ri-download-cloud-line', el: MeusDados },
] as const;

// Telas que saíram do menu principal (para ele ficar simples) e continuam a um toque daqui.
export const MAIS_TELAS = [
  { to: '/plan', nome: 'Ficha de treino', desc: 'Divisão da semana, dias e lembretes', icone: 'ri-calendar-line' },
  { to: '/respirar', nome: 'Respirar', desc: 'Respiração guiada para relaxar ou focar', icone: 'ri-lungs-line' },
  { to: '/team', nome: 'Equipe', desc: 'Seu coach, nutricionista e equipe', icone: 'ri-group-line' },
  { to: '/exams', nome: 'Exames', desc: 'Exames de sangue e marcadores', icone: 'ri-stethoscope-line' },
  { to: '/antidoping', nome: 'Anti-Doping', desc: 'Confira remédios e suplementos', icone: 'ri-shield-check-line' },
  { to: '/feedback', nome: 'Enviar feedback', desc: 'Conte o que não funcionou ou uma ideia', icone: 'ri-feedback-line' },
] as const;

const ABAS_FERRAMENTAS = [
  { id: 'treino', label: 'Treino' },
  { id: 'evolucao', label: 'Evolução' },
  { id: 'saude', label: 'Saúde' },
  { id: 'mais', label: 'Loja e mais' },
] as const;
const GRUPOS_DA_ABA = { treino: ['Treino'], evolucao: ['Evolução'], saude: ['Nutrição', 'Saúde'], mais: ['Loja e comunidade', 'Conta'] } as const;

export default function Ferramentas() {
  const { id } = useParams();
  const [aba, setAba] = useAba(ABAS_FERRAMENTAS.map((a) => a.id), 'treino');
  const atual = FERRAMENTAS.find((f) => f.id === id);
  if (atual) {
    const El = atual.el;
    return (
      <div className="space-y-2">
        <Link to="/ferramentas" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
          <i className="ri-arrow-left-line"></i>Ferramentas
        </Link>
        <header className="flex items-center gap-3">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-lg text-primary-700"><i className={atual.icone}></i></span>
          <div className="min-w-0">
            <h1 className="font-heading text-lg font-bold leading-tight text-foreground-950">{atual.nome}</h1>
            <p className="text-xs leading-snug text-foreground-500">{atual.desc}</p>
          </div>
        </header>
        <El />
      </div>
    );
  }
  // Lista em abas e grade de ícones: cada grupo cabe numa tela do celular, sem rolar.
  const lista = [
    ...FERRAMENTAS.filter((f) => (GRUPOS_DA_ABA[aba] as readonly string[]).includes(f.grupo)).map((f) => ({ chave: f.id, to: `/ferramentas/${f.id}`, nome: f.nome, desc: f.desc, icone: f.icone })),
    ...(aba === 'mais' ? MAIS_TELAS.map((f) => ({ chave: f.to, to: f.to, nome: f.nome, desc: f.desc, icone: f.icone })) : []),
  ];
  return (
    <div className="space-y-2">
      <header>
        <h1 className="font-heading text-xl font-bold text-foreground-950">Ferramentas</h1>
        <p className="text-xs text-foreground-600">Grátis e no seu celular. Toque para abrir.</p>
      </header>
      <Abas abas={ABAS_FERRAMENTAS} atual={aba} onMudar={setAba} rotulo="Grupos de ferramentas" />
      <div className="grid grid-cols-4 gap-1.5">
        {lista.map((f) => (
          <Link key={f.chave} to={f.to} title={f.desc} className="flex flex-col items-center gap-1 rounded-xl border border-background-200 bg-background-50 px-1 py-2 text-center transition active:scale-[0.98] hover:border-primary-300">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary-100 text-lg text-primary-700"><i className={f.icone}></i></span>
            <span className="text-[11px] font-semibold leading-tight text-foreground-950">{f.nome}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
