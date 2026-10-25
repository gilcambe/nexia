import LegalLayout from "../components/LegalLayout";
export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade e LGPD do Cortex / KERNEX" subtitle="Como a plataforma coleta, trata e protege seus dados pessoais" lastUpdated="10 de Maio de 2026">
      <div className="space-y-8 text-sm text-nexia-muted leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">1. Introdução</h2>
          <p>A KERNEX respeita sua privacidade e cumpre integralmente a Lei Geral de Proteção de Dados (LGPD - Lei nº 13.709/2018). Esta política explica de forma clara e simples como os dados são coletados e utilizados pelos serviços do Cortex.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">2. O que é Coletado</h2>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li><strong className="text-white">Dados de Cadastro:</strong> Nome, e-mail e data/hora do aceite dos termos.</li>
            <li><strong className="text-white">Dados de Uso do Cortex:</strong> Prompts, mensagens, códigos e históricos de conversas submetidos ao sistema.</li>
            <li><strong className="text-white">Informações Técnicas:</strong> Endereço IP, tipo de navegador e logs de acesso para auditoria e segurança.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">3. Para quê Coletamos</h2>
          <ul className="list-disc list-inside space-y-1 ml-4">
            <li>Fornecer as funcionalidades de orquestração de IA e assistente de programação do Cortex.</li>
            <li>Autenticação de usuários e isolamento de permissões/dados por cliente.</li>
            <li>Cumprimento de obrigações legais, prevenção a fraudes e garantia da segurança da plataforma.</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Compartilhamento com IAs de Terceiros</h2>
          <p>Para gerar respostas e automações, o texto das requisições pode ser processado por APIs parceiras de Inteligência Artificial de terceiros (como OpenAI, Anthropic, Google, Cloudflare). Os dados são encaminhados exclusivamente com o propósito de executar a requisição solicitada pelo próprio usuário.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">5. Uso Aceitável e Proibições</h2>
          <p>É estritamente proibida a utilização do Cortex para envio ou geração de conteúdo ilegal, propagação de spam, realização de golpes ou qualquer atividade maliciosa. Violações resultarão em bloqueio imediato da conta.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">6. Seus Direitos (LGPD) e Como Apagar a Conta</h2>
          <p className="mb-2">Você possui total controle sobre seus dados pessoais de acordo com a LGPD. Você pode a qualquer momento:</p>
          <ul className="list-disc list-inside space-y-1 ml-4 mb-2">
            <li>Solicitar confirmação e acesso aos dados armazenados;</li>
            <li>Solicitar a correção ou atualização de dados incompletos;</li>
            <li>Solicitar a revogação de consentimento e a <strong className="text-white">exclusão definitiva de sua conta e dados</strong>.</li>
          </ul>
          <p>Para apagar sua conta e todos os dados associados, basta enviar uma mensagem solicitando a exclusão para nosso e-mail oficial de contato.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">7. Contato do Encarregado de Dados</h2>
          <p>Para exercer seus direitos de privacidade, dúvidas ou pedidos de exclusão, entre em contato através do e-mail: <strong className="text-white">contato.nexia.os@gmail.com</strong>.</p>
        </section>
      </div>
    </LegalLayout>
  );
}
