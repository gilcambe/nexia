import { Link, useParams } from 'react-router-dom';
import { carregar } from '@/router/carregar';

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

// Ferramentas extras do Body Coach, todas grátis e feitas no próprio aparelho.
export const FERRAMENTAS = [
  { id: 'treinos-prontos', grupo: 'Treino', nome: 'Treinos prontos', desc: 'HIIT, abdômen, yoga, alongamento, casa e corrida, guiados por voz', icone: 'ri-play-circle-line', el: TreinosProntos },
  { id: 'contador', grupo: 'Treino', nome: 'Contador por câmera', desc: 'A câmera conta suas repetições e avisa a amplitude', icone: 'ri-camera-lens-line', el: ContadorReps },
  { id: 'relogio', grupo: 'Treino', nome: 'Relógio e batimentos', desc: 'Cinta/relógio ao vivo e importar treino (GPX/TCX)', icone: 'ri-heart-pulse-line', el: Relogio },
  { id: 'corrida', grupo: 'Treino', nome: 'Corrida com GPS', desc: 'Distância, ritmo e percurso pelo celular', icone: 'ri-run-line', el: Corrida },
  { id: 'periodizacao', grupo: 'Treino', nome: 'Periodização', desc: 'Seu ciclo de 4 a 16 semanas com descarga', icone: 'ri-stack-line', el: Periodizacao },
  { id: 'dupla', grupo: 'Treino', nome: 'Treino em dupla ao vivo', desc: 'Treine com um amigo e veja a série e os batimentos dele', icone: 'ri-team-line', el: Dupla },
  { id: 'viagem', grupo: 'Treino', nome: 'Modo viagem', desc: 'Treino no hotel com o tempo e o que tiver, guiado por voz', icone: 'ri-suitcase-3-line', el: ModoViagem },
  { id: 'mapa', grupo: 'Treino', nome: 'Onde treinar perto', desc: 'Academias, parques, pistas e aparelhos ao ar livre', icone: 'ri-map-2-line', el: Mapa },
  { id: 'calculadoras', grupo: 'Treino', nome: 'Calculadoras', desc: '1RM, anilhas, zonas cardíacas, ritmo, gasto e água', icone: 'ri-calculator-line', el: Calculadoras },
  { id: 'resumo', grupo: 'Evolução', nome: 'Resumo da semana', desc: 'Sequência, prontidão, último treino, peso e relatório semanal', icone: 'ri-dashboard-line', el: Resumo },
  { id: 'evolucao-carga', grupo: 'Evolução', nome: 'Evolução de carga', desc: 'Gráfico e recordes de cada exercício', icone: 'ri-line-chart-line', el: EvolucaoCarga },
  { id: 'conquistas', grupo: 'Evolução', nome: 'Conquistas e nível', desc: 'Medalhas, XP e sequência de treinos', icone: 'ri-trophy-line', el: Conquistas },
  { id: 'ranking', grupo: 'Evolução', nome: 'Ranking e desafios', desc: 'Pontos da semana na equipe do seu coach', icone: 'ri-medal-line', el: Ranking },
  { id: 'retrospectiva', grupo: 'Evolução', nome: 'Retrospectiva do mês', desc: 'Seus números do mês, prontos para postar', icone: 'ri-movie-2-line', el: Retrospectiva },
  { id: 'lista-compras', grupo: 'Nutrição', nome: 'Lista de compras', desc: 'Tudo da sua dieta para a semana', icone: 'ri-shopping-cart-2-line', el: ListaCompras },
  { id: 'jejum', grupo: 'Nutrição', nome: 'Jejum intermitente', desc: 'Cronômetro 12:12 até 20:4 (opcional)', icone: 'ri-hourglass-line', el: Jejum },
  { id: 'suplementos', grupo: 'Nutrição', nome: 'Suplementos', desc: 'Lista, horários, lembrete e check do dia', icone: 'ri-capsule-line', el: Suplementos },
  { id: 'saude', grupo: 'Saúde', nome: 'Pressão, glicemia e check-up', desc: 'Registro com gráfico e lembretes de exames', icone: 'ri-heart-add-line', el: Saude },
  { id: 'dicas', grupo: 'Saúde', nome: 'Dicas de saúde', desc: 'Sono, água, comida, treino, mente e postura', icone: 'ri-lightbulb-flash-line', el: Dicas },
  { id: 'ciclo', grupo: 'Saúde', nome: 'Ciclo menstrual', desc: 'Treino e dieta ajustados à fase (opcional)', icone: 'ri-drop-line', el: Ciclo },
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

export default function Ferramentas() {
  const { id } = useParams();
  const atual = FERRAMENTAS.find((f) => f.id === id);
  if (atual) {
    const El = atual.el;
    return (
      <div className="space-y-4">
        <Link to="/ferramentas" className="inline-flex items-center gap-1 text-sm font-medium text-primary-700">
          <i className="ri-arrow-left-line"></i>Ferramentas
        </Link>
        <header className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-primary-100 text-xl text-primary-700"><i className={atual.icone}></i></span>
          <div>
            <h1 className="font-heading text-2xl font-bold text-foreground-950">{atual.nome}</h1>
            <p className="text-sm text-foreground-500">{atual.desc}</p>
          </div>
        </header>
        <El />
      </div>
    );
  }
  const grupos = [...new Set(FERRAMENTAS.map((f) => f.grupo))];
  return (
    <div className="space-y-5">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Ferramentas</h1>
        <p className="mt-1 text-sm text-foreground-600">Tudo o que ajuda no treino, na dieta e na constância. Grátis e no seu celular.</p>
      </header>
      {grupos.map((g) => (
        <section key={g}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">{g}</h2>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {FERRAMENTAS.filter((f) => f.grupo === g).map((f) => (
              <Link key={f.id} to={`/ferramentas/${f.id}`} className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-3.5 transition active:scale-[0.99] hover:border-primary-300">
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-xl text-primary-700"><i className={f.icone}></i></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground-950">{f.nome}</span>
                  <span className="block text-xs text-foreground-500">{f.desc}</span>
                </span>
                <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
              </Link>
            ))}
          </div>
        </section>
      ))}
      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Mais telas</h2>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {MAIS_TELAS.map((f) => (
            <Link key={f.to} to={f.to} className="flex items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-3.5 transition active:scale-[0.99] hover:border-primary-300">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-xl text-primary-700"><i className={f.icone}></i></span>
              <span className="min-w-0 flex-1">
                <span className="block font-semibold text-foreground-950">{f.nome}</span>
                <span className="block text-xs text-foreground-500">{f.desc}</span>
              </span>
              <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
