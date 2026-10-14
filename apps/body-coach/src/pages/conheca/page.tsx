import { Link } from 'react-router-dom';
import Card, { CardHeader } from '@/components/base/Card';

// Seções separadas para manter o arquivo principal limpo
import { Hero } from './Secoes';
import { Beneficios } from './Secoes';
import { ComoFunciona } from './Secoes';
import { Depoimentos } from './Secoes';
import { CTA } from './Secoes';

// Página de vendas pública - acessível sem login (fora do AuthGuard)
export default function ConhecaPage() {
  return (
    <div className="min-h-screen bg-background-50">
      <Hero />
      <Beneficios />
      <ComoFunciona />
      <Depoimentos />
      <CTA />
      <footer className="border-t border-background-200 bg-background-100 py-6">
        <div className="mx-auto max-w-6xl px-4 text-center text-sm text-foreground-500">
          <p>NEXIA Body Coach AI — Acompanhamento inteligente de treino, alimentação e evolução.</p>
          <p className="mt-1"><a href="/termos" className="text-primary-600 hover:underline">Termos de uso</a> · <a href="/privacidade" className="text-primary-600 hover:underline">Política de privacidade</a></p>
        </div>
      </footer>
    </div>
  );
}
