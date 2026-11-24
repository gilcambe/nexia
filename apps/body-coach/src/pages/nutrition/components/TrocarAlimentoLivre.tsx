import { useMemo, useState } from 'react';
import Card from '@/components/base/Card';
import { equivalentes, identificar } from '@/lib/trocas';

// Trocas para se manter na dieta: "não tenho arroz" → o que comer no lugar, na quantidade certa.
// Funciona com ou sem plano do nutricionista; usa a tabela de alimentos do app.
export default function TrocarAlimentoLivre() {
  const [nome, setNome] = useState('');
  const [qtd, setQtd] = useState('');
  const base = useMemo(() => (nome.trim().length >= 3 ? identificar(nome) : null), [nome]);
  const quantidade = Number(qtd.replace(',', '.')) || (base ? base.qtd : 0);
  const opcoes = useMemo(() => (base ? equivalentes(base.id, quantidade, { limite: 8 }) : []), [base, quantidade]);
  const un = base?.un === 'un' ? 'unidade(s)' : base?.un ?? 'g';
  return (
    <Card padding="p-3">
      <h2 className="font-heading text-sm font-semibold text-foreground-950"><i className="ri-arrow-left-right-line mr-1 text-primary-500"></i>Trocar alimento</h2>
      <p className="mt-0.5 text-xs text-foreground-500">Acabou ou não gosta? Diga o alimento e a quantidade: o app mostra o que comer no lugar sem sair da dieta.</p>
      <div className="mt-2 grid grid-cols-3 gap-2">
        <input value={nome} onChange={(e) => setNome(e.target.value)} placeholder="Ex.: arroz, frango, pão" aria-label="Alimento" className="col-span-2 rounded-xl border-2 border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-400" data-testid="troca-nome" />
        <input value={qtd} onChange={(e) => setQtd(e.target.value)} inputMode="decimal" placeholder={base ? `${base.qtd} ${base.un === 'un' ? 'un' : base.un}` : 'g'} aria-label="Quantidade" className="rounded-xl border-2 border-background-200 bg-background-50 px-3 py-2 text-sm outline-none focus:border-primary-400" />
      </div>
      {nome.trim().length >= 3 && !base && <p className="mt-2 text-sm text-foreground-600">Não achei esse alimento na tabela. Tente outro nome (ex.: "batata doce", "peito de frango").</p>}
      {base && (
        <div className="mt-2" data-testid="trocas-livres">
          <p className="text-xs text-foreground-500">{quantidade} {un} de {base.nome} ≈ {Math.round(base.kcal * quantidade / base.qtd)} kcal. Pode trocar por:</p>
          {!opcoes.length && <p className="mt-1 text-sm text-foreground-600">Sem troca parecida na tabela para essa quantidade.</p>}
          <ul className="mt-1 divide-y divide-background-200">
            {opcoes.map((o) => (
              <li key={o.id ?? o.nome} className="flex items-center justify-between gap-2 py-1.5 text-sm">
                <span className="text-foreground-900">{o.nome} <span className="text-foreground-500">· {o.porcao}</span></span>
                <span className="shrink-0 text-xs text-foreground-500">{Math.round(o.kcal)} kcal · P {Math.round(o.p)} · C {Math.round(o.c)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  );
}
