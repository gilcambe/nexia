import { useState } from 'react';
import Card from '@/components/base/Card';

export interface Config { diasGratis: number; diasGratisCoach: number; gratis: number; pix: string; pixNome?: string; isentos: string[] }

// Regras do admin: dias de teste (coach e quem treina sozinho), chave Pix do NEXIA e e-mails de teste que nunca bloqueiam.
export default function RegrasAcesso({ config, fazer, aviso }: { config: Config; fazer: (corpo: Record<string, unknown>, ok: string) => void; aviso?: string }) {
  const [diasCoach, setDiasCoach] = useState(String(config.diasGratisCoach));
  const [dias, setDias] = useState(String(config.diasGratis));
  const [gratis, setGratis] = useState(String(config.gratis));
  const [pix, setPix] = useState(config.pix);
  const [pixNome, setPixNome] = useState(config.pixNome || '');
  const [isentos, setIsentos] = useState(config.isentos.join('\n'));
  return (
      <Card>
        <h2 className="font-semibold text-foreground-900">Regras</h2>
        <label className="mt-2 block text-sm">Dias de teste para coach novo<input value={diasCoach} onChange={(e) => setDiasCoach(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2" /></label>
        <label className="mt-2 block text-sm">Dias de Premium grátis para quem treina sozinho ou aluno<input value={dias} onChange={(e) => setDias(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2" /></label>
        <label className="mt-2 block text-sm">Dias de acesso grátis para todos<input value={gratis} onChange={(e) => setGratis(e.target.value)} inputMode="numeric" className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2" /></label>
        <label className="mt-2 block text-sm">Chave Pix do NEXIA<input value={pix} onChange={(e) => setPix(e.target.value)} className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2" /></label>
        <label className="mt-2 block text-sm">Nome de quem recebe o Pix (aparece para quem vai pagar)<input value={pixNome} onChange={(e) => setPixNome(e.target.value)} className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2" /></label>
        <label className="mt-2 block text-sm">E-mails de teste que nunca bloqueiam (um por linha)<textarea value={isentos} onChange={(e) => setIsentos(e.target.value)} rows={4} className="mt-1 w-full rounded-lg border border-background-200 px-3 py-2" /></label>
        <button onClick={() => fazer({ acao: 'acesso_config', diasGratis: Number(dias), diasGratisCoach: Number(diasCoach), gratis: Number(gratis), pix, pixNome, isentos: isentos.split(/\s+/).filter(Boolean) }, 'Regras salvas.')} className="mt-3 w-full rounded-xl bg-primary-500 py-3 font-semibold text-background-50">Salvar regras</button>
        {aviso && <p role="status" className="mt-2 rounded-lg bg-primary-50 p-2 text-center text-sm font-semibold text-primary-800">{aviso}</p>}
      </Card>
  );
}
