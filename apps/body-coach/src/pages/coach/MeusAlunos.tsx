import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { painelAlunos, sumiu, type LinhaAluno, type Painel } from '@/lib/coach/alunos';
import { quemPrecisaDeAtencao, linkMensagem } from '@/lib/coach/atencao';

type Filtro = 'todos' | 'sumiram' | 'semficha' | 'naopagou';

function quando(a: LinhaAluno): string {
  if (a.treinouHoje) return 'Treinou hoje';
  if (a.diasSemTreinar == null) return 'Ainda não treinou pelo app';
  if (a.diasSemTreinar === 1) return 'Treinou ontem';
  return `Sem treinar há ${a.diasSemTreinar} dias`;
}

// Painel do coach: num olhar, quem treinou, quem sumiu, quem comeu, quem pagou e quem ainda não tem ficha ou dieta.
export default function MeusAlunos() {
  const [p, setP] = useState<Painel | null>(null);
  const [erro, setErro] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');

  useEffect(() => { painelAlunos().then(setP).catch((e: Error) => setErro(e.message)); }, []);

  const alunos = p?.alunos ?? [];
  const conta = {
    hoje: alunos.filter((a) => a.treinouHoje).length,
    sumiram: alunos.filter(sumiu).length,
    semficha: alunos.filter((a) => !a.temFicha).length,
    naopagou: alunos.filter((a) => !a.pago && a.vinculo !== 'parceiro').length,
  };
  const atencao = quemPrecisaDeAtencao(alunos);
  const lista = alunos
    .filter((a) => filtro === 'todos' || (filtro === 'sumiram' ? sumiu(a) : filtro === 'semficha' ? !a.temFicha : !a.pago && a.vinculo !== 'parceiro'))
    .sort((x, y) => Number(sumiu(y)) - Number(sumiu(x)) || (y.diasSemTreinar ?? 999) - (x.diasSemTreinar ?? 999) || x.nome.localeCompare(y.nome));

  const tituloFiltro = filtro === 'sumiram' ? 'Quem precisa de atenção hoje' : filtro === 'semficha' ? 'Sem ficha do coach' : filtro === 'naopagou' ? 'Não pagaram' : '';
  const escolher = (f: Filtro) => setFiltro((atual) => (atual === f ? 'todos' : f));

  // Tudo numa tela: 4 números que também filtram, e uma linha curta por aluno (o detalhe abre no toque).
  return (
    <div className="space-y-3">
      <header className="flex items-center justify-between gap-2">
        <h1 className="font-heading text-xl font-bold text-foreground-950">Meus alunos{alunos.length ? ` (${alunos.length})` : ''}</h1>
        <Link to="/coach/convites" className="shrink-0 rounded-lg border border-background-200 px-2.5 py-1.5 text-xs font-semibold text-foreground-700"><i className="ri-user-add-line mr-1 text-primary-600"></i>Convidar</Link>
      </header>

      {p == null && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {p && alunos.length === 0 && (
        <Card padding="p-5"><p className="text-sm text-foreground-600">Nenhum aluno ainda. Passe o seu código em <Link to="/chat" className="font-semibold text-primary-600">Conversa</Link> ou traga a sua lista em <Link to="/coach/convites" className="font-semibold text-primary-600">Convidar alunos</Link>.</p></Card>
      )}

      {alunos.length > 0 && (
        <>
          <div className="grid grid-cols-4 gap-1.5" data-testid="resumo-alunos">
            <Resumo valor={`${conta.hoje}/${alunos.length}`} rotulo="treinaram hoje" cor="text-accent-700" ativo={filtro === 'todos'} onClick={() => setFiltro('todos')} />
            <Resumo valor={conta.sumiram} rotulo="sumiram (3+ dias)" cor={conta.sumiram ? 'text-red-600' : 'text-foreground-950'} ativo={filtro === 'sumiram'} onClick={() => escolher('sumiram')} />
            <Resumo valor={conta.semficha} rotulo="sem ficha" cor={conta.semficha ? 'text-secondary-800' : 'text-foreground-950'} ativo={filtro === 'semficha'} onClick={() => escolher('semficha')} />
            <Resumo valor={conta.naopagou} rotulo="não pagaram" cor={conta.naopagou ? 'text-secondary-800' : 'text-foreground-950'} ativo={filtro === 'naopagou'} onClick={() => escolher('naopagou')} />
          </div>
          {tituloFiltro && (
            <p className="flex items-center justify-between text-xs text-foreground-600" data-testid="atencao-hoje">
              <span><strong className="text-foreground-900">{tituloFiltro}</strong>{filtro === 'sumiram' && atencao.length > 0 ? ' · toque em 💬 para mandar a mensagem pronta' : ''}</span>
              <button type="button" onClick={() => setFiltro('todos')} className="font-semibold text-primary-600">Ver todos</button>
            </p>
          )}
          {lista.length === 0 && <p className="text-center text-sm text-foreground-500">Ninguém neste filtro. 👏</p>}

          <ul className="divide-y divide-background-200 overflow-hidden rounded-2xl border border-background-200 bg-background-50">
            {lista.map((a) => {
              const alerta = sumiu(a);
              const pendencias = [
                !a.temFicha && 'sem ficha',
                !a.temDieta && 'sem dieta',
                a.anamnese === 'pendente' && 'anamnese pendente',
                p?.cobra && a.vinculo !== 'parceiro' && !a.pago && (a.avisou ? 'disse que pagou' : 'não pagou'),
              ].filter(Boolean) as string[];
              const equipe = a.vinculo === 'parceiro'
                ? `🤝 você cuida d${a.equipe?.parte === 'treino' ? 'o treino' : 'a alimentação'}`
                : a.equipe ? `🤝 ${a.equipe.nome} cuida d${a.equipe.parte === 'treino' ? 'o treino' : 'a alimentação'}` : '';
              return (
                <li key={a.uid} className="flex items-center gap-2 px-3 py-2">
                  <Link to={`/coach/alunos/${a.uid}`} className="flex min-w-0 flex-1 items-center gap-2.5" aria-label={`Abrir ${a.nome}: ficha e dieta`}>
                    {a.foto ? <img src={a.foto} alt="" className="h-9 w-9 shrink-0 rounded-full object-cover" /> : <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-3-line"></i></span>}
                    <div className="min-w-0 flex-1 leading-tight">
                      <p className="truncate text-sm font-semibold text-foreground-950">{a.nome}</p>
                      <p className={`truncate text-xs ${a.treinouHoje ? 'text-accent-700' : alerta ? 'text-red-600' : 'text-foreground-500'}`}>
                        {a.treinouHoje ? '✅ ' : alerta ? '⚠️ ' : ''}{quando(a)}
                      </p>
                      <p className="truncate text-[11px] text-foreground-500">
                        {a.treinosSemana} treino{a.treinosSemana === 1 ? '' : 's'}/sem · 🍽️ {a.refeicoesHoje} hoje
                        {(pendencias.length > 0 || equipe) && <span className="font-medium text-secondary-800"> · {[...pendencias, equipe].filter(Boolean).join(' · ')}</span>}
                      </p>
                    </div>
                  </Link>
                  <Link to={alerta ? linkMensagem(a) : `/chat?com=${a.uid}`} className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${alerta ? 'bg-primary-500 text-background-50' : 'border border-background-200 text-foreground-600'}`} aria-label={alerta ? `Mandar mensagem pronta para ${a.nome}` : `Conversar com ${a.nome}`}><i className="ri-chat-smile-2-line"></i></Link>
                  <Link to={`/coach/evolucao/${a.uid}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-background-200 text-foreground-600" aria-label={`Evolução de ${a.nome}`}><i className="ri-line-chart-line"></i></Link>
                </li>
              );
            })}
          </ul>
          {p?.cobra === false && <p className="text-center text-xs text-foreground-500">Quer ver quem pagou? Cadastre a sua chave Pix em <Link to="/ferramentas/mensalidade" className="font-semibold text-primary-600">Mensalidade</Link>.</p>}
        </>
      )}
    </div>
  );
}

function Resumo({ valor, rotulo, cor, ativo, onClick }: { valor: number | string; rotulo: string; cor: string; ativo: boolean; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-pressed={ativo} className={`rounded-xl border px-1.5 py-2 text-center ${ativo ? 'border-primary-400 bg-primary-50' : 'border-background-200 bg-background-50'}`}>
      <p className={`font-heading text-lg font-bold leading-none ${cor}`}>{valor}</p>
      <p className="mt-1 text-[11px] leading-tight text-foreground-500">{rotulo}</p>
    </button>
  );
}
