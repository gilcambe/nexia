import LegalLayout from "../components/LegalLayout";
export default function TermosPage() {
  return (
    <LegalLayout title="Termos de Uso do Cortex / KERNEX" subtitle="Condições e responsabilidades para utilização da plataforma e dos serviços Cortex" lastUpdated="10 de Maio de 2026">
      <div className="space-y-8 text-sm text-nexia-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Aceitação dos Termos</h2>
          <p>Ao se cadastrar ou utilizar o Cortex na plataforma KERNEX, você concorda expressamente com estes Termos de Uso. O cadastro exige a confirmação obrigatória de leitura e aceite desta política.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. Descrição do Serviço</h2>
          <p>O Cortex é um assistente e orquestrador de Inteligência Artificial para geração de código, automações e análise de projetos. O serviço permite a interação com diversos provedores e modelos de linguagem.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. Uso Aceitável e Regras de Conduta</h2>
          <p className="mb-2">O usuário se compromete a fazer uso estritamente legal e ético do sistema. É expressamente proibido:</p>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Criação ou veiculação de conteúdo ilegal, nocivo, abusivo ou discriminatório</li>
            <li>Prática de spam, golpes, fraudes eletrônicas ou engenharia social</li>
            <li>Ataques cibernéticos, distribuição de malwares ou tentativa de burlar a segurança do sistema</li>
            <li>Engenharia reversa ou exploração indevida da infraestrutura</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Processamento via IAs de Terceiros</h2>
          <p>Para executar suas requisições e processar prompts, o Cortex integra-se a serviços de IA parceiros e provedores de nuvem de terceiros (como OpenAI, Anthropic, Google, Cloudflare). Os dados e prompts enviados são processados estritamente para a prestação do serviço solicitado.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Direito de Arrependimento e Reembolso</h2>
          <p>Conforme o Código de Defesa do Consumidor (CDC), em caso de contratação de planos pagos ou créditos do Cortex, você pode solicitar o cancelamento e reembolso integral em até 7 (sete) dias corridos após a compra, mediante solicitação ao nosso suporte.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Exclusão da Conta e Encerrante</h2>
          <p>Você pode solicitar o encerramento da sua conta e a remoção dos seus dados a qualquer momento enviando um pedido formal ao nosso e-mail de contato.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Contato e Suporte</h2>
          <p>Para dúvidas, reembolsos, suporte ou solicitações sobre estes termos, entre em contato via e-mail: <strong className="text-white">contato.nexia.os@gmail.com</strong>.</p>
        </section>
      </div>
    </LegalLayout>
  );
}
