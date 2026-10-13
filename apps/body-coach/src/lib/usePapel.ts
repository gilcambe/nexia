import { useEffect, useState } from 'react';
import { papelEContatos, papelGuardado } from './papelCoach';
import { verComo } from './verComo';

export type Papel = 'coach' | 'aluno' | 'nenhum';

// Papel de quem está usando: coach vê só as telas de coach; aluno (ou quem não tem coach) vê só as de aluno.
// null = ainda descobrindo (primeira vez neste aparelho). ativo=false só lê o que já foi descoberto, sem chamar o servidor.
export function usePapel(ativo = true): Papel | null {
  const [papel, setPapel] = useState<Papel | null>(() => papelGuardado());
  const [comoAdmin, setComoAdmin] = useState(verComo);
  useEffect(() => {
    const mudou = () => setComoAdmin(verComo());
    window.addEventListener('bc-ver-como', mudou);
    return () => window.removeEventListener('bc-ver-como', mudou);
  }, []);
  useEffect(() => {
    const salvo = (e: Event) => setPapel((e as CustomEvent<Papel>).detail);
    window.addEventListener('bc-papel-salvo', salvo);
    return () => window.removeEventListener('bc-papel-salvo', salvo);
  }, []);
  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    const ler = () => { void papelEContatos().then((r) => { if (vivo) setPapel(r.papel); }); };
    ler();
    window.addEventListener('bc-papel', ler);
    return () => { vivo = false; window.removeEventListener('bc-papel', ler); };
  }, [ativo]);
  return comoAdmin ?? papel;
}
