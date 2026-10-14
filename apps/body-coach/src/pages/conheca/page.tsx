import { Link } from 'react-router-dom';
import Card from '@/components/base/Card';

// Seções separadas para manter o arquivo principal limpo
import { Hero } from './Secoes';
import { Beneficios } from './Secoes';
import { ComoFunciona } from './Secoes';
import { Depoimentos } from './Secoes';
import { CTAFinal } from './Secoes';

// Página de vendas pública — acessível sem login
// Mobile first, visual do app (Card, cores primary-*)
export default function ConhecaPage() {
  return (
    <>
      <Hero />
      <Beneficios />
      <ComoFunciona />
      <Depoimentos />
      <CTAFinal />
    </>
  );
}
