import LegalLayout from "../components/LegalLayout";
export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso" subtitle="Condições e responsabilidades para utilização da plataforma NEXIA OS" lastUpdated="04 de Maio de 2026">
      <div className="space-y-8 text-sm text-nexia-muted leading-relaxed">
        <section><h2 className="text-lg font-semibold text-white mb-3">1. Aceitação dos Termos</h2><p>Ao acessar a NEXIA OS, você concorda em cumprir estes Termos de Uso. Estes termos constituem um contrato legal entre você e Gilson Cambe.</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">2. Descrição do Serviço</h2><p>A NEXIA OS é uma plataforma SaaS de orquestração de inteligência artificial que permite interagir com múltiplos modelos de IA, criar agentes especializados e automatizar fluxos de negócio.</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">3. Planos e Pagamentos</h2><ul className="list-disc list-inside space-y-1 ml-4"><li><strong className="text-white">Free:</strong> 50 chamadas/mês, 1 agente</li><li><strong className="text-white">Starter:</strong> 500 chamadas/mês, 3 agentes</li><li><strong className="text-white">Pro:</strong> 2.000 chamadas/mês, 10 agentes</li><li><strong className="text-white">Enterprise:</strong> Ilimitado, white-label, SLA 99.9%</li></ul></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">4. Uso Proibido</h2><ul className="list-disc list-inside space-y-1 ml-4"><li>Atividades ilegais ou fraudulentas</li><li>Distribuição de malware ou spam</li><li>Engenharia reversa da plataforma</li><li>Conteúdo que promova discurso de ódio ou violência</li></ul></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">5. Lei Aplicável</h2><p>Estes termos são regidos pelas leis da República Federativa do Brasil. Qualquer disputa será submetida ao foro da cidade de São Paulo, SP.</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">6. Contato</h2><p>E-mail: contato@nexiaos.com.br · WhatsApp: +55 11 94403-7259</p></section>
      </div>
    </LegalLayout>
  );
}
