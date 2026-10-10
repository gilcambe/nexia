import { Link, useParams } from 'react-router-dom';
import Conquistas from './Conquistas';
import Calculadoras from './Calculadoras';
import Corrida from './Corrida';
import Jejum from './Jejum';
import Suplementos from './Suplementos';
import Ciclo from './Ciclo';
import ListaCompras from './ListaCompras';
import Indique from './Indique';
import Planos from './Planos';
import Relogio from './Relogio';

// Ferramentas extras do Body Coach, todas grátis e feitas no próprio aparelho.
export const FERRAMENTAS = [
  { id: 'conquistas', grupo: 'Motivação', nome: 'Conquistas e nível', desc: 'Medalhas, XP e sequência de treinos', icone: 'ri-trophy-line', el: Conquistas },
  { id: 'relogio', grupo: 'Treino', nome: 'Relógio e batimentos', desc: 'Cinta/relógio ao vivo e importar treino (GPX/TCX)', icone: 'ri-heart-pulse-line', el: Relogio },
  { id: 'corrida', grupo: 'Treino', nome: 'Corrida com GPS', desc: 'Distância, ritmo e percurso pelo celular', icone: 'ri-run-line', el: Corrida },
  { id: 'calculadoras', grupo: 'Treino', nome: 'Calculadoras', desc: '1RM, anilhas, zonas cardíacas, ritmo, gasto e água', icone: 'ri-calculator-line', el: Calculadoras },
  { id: 'lista-compras', grupo: 'Nutrição', nome: 'Lista de compras', desc: 'Tudo da sua dieta para a semana', icone: 'ri-shopping-cart-2-line', el: ListaCompras },
  { id: 'jejum', grupo: 'Nutrição', nome: 'Jejum intermitente', desc: 'Cronômetro 12:12 até 20:4 (opcional)', icone: 'ri-hourglass-line', el: Jejum },
  { id: 'suplementos', grupo: 'Nutrição', nome: 'Suplementos', desc: 'Lista, horários, lembrete e check do dia', icone: 'ri-capsule-line', el: Suplementos },
  { id: 'ciclo', grupo: 'Saúde', nome: 'Ciclo menstrual', desc: 'Treino e dieta ajustados à fase (opcional)', icone: 'ri-drop-line', el: Ciclo },
  { id: 'indique', grupo: 'Comunidade', nome: 'Indique e compartilhe', desc: 'Seu link, cartão do treino e embaixador', icone: 'ri-gift-line', el: Indique },
  { id: 'planos', grupo: 'Comunidade', nome: 'Planos', desc: 'Grátis, Premium e para personais', icone: 'ri-vip-crown-line', el: Planos },
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
    </div>
  );
}
