import { useEffect, useState } from 'react';
import PainelAcesso from '@/components/feature/PainelAcesso';
import { verAcesso, type Acesso } from '@/lib/acesso';

// Minha assinatura: até quando está liberado e como pagar.
export default function MeuAcesso() {
  const [acesso, setAcesso] = useState<Acesso | null>(null);
  const [erro, setErro] = useState('');
  const ver = () => { setErro(''); void verAcesso().then(setAcesso).catch((e) => setErro((e as Error).message)); };
  useEffect(ver, []);
  if (erro) return <p role="alert" className="text-center text-sm text-red-600">{erro}</p>;
  if (!acesso) return <p className="text-center text-sm text-foreground-500">Carregando...</p>;
  return <PainelAcesso acesso={acesso} onVerDeNovo={ver} />;
}
