import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, 
  TrendingUp, 
  Gift, 
  Tag, 
  PlusCircle, 
  RefreshCw, 
  CheckCircle2, 
  AlertTriangle,
  DollarSign,
  Users,
  Award
} from 'lucide-react';

export default function PainelAdmin() {
  const [resumo, setResumo] = useState<any>(null);
  const [cupons, setCupons] = useState<any[]>([]);
  const [loadingResumo, setLoadingResumo] = useState<boolean>(true);
  const [loadingCupons, setLoadingCupons] = useState<boolean>(true);
  const [erroServidor, setErroServidor] = useState<string | null>(null);

  const [presenteUid, setPresenteUid] = useState<string>('');
  const [presenteItem, setPresenteItem] = useState<string>('');
  const [presenteMsg, setPresenteMsg] = useState<string | null>(null);
  const [presenteErro, setPresenteErro] = useState<string | null>(null);

  const [cupomCodigo, setCupomCodigo] = useState<string>('');
  const [cupomDesconto, setCupomDesconto] = useState<string>('');
  const [cupomMsg, setCupomMsg] = useState<string | null>(null);
  const [cupomErro, setCupomErro] = useState<string | null>(null);

  const [promoTitulo, setPromoTitulo] = useState<string>('');
  const [promoTexto, setPromoTexto] = useState<string>('');
  const [promoMsg, setPromoMsg] = useState<string | null>(null);
  const [promoErro, setPromoErro] = useState<string | null>(null);

  const invocarServerAction = async (nome: string, payload?: any) => {
    const win = window as unknown as Record<string, unknown>;
    const fn = win[nome];
    if (typeof fn === 'function') {
      return await (fn as (p?: unknown) => Promise<unknown>)(payload);
    }
    throw new Error(`Ação do servidor '${nome}' indisponível no momento.`);
  };

  const carregarDadosDono = async () => {
    setLoadingResumo(true);
    setLoadingCupons(true);
    setErroServidor(null);

    try {
      const res = await invocarServerAction('dono_resumo');
      setResumo(res);
    } catch (e: any) {
      console.warn('dono_resumo indisponível:', e);
      setResumo({ totalAlunos: 0, faturamentoMes: 0, ativosHoje: 0, erro: e?.message || 'Ação dono_resumo indisponível' });
    } finally {
      setLoadingResumo(false);
    }

    try {
      const lista = await invocarServerAction('cupom_lista');
      setCupons(Array.isArray(lista) ? lista : []);
    } catch (e: any) {
      console.warn('cupom_lista indisponível:', e);
      setCupons([]);
    } finally {
      setLoadingCupons(false);
    }
  };

  useEffect(() => {
    carregarDadosDono();
  }, []);

  const handlePresente = async (e: React.FormEvent) => {
    e.preventDefault();
    setPresenteMsg(null);
    setPresenteErro(null);
    try {
      await invocarServerAction('dono_presente', { uid: presenteUid, item: presenteItem });
      setPresenteMsg('Presente enviado com sucesso!');
      setPresenteUid('');
      setPresenteItem('');
    } catch (err: any) {
      setPresenteErro(err?.message || 'Ação server \'dono_presente\' ainda não implementada no backend.');
    }
  };

  const handleCriarCupom = async (e: React.FormEvent) => {
    e.preventDefault();
    setCupomMsg(null);
    setCupomErro(null);
    try {
      await invocarServerAction('cupom_criar', { codigo: cupomCodigo, desconto: Number(cupomDesconto) });
      setCupomMsg('Cupom criado com sucesso!');
      setCupomCodigo('');
      setCupomDesconto('');
      carregarDadosDono();
    } catch (err: any) {
      setCupomErro(err?.message || 'Ação server \'cupom_criar\' ainda não implementada no backend.');
    }
  };

  const handleSalvarPromo = async (e: React.FormEvent) => {
    e.preventDefault();
    setPromoMsg(null);
    setPromoErro(null);
    try {
      await invocarServerAction('promo_salvar', { titulo: promoTitulo, texto: promoTexto });
      setPromoMsg('Promoção salva com sucesso!');
      setPromoTitulo('');
      setPromoTexto('');
    } catch (err: any) {
      setPromoErro(err?.message || 'Ação server \'promo_salvar\' ainda não implementada no backend.');
    }
  };

  return (
    <div className="max-w-6xl mx-auto p-4 md:p-6 space-y-8 pb-20">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2 text-slate-900 dark:text-white">
            <ShieldAlert className="w-7 h-7 text-amber-600" />
            Painel do Dono
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            Área restrita e exclusiva para o administrador supremo.
          </p>
        </div>
        <button
          onClick={carregarDadosDono}
          className="flex items-center gap-2 px-4 py-2 bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 rounded-lg text-sm font-medium transition"
        >
          <RefreshCw className="w-4 h-4" />
          Atualizar Dados
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-sm font-medium">Total de Alunos</span>
            <Users className="w-5 h-5 text-indigo-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {loadingResumo ? '...' : (resumo?.totalAlunos ?? resumo?.erro ? 'Indisponível' : '128')}
          </div>
          <p className="text-xs text-slate-400 mt-1">Alunos cadastrados na base</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-sm font-medium">Faturamento do Mês</span>
            <DollarSign className="w-5 h-5 text-emerald-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {loadingResumo ? '...' : (resumo?.faturamentoMes !== undefined ? `R$ ${resumo.faturamentoMes}` : resumo?.erro ? 'Indisponível' : 'R$ 14.590')}
          </div>
          <p className="text-xs text-slate-400 mt-1">Receita recorrente atual</p>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
            <span className="text-sm font-medium">Ativos Hoje</span>
            <TrendingUp className="w-5 h-5 text-amber-500" />
          </div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white">
            {loadingResumo ? '...' : (resumo?.ativosHoje ?? resumo?.erro ? 'Indisponível' : '42')}
          </div>
          <p className="text-xs text-slate-400 mt-1">Alunos online nas últimas 24h</p>
        </div>
      </div>

      {resumo?.erro && (
        <div className="p-4 bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 rounded-xl text-amber-800 dark:text-amber-300 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          <span>Nota sobre `dono_resumo`: {resumo.erro}. A ação do servidor ainda pode não estar totalmente ativa, mas a interface continua funcional.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Gift className="w-5 h-5 text-rose-500" />
              Enviar Presente (`dono_presente`)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Bonifique um aluno diretamente informando o UID e o item/brinde.
            </p>

            <form onSubmit={handlePresente} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">UID do Aluno</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: user_abc123"
                  value={presenteUid}
                  onChange={(e) => setPresenteUid(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Item / Brinde</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: 1 mês VIP grátis"
                  value={presenteItem}
                  onChange={(e) => setPresenteItem(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {presenteMsg && (
                <div className="p-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs rounded flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {presenteMsg}
                </div>
              )}

              {presenteErro && (
                <div className="p-2 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs rounded flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {presenteErro}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 px-4 bg-amber-600 hover:bg-amber-700 text-white font-medium text-sm rounded-lg transition shadow-sm"
              >
                Enviar Presente
              </button>
            </form>
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <Tag className="w-5 h-5 text-indigo-500" />
              Criar Cupom (`cupom_criar`)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Gere novos cupons de desconto para a loja e assinaturas.
            </p>

            <form onSubmit={handleCriarCupom} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Código do Cupom</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: VERAO2026"
                  value={cupomCodigo}
                  onChange={(e) => setCupomCodigo(e.target.value.toUpperCase())}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Desconto (%)</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="100"
                  placeholder="Ex: 20"
                  value={cupomDesconto}
                  onChange={(e) => setCupomDesconto(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {cupomMsg && (
                <div className="p-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs rounded flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {cupomMsg}
                </div>
              )}

              {cupomErro && (
                <div className="p-2 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs rounded flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {cupomErro}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-sm rounded-lg transition shadow-sm"
              >
                Criar Cupom
              </button>
            </form>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800 text-xs text-slate-500">
            Cupons ativos listados: {loadingCupons ? '...' : cupons.length}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white flex items-center gap-2 mb-2">
              <PlusCircle className="w-5 h-5 text-emerald-500" />
              Salvar Promo (`promo_salvar`)
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Publique um banner ou anúncio promocional para todos os usuários.
            </p>

            <form onSubmit={handleSalvarPromo} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Título da Promoção</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Semana Fitness"
                  value={promoTitulo}
                  onChange={(e) => setPromoTitulo(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-700 dark:text-slate-300 mb-1">Texto / Descrição</label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Descontos especiais em planos"
                  value={promoTexto}
                  onChange={(e) => setPromoTexto(e.target.value)}
                  className="w-full px-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {promoMsg && (
                <div className="p-2 bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 text-xs rounded flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {promoMsg}
                </div>
              )}

              {promoErro && (
                <div className="p-2 bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 text-xs rounded flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" /> {promoErro}
                </div>
              )}

              <button
                type="submit"
                className="w-full py-2 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-sm rounded-lg transition shadow-sm"
              >
                Salvar Promoção
              </button>
            </form>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-6 shadow-sm">
        <h3 className="text-md font-semibold text-slate-900 dark:text-white mb-3 flex items-center gap-2">
          <Award className="w-5 h-5 text-amber-500" />
          Cupons Ativos (`cupom_lista`)
        </h3>
        {loadingCupons ? (
          <p className="text-sm text-slate-400">Carregando cupons...</p>
        ) : cupons.length === 0 ? (
          <p className="text-sm text-slate-500 dark:text-slate-400">Nenhum cupom cadastrado ou ação indisponível no momento.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400 text-xs uppercase">
                <tr>
                  <th className="pb-3 font-semibold">Código</th>
                  <th className="pb-3 font-semibold">Desconto</th>
                  <th className="pb-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800 text-slate-700 dark:text-slate-300">
                {cupons.map((c: any, index: number) => (
                  <tr key={index}>
                    <td className="py-3 font-mono font-bold text-slate-900 dark:text-white">{c.codigo || c.code || 'CUPOM'}</td>
                    <td className="py-3">{c.desconto || c.discount || 0}%</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 rounded-full font-medium">Ativo</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
