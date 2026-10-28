import { useEffect, useState } from 'react';
import Card from '@/components/base/Card';
import { chatApi } from '@/lib/chat';
import ContasAcesso from './ContasAcesso';
import type { Conta } from './contas';
import ResumoAcesso from './ResumoAcesso';
import PedidosAcesso, { type Pedido } from './PedidosAcesso';
import RegrasAcesso, { type Config } from './RegrasAcesso';
import VerComo from './VerComo';
import TestadoresAcesso from './TestadoresAcesso';

// Só o admin do NEXIA: quem pagou (Pix), liberar dias e faixa do coach, contas de teste, dias grátis e receita do mês.
export default function Acessos() {
  const [dados, setDados] = useState<{ contas: Conta[]; pedidos: Pedido[]; config: Config; receitaMes: number } | null>(null);
  const [faixa, setFaixa] = useState('15');
  const [valor, setValor] = useState('');
  const [msg, setMsg] = useState('');
  const [avisoRegras, setAvisoRegras] = useState('');

  const carregar = async () => {
    try {
      const r = await chatApi<{ contas: Conta[]; pedidos: Pedido[]; config: Config; receitaMes: number }>({ acao: 'acesso_lista' });
      setDados(r);
    } catch (e) { setMsg((e as Error).message); }
  };
  useEffect(() => { void carregar(); }, []);
  const fazer = async (corpo: Record<string, unknown>, ok: string) => {
    setMsg('');
    try { await chatApi(corpo); setMsg(ok); await carregar(); return true; } catch (e) { setMsg((e as Error).message); return false; }
  };
  // O botão Salvar regras fica no fim da página: a confirmação aparece logo abaixo dele.
  const salvarRegras = async (corpo: Record<string, unknown>, ok: string) => {
    setAvisoRegras('Salvando...');
    setAvisoRegras((await fazer(corpo, ok)) ? 'Salvo! ✓' : 'Não salvou. Tente de novo.');
    setTimeout(() => setAvisoRegras(''), 5000);
  };
  // Coach: grava a faixa escolhida (quantos alunos ficam grátis). O valor entra na receita do mês.
  // valorPedido: o valor do plano que a pessoa pediu (anual/mensal); sem ele vale o valor digitado no resumo.
  const liberar = (uid: string, d: number, ehCoach = false, valorPedido?: number) => fazer({ acao: 'acesso_liberar', uid, dias: d, valor: valorPedido || Number(valor.replace(',', '.')) || 0, ...(ehCoach ? { faixa: Number(faixa) } : {}) }, `Liberado por mais ${d} dias.`);

  if (!dados) return <p className="text-sm text-foreground-500">{msg || 'Carregando...'}</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <h1 className="font-heading text-2xl font-bold text-foreground-950">Acessos (admin)</h1>
      <VerComo />
      <ResumoAcesso contas={dados.contas} receitaMes={dados.receitaMes} faixa={faixa} setFaixa={setFaixa} valor={valor} setValor={setValor} />
      {msg && <p role="status" className="rounded-lg bg-primary-50 p-2 text-sm text-primary-800">{msg}</p>}
      <TestadoresAcesso />
      <PedidosAcesso pedidos={dados.pedidos} contas={dados.contas} liberar={(uid, d, c, v) => void liberar(uid, d, c, v)} />
      <ContasAcesso todas={dados.contas} liberar={(uid, d, c) => void liberar(uid, d, c)} fazer={(corpo, ok) => void fazer(corpo, ok)} />
      <RegrasAcesso key={JSON.stringify(dados.config)} config={dados.config} fazer={(corpo, ok) => void salvarRegras(corpo, ok)} aviso={avisoRegras} />
    </div>
  );
}
