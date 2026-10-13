import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { chatApi } from '@/lib/chat';
import Barras from './Barras';
import Ferramentas from './Ferramentas';
import { reais, type Cupom, type Resumo } from './painelTipos';

// Painel do dono: números do app, uso, receita e as ferramentas de venda (presente, cupom, promoção).
export default function PainelAdmin() {
  const [resumo, setResumo] = useState<Resumo | null>(null);
  const [cupons, setCupons] = useState<Cupom[]>([]);
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    try {
      const [r, c] = await Promise.all([chatApi<Resumo>({ acao: 'dono_resumo' }), chatApi<{ cupons: Cupom[] }>({ acao: 'cupom_lista' })]);
      setResumo(r); setCupons(c.cupons);
    } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => { void carregar(); }, []);
  const fazer = async (corpo: Record<string, unknown>, ok: string) => {
    setMsg('');
    try { await chatApi(corpo); setMsg(ok); await carregar(); } catch (e) { setMsg((e as Error).message); }
  };

  const numero = (rotulo: string, valor: string | number) => (
    <Card><p className="text-xs text-foreground-500">{rotulo}</p><p className="font-heading text-xl font-bold text-foreground-950">{valor}</p></Card>
  );
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">Painel do dono</h1>
      {msg && <p role="status" className="rounded-lg bg-primary-50 p-2 text-sm text-primary-800">{msg}</p>}
      {!resumo ? <p className="text-sm text-foreground-500">{msg ? '' : 'Carregando...'}</p> : (
        <>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {numero('Usuários', resumo.total)}
            {numero('Pagantes', resumo.pagantes)}
            {numero('Em teste grátis', resumo.emTeste)}
            {numero('Vencem em 7 dias', resumo.vencendo7)}
            {numero('Coaches', resumo.porTipo.coach)}
            {numero('Alunos de coach', resumo.porTipo.aluno)}
            {numero('Treinam sozinhos', resumo.porTipo.independente)}
            {numero('Receita do mês', reais(resumo.receitaMes))}
          </div>
          <Card><Barras titulo="Pessoas que abriram o app (30 dias)" itens={resumo.ativosPorDia.map((d) => ({ rotulo: d.dia.slice(8) + '/' + d.dia.slice(5, 7), valor: d.n }))} /></Card>
          <Card><Barras titulo="Cadastros novos (30 dias)" itens={resumo.novosPorDia.map((d) => ({ rotulo: d.dia.slice(8) + '/' + d.dia.slice(5, 7), valor: d.n }))} /></Card>
          <Card><Barras titulo="Receita por mês" itens={resumo.receitaPorMes.map((m) => ({ rotulo: m.mes.slice(5) + '/' + m.mes.slice(2, 4), valor: m.valor }))} formato={reais} /></Card>
        </>
      )}
      <Ferramentas cupons={cupons} fazer={fazer} />
      <Link to="/admin/acessos" className="block text-center text-sm font-semibold text-primary-700 underline">Acessos, Pix e contas</Link>
    </div>
  );
}
