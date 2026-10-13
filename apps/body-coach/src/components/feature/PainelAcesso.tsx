import { useState } from 'react';
import { dataCurta, type Acesso } from '@/lib/acesso';
import PagarPix from './PagarPix';

// Situação da conta e como pagar (Pix direto para o NEXIA, sem taxa de cartão). Usado no aviso de Premium e em /acesso.
export default function PainelAcesso({ acesso, onVerDeNovo, onFechar }: { acesso: Acesso; onVerDeNovo: () => void; onFechar?: () => void }) {
  const [msg, setMsg] = useState('');
  const semPremium = acesso.situacao === 'bloqueado';
  const coach = acesso.tipo === 'coach';
  const titulo = semPremium ? 'Recurso do Premium'
    : acesso.situacao === 'isento' ? 'Acesso liberado'
    : acesso.situacao === 'equipe' ? 'Liberado pelo seu coach'
    : acesso.situacao === 'pago' ? `Pago até ${dataCurta(acesso.pagoAte)}`
    : acesso.situacao === 'basico' ? 'Plano Grátis de coach (até 3 alunos)'
    : acesso.motivo === 'coach' ? 'O plano do seu coach venceu'
    : `Teste grátis até ${dataCurta(acesso.gratisAte)}`;
  const precisaPagar = acesso.situacao !== 'isento' && acesso.situacao !== 'equipe';
  return (
    <div className="mx-auto max-w-md space-y-4 rounded-2xl border border-background-200 bg-background-50 p-5 text-center" data-testid="painel-acesso">
      <i className={`${semPremium ? 'ri-lock-2-line text-amber-500' : 'ri-vip-crown-line text-primary-500'} text-5xl`}></i>
      <h1 className="font-heading text-2xl font-bold text-foreground-950">{titulo}</h1>
      {semPremium && <p className="text-base text-foreground-700">{acesso.tipo === 'aluno' ? 'O seu coach não cobre mais o seu acesso. ' : ''}Assine o Premium para usar esta parte. Treino, ficha simples, água e refeições continuam grátis.</p>}
      {acesso.motivo === 'coach' && <p className="text-base text-foreground-700">Você ainda usa tudo por <b>{acesso.dias} dia(s)</b>. Avise o seu coach ou assine o Premium.</p>}
      {acesso.dias !== null && acesso.dias > 0 && !acesso.motivo && !semPremium && <p className="text-base text-foreground-700">Faltam <b>{acesso.dias} dia(s)</b>.</p>}
      {precisaPagar && <PagarPix acesso={acesso} avisar={setMsg} />}
      <button onClick={onVerDeNovo} className="w-full rounded-xl border border-background-200 py-3 text-base font-medium text-foreground-700"><i className="ri-refresh-line mr-1"></i>Verificar de novo</button>
      {onFechar && <button onClick={onFechar} className="w-full py-2 text-sm text-foreground-500 underline">Voltar</button>}
      {msg && <p role="status" className="text-sm text-primary-700">{msg}</p>}
    </div>
  );
}
