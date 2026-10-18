import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { painelAlunos, sumiu, type LinhaAluno, type Painel } from '@/lib/coach/alunos';

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
  const lista = alunos
    .filter((a) => filtro === 'todos' || (filtro === 'sumiram' ? sumiu(a) : filtro === 'semficha' ? !a.temFicha : !a.pago && a.vinculo !== 'parceiro'))
    .sort((x, y) => Number(sumiu(y)) - Number(sumiu(x)) || (y.diasSemTreinar ?? 999) - (x.diasSemTreinar ?? 999) || x.nome.localeCompare(y.nome));

  return (
    <div className="space-y-4">
      <header>
        <h1 className="font-heading text-2xl font-bold text-foreground-950">Meus alunos</h1>
        <p className="mt-1 text-sm text-foreground-600">Quem treinou, quem sumiu e quem pagou. Toque no aluno para montar a ficha de treino e a dieta.</p>
      </header>
      <div className="grid grid-cols-2 gap-2">
        <Link to="/coach/financeiro" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-800"><i className="ri-money-dollar-circle-line mr-1 text-primary-600"></i>Financeiro</Link>
        <Link to="/coach/programas" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-800"><i className="ri-store-2-line mr-1 text-primary-600"></i>Programas</Link>
        <Link to="/coach/modelos" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-800"><i className="ri-stack-line mr-1 text-primary-600"></i>Modelos</Link>
        <Link to="/coach/anamnese" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-800"><i className="ri-survey-line mr-1 text-primary-600"></i>Anamnese</Link>
        <Link to="/coach/convites" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-800"><i className="ri-user-add-line mr-1 text-primary-600"></i>Convidar alunos</Link>
        <Link to="/coach/marca" className="rounded-xl border border-background-200 bg-background-50 px-3 py-2.5 text-sm font-semibold text-foreground-800"><i className="ri-palette-line mr-1 text-primary-600"></i>Minha marca</Link>
      </div>

      {p == null && !erro && <p className="text-center text-sm text-foreground-500"><i className="ri-loader-4-line mr-2 animate-spin"></i>Carregando...</p>}
      {erro && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">{erro}</p>}

      {p && alunos.length === 0 && (
        <Card padding="p-5"><p className="text-sm text-foreground-600">Nenhum aluno ainda. Passe o seu código em <Link to="/chat" className="font-semibold text-primary-600">Conversa</Link> ou traga a sua lista em <Link to="/coach/convites" className="font-semibold text-primary-600">Convidar alunos</Link>.</p></Card>
      )}

      {alunos.length > 0 && (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="resumo-alunos">
            <Resumo valor={`${conta.hoje}/${alunos.length}`} rotulo="treinaram hoje" cor="text-accent-700" />
            <Resumo valor={conta.sumiram} rotulo="3+ dias sem treinar" cor={conta.sumiram ? 'text-red-600' : 'text-foreground-950'} />
            <Resumo valor={conta.semficha} rotulo="sem ficha do coach" cor={conta.semficha ? 'text-secondary-800' : 'text-foreground-950'} />
            <Resumo valor={conta.naopagou} rotulo={`não pagaram ${p ? p.mes.split('-').reverse().join('/') : ''}`} cor={conta.naopagou ? 'text-secondary-800' : 'text-foreground-950'} />
          </div>

          <div className="grid grid-cols-4 gap-1 rounded-xl bg-background-100 p-1" role="tablist">
            {([['todos', 'Todos'], ['sumiram', 'Sumiram'], ['semficha', 'Sem ficha'], ['naopagou', 'Não pagou']] as const).map(([id, l]) => (
              <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={`rounded-lg py-1.5 text-xs font-semibold ${filtro === id ? 'bg-background-50 text-foreground-950 shadow-sm' : 'text-foreground-500'}`}>{l}</button>
            ))}
          </div>
          {lista.length === 0 && <p className="text-center text-sm text-foreground-500">Ninguém neste filtro. 👏</p>}

          <ul className="space-y-3">
            {lista.map((a) => (
              <li key={a.uid} className="rounded-2xl border border-background-200 bg-background-50 p-4">
                <Link to={`/coach/alunos/${a.uid}`} className="flex items-center gap-3" aria-label={`Abrir ${a.nome}`}>
                  {a.foto ? <img src={a.foto} alt="" className="h-11 w-11 rounded-full object-cover" /> : <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary-100 text-primary-700"><i className="ri-user-3-line"></i></span>}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-semibold text-foreground-950">{a.nome}</p>
                    <p className={`text-xs font-medium ${a.treinouHoje ? 'text-accent-700' : sumiu(a) ? 'text-red-600' : 'text-foreground-500'}`}>
                      {a.treinouHoje ? '✅ ' : sumiu(a) ? '⚠️ ' : ''}{quando(a)}
                    </p>
                  </div>
                  <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
                </Link>
                <div className="mt-3 flex flex-wrap gap-1.5 text-xs font-semibold">
                  <span className="rounded-full bg-background-100 px-2 py-0.5 text-foreground-700">{a.treinosSemana} treino{a.treinosSemana === 1 ? '' : 's'} na semana</span>
                  <span className="rounded-full bg-background-100 px-2 py-0.5 text-foreground-700">🍽️ {a.refeicoesHoje} refeiç{a.refeicoesHoje === 1 ? 'ão' : 'ões'} hoje</span>
                  {a.temFicha ? <span className="rounded-full bg-accent-50 px-2 py-0.5 text-accent-800">📋 ficha do coach</span> : <span className="rounded-full bg-secondary-50 px-2 py-0.5 text-secondary-800">sem ficha</span>}
                  {a.temDieta ? <span className="rounded-full bg-accent-50 px-2 py-0.5 text-accent-800">🥗 dieta</span> : <span className="rounded-full bg-background-100 px-2 py-0.5 text-foreground-500">sem dieta</span>}
                  {a.anamnese === 'pendente' && <span className="rounded-full bg-secondary-50 px-2 py-0.5 text-secondary-800">📝 anamnese pendente</span>}
                  {a.anamnese === 'respondida' && <span className="rounded-full bg-accent-50 px-2 py-0.5 text-accent-800">📝 anamnese</span>}
                  {a.vinculo === 'parceiro' && <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">🤝 você cuida d{a.equipe?.parte === 'treino' ? 'o treino' : 'a alimentação'} · coach: {a.equipe?.nome}</span>}
                  {a.vinculo !== 'parceiro' && a.equipe && <span className="rounded-full bg-primary-50 px-2 py-0.5 text-primary-700">🤝 {a.equipe.nome} cuida d{a.equipe.parte === 'treino' ? 'o treino' : 'a alimentação'}</span>}
                  {p?.cobra && a.vinculo !== 'parceiro' && (a.pago ? <span className="rounded-full bg-accent-50 px-2 py-0.5 text-accent-800">💸 pago</span> : a.avisou ? <span className="rounded-full bg-secondary-50 px-2 py-0.5 text-secondary-800">💸 disse que pagou</span> : <span className="rounded-full bg-red-50 px-2 py-0.5 text-red-700">💸 não pagou</span>)}
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                  <Link to={`/coach/alunos/${a.uid}`} className="rounded-lg bg-primary-500 px-2 py-2 text-center text-xs font-semibold text-background-50 dark:text-foreground-950">Ficha e dieta</Link>
                  <Link to={`/chat?com=${a.uid}`} className="rounded-lg border border-background-200 px-2 py-2 text-center text-xs font-semibold text-foreground-700">Conversar</Link>
                  <Link to={`/coach/evolucao/${a.uid}`} className="rounded-lg border border-background-200 px-2 py-2 text-center text-xs font-semibold text-foreground-700">Evolução</Link>
                  <Link to={`/coach/presenca/${a.uid}`} className="rounded-lg border border-background-200 px-2 py-2 text-center text-xs font-semibold text-foreground-700">Presença</Link>
                </div>
              </li>
            ))}
          </ul>
          {p?.cobra === false && <p className="text-center text-xs text-foreground-500">Quer ver quem pagou? Cadastre a sua chave Pix em <Link to="/ferramentas/mensalidade" className="font-semibold text-primary-600">Mensalidade</Link>.</p>}
        </>
      )}
    </div>
  );
}

function Resumo({ valor, rotulo, cor }: { valor: number | string; rotulo: string; cor: string }) {
  return (
    <div className="rounded-xl border border-background-200 bg-background-50 p-3">
      <p className={`font-heading text-xl font-bold ${cor}`}>{valor}</p>
      <p className="text-xs leading-tight text-foreground-500">{rotulo}</p>
    </div>
  );
}
