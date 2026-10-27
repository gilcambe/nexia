import { useEffect, useRef, useState } from 'react';
import Card from '@/components/base/Card';
import { useAuth } from '@/components/feature/AuthContext';
import PainelAcesso from '@/components/feature/PainelAcesso';
import { verAcesso, type Acesso } from '@/lib/acesso';
import { compartilharCanvas, linkIndicacao } from '@/lib/ferramentas/cartao';
import { confirmar } from '@/lib/dialogo';
import {
  DESAFIOS, desenharCertificado, diaAtual, hojeISO, lerProgresso, marcarHoje, salvarProgresso, sequencia, situacaoDia, temCertificado,
  type ProgressoDesafio,
} from '@/lib/ferramentas/desafio30';

const COR: Record<string, string> = {
  feito: 'bg-primary-500 text-background-50 dark:text-foreground-950',
  perdido: 'bg-background-200 text-foreground-400 line-through',
  hoje: 'border-2 border-primary-500 bg-primary-50 text-primary-800 font-bold',
  futuro: 'border border-background-200 bg-background-50 text-foreground-400',
};

// Desafio 30 dias (Premium): o dia 1 é livre para todos; do dia 2 em diante, só com Premium.
export default function Desafio30() {
  const { user, profile } = useAuth();
  const uid = user?.id ?? 'anon';
  const [p, setP] = useState<ProgressoDesafio | null>(() => lerProgresso(uid));
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [msg, setMsg] = useState('');
  const tela = useRef<HTMLCanvasElement>(null);

  useEffect(() => { setP(lerProgresso(uid)); }, [uid]);
  const verDeNovo = () => { void verAcesso().then(setAcesso).catch(() => { /* sem internet: deixa usar */ }); };
  useEffect(verDeNovo, [user?.id]);

  const mudar = (novo: ProgressoDesafio | null) => { setP(novo); salvarProgresso(uid, novo); };
  const desafio = p ? DESAFIOS.find((d) => d.id === p.id) : null;
  const hoje = hojeISO();
  const dia = p ? diaAtual(p.inicio, hoje) : 0;
  const certificado = !!p && temCertificado(p, hoje);
  const nome = profile?.full_name || user?.user_metadata.full_name || '';
  const link = user ? linkIndicacao(user.id) : 'https://bodycoach.kernex.com.br';

  useEffect(() => {
    if (!certificado || !tela.current || !p || !desafio) return;
    void desenharCertificado(tela.current, { nome, desafio: desafio.nome, feitos: p.feitos.length, data: new Date(), link, logo: `${import.meta.env.BASE_URL}icon-512.png` });
  }, [certificado, p, desafio, nome, link]);

  if (!p || !desafio) {
    return (
      <div className="space-y-3" data-testid="desafio30">
        <p className="text-sm text-foreground-600">Escolha um desafio. É uma tarefa curta por dia, durante 30 dias. Complete 25 ou mais e ganhe um certificado para postar.</p>
        {DESAFIOS.map((d) => (
          <button key={d.id} type="button" onClick={() => mudar({ id: d.id, inicio: hoje, feitos: [] })} className="flex w-full items-center gap-3 rounded-2xl border border-background-200 bg-background-50 p-4 text-left">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary-100 text-2xl text-primary-700"><i className={d.icone}></i></span>
            <span className="min-w-0 flex-1"><b className="block text-foreground-950">{d.nome}</b><span className="text-sm text-foreground-500">{d.desc}</span></span>
            <i className="ri-arrow-right-s-line text-xl text-foreground-400"></i>
          </button>
        ))}
      </div>
    );
  }

  const travado = acesso?.situacao === 'bloqueado' && dia >= 2;
  const feitoHoje = p.feitos.includes(dia);
  const acabou = dia > 30;

  const compartilhar = async () => {
    if (!tela.current) return;
    const r = await compartilharCanvas(tela.current, `Completei o Desafio 30 dias "${desafio.nome}" no Body Coach 💪`, link);
    setMsg(r === 'baixado' ? 'Certificado salvo no aparelho. Abra o Instagram e escolha da galeria.' : '');
  };

  return (
    <div className="space-y-4" data-testid="desafio30">
      <Card padding="p-4">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary-100 text-2xl text-primary-700"><i className={desafio.icone}></i></span>
          <div className="flex-1">
            <p className="text-xs uppercase tracking-wide text-foreground-400">Desafio {desafio.nome}</p>
            <p className="text-lg font-bold text-foreground-950">{acabou ? 'Desafio encerrado' : `Dia ${dia} de 30`}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-extrabold text-primary-600"><i className="ri-fire-fill"></i>{sequencia(p, hoje)}</p>
            <p className="text-[11px] text-foreground-500">dias seguidos</p>
          </div>
        </div>
        {!acabou && !travado && (
          <div className="mt-3 rounded-xl bg-background-100 p-3">
            <p className="text-xs text-foreground-500">Tarefa de hoje</p>
            <p className="text-base font-semibold text-foreground-950">{desafio.tarefas[dia - 1]}</p>
            <button type="button" disabled={feitoHoje} onClick={() => mudar(marcarHoje(p, hoje))} className="mt-3 w-full rounded-xl bg-primary-500 py-3 text-base font-bold text-background-50 disabled:opacity-60 dark:text-foreground-950" data-testid="feito-hoje">
              {feitoHoje ? <><i className="ri-check-line mr-1"></i>Feito hoje!</> : 'Feito hoje'}
            </button>
          </div>
        )}
      </Card>

      {travado && acesso && (
        <div data-testid="desafio30-premium">
          <p className="mb-2 text-sm font-semibold text-foreground-800"><i className="ri-vip-crown-line mr-1 text-primary-500"></i>Do dia 2 em diante o desafio é do Premium.</p>
          <PainelAcesso acesso={acesso} onVerDeNovo={verDeNovo} />
        </div>
      )}

      <section>
        <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-foreground-400">Seus 30 dias · {p.feitos.length} feitos</h2>
        <div className="grid grid-cols-6 gap-1.5">
          {Array.from({ length: 30 }, (_, i) => i + 1).map((d) => {
            const s = situacaoDia(d, p, hoje);
            return <div key={d} title={desafio.tarefas[d - 1]} aria-label={`Dia ${d}: ${s}`} className={`flex aspect-square items-center justify-center rounded-lg text-xs ${COR[s]}`}>{s === 'feito' ? <i className="ri-check-line"></i> : d}</div>;
          })}
        </div>
      </section>

      {certificado && (
        <section className="space-y-2">
          <h2 className="text-lg font-bold text-foreground-950"><i className="ri-award-line mr-1 text-primary-500"></i>Seu certificado</h2>
          <canvas ref={tela} className="mx-auto block w-64 rounded-xl shadow-lg" aria-label="Certificado do desafio" />
          <button type="button" onClick={() => void compartilhar()} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-pink-500 via-orange-500 to-amber-400 py-4 text-base font-bold text-white"><i className="ri-share-line text-xl"></i>Compartilhar</button>
          <p className="text-center text-xs text-foreground-500">{link.replace(/^https?:\/\//, '').split('/')[0]}</p>
        </section>
      )}

      {msg && <p role="status" className="rounded-xl bg-secondary-50 px-3 py-2 text-sm text-secondary-900">{msg}</p>}

      <button type="button" onClick={async () => { if (await confirmar('Trocar de desafio? O progresso deste será apagado.')) mudar(null); }} className="w-full rounded-2xl border-2 border-background-200 py-3 text-sm font-semibold text-foreground-600">Trocar de desafio</button>
    </div>
  );
}
