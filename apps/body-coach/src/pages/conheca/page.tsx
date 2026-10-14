import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';
import { SecaoHero, SecaoBeneficios, SecaoDepoimentos, SecaoPlanos, SecaoCTA } from './Secoes';

export default function ConhecaPage() {
  return (
    <div className="min-h-screen bg-background-50">
      <SecaoHero />
      <SecaoBeneficios />
      <SecaoDepoimentos />
      <SecaoPlanos />
      <SecaoCTA />
      <footer className="border-t border-background-200 bg-background-50">
        <div className="mx-auto max-w-6xl px-4 py-6 text-center text-sm text-foreground-500">
          <p>Body Coach AI — Acompanhamento inteligente de treino, alimentação e evolução.</p>
          <p className="mt-1">Fase de testes gratuita. <Link to="/termos" className="text-primary-600 hover:underline">Termos de uso</Link> · <Link to="/privacidade" className="text-primary-600 hover:underline">Privacidade</Link></p>
        </div>
      </footer>
    </div>
  );
}
