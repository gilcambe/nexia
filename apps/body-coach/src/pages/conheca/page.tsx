import { Link } from 'react-router-dom';
import Card, { CardHeader } from '@/components/base/Card';
import { Hero, Beneficios, ComoFunciona, Depoimentos, CTA } from './Secoes';

export default function Conheca() {
  return (
    <div className="min-h-screen bg-background-50">
      <header className="border-b border-background-200 bg-background-50/80 backdrop-blur-sm sticky top-0 z-40">
        <nav className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8" aria-label="Navegação principal">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-2">
              <i className="ri-dumbbell-fill text-2xl text-primary-500"></i>
              <span className="font-heading text-xl font-bold text-foreground-950">NEXIA Body Coach</span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <Link to="/auth" className="text-sm font-medium text-foreground-700 hover:text-primary-600 transition-colors">
                Entrar
              </Link>
              <Link to="/auth" className="rounded-xl bg-primary-500 px-5 py-2 text-sm font-semibold text-white hover:bg-primary-600 transition-colors">
                Começar grátis
              </Link>
            </div>
            <div className="md:hidden">
              <Link to="/auth" className="rounded-xl bg-primary-500 px-4 py-2 text-sm font-semibold text-white">
                Começar grátis
              </Link>
            </div>
          </div>
        </nav>
      </header>
      <main>
        <Hero />
        <Beneficios />
        <ComoFunciona />
        <Depoimentos />
        <CTA />
      </main>
      <footer className="border-t border-background-200 bg-background-50">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
          <div className="grid gap-6 md:grid-cols-3">
            <div>
              <p className="font-heading font-semibold text-foreground-950">NEXIA Body Coach</p>
              <p className="mt-2 text-sm text-foreground-600">Seu treino, sua alimentação e sua evolução em um só lugar. Com IA que entende você.</p>
            </div>
            <nav aria-label="Links úteis">
              <h3 className="font-semibold text-foreground-950">Links</h3>
              <ul className="mt-3 space-y-2 text-sm">
                <li><Link to="/termos" className="text-foreground-600 hover:text-primary-600">Termos de uso</Link></li>
                <li><Link to="/privacidade" className="text-foreground-600 hover:text-primary-600">Política de privacidade</Link></li>
                <li><Link to="/auth" className="text-foreground-600 hover:text-primary-600">Entrar no app</Link></li>
              </ul>
            </nav>
            <address className="not-italic text-sm text-foreground-600">
              <p>Contato: <a href="mailto:contato@nexia.app" className="text-primary-600 hover:underline">contato@nexia.app</a></p>
              <p className="mt-1">WhatsApp: <a href="https://wa.me/5511999999999" className="text-primary-600 hover:underline" target="_blank" rel="noopener">(11) 99999-9999</a></p>
            </address>
          </div>
          <p className="mt-6 text-center text-xs text-foreground-500">© 2024 NEXIA Body Coach. Todos os direitos reservados.</p>
        </div>
      </footer>
    </div>
  );
}
