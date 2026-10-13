import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { chatApi } from '@/lib/chat';
import ContasAcesso from './ContasAcesso';
import type { Conta } from './contas';
import ResumoAcesso from './ResumoAcesso';
import PedidosAcesso, { type Pedido } from './PedidosAcesso';
import RegrasAcesso, { type Config } from './RegrasAcesso';


// Só o admin do NEXIA: quem pagou (Pix), liberar dias e faixa do coach, contas de teste, dias grátis e receita do mês.
export default function Acessos() {
  const [dados, setDados] = useState<{ contas: Conta[]; pedidos: Pedido[]; config: Config; receitaMes: number } | null>(null);
  const [faixa, setFaixa] = useState('15');
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState('');

  const carregar = async () => {
    try {
      const r = await chatApi<{ contas: Conta[]; pedidos: Pedido[]; config: Config; receitaMes: number }>({ acao: 'acesso_lista' });
      setDados(r);
    } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => { void carregar(); }, []);
  const fazer = async (corpo: Record<string, unknown>, ok: string) => {
    setMsg('');
    try { await chatApi(corpo); setMsg(ok); await carregar(); } catch (e) { setMsg((e as Error).message); }
  };
  // Coach: grava a faixa escolhida (quantos alunos ficam grátis). O valor entra na receita do mês.
  const liberar = (uid: string, d: number, ehCoach = false) => fazer({ acao: 'acesso_liberar', uid, dias: d, valor: Number(valor.replace(',', '.')) || 0, ...(ehCoach ? { faixa: Number(faixa) } : {}) }, `Liberado por mais ${d} dias.`);

  if (!dados) return <p className="text-sm text-foreground-500">{msg || 'Carregando...'}</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">Acessos (admin)</h1>
      <ResumoAcesso contas={dados.contas} receitaMes={dados.receitaMes} faixa={faixa} setFaixa={setFaixa} valor={valor} setValor={setValor} />
      {msg && <p role="status" className="rounded-lg bg-primary-50 p-2 text-sm text-primary-800">{msg}</p>}
      <PedidosAcesso pedidos={dados.pedidos} contas={dados.contas} liberar={(uid, d, c) => void liberar(uid, d, c)} />
      <ContasAcesso todas={dados.contas} liberar={(uid, d, c) => void liberar(uid, d, c)} fazer={(corpo, ok) => void fazer(corpo, ok)} />
      <RegrasAcesso key={JSON.stringify(dados.config)} config={dados.config} fazer={(corpo, ok) => void fazer(corpo, ok)} />
    </div>
  );
}
