import LegalLayout from "../components/LegalLayout";
export default function PrivacidadePage() {
  return (
    <LegalLayout title="Política de Privacidade" subtitle="Como a NEXIA OS coleta, processa e protege seus dados pessoais" lastUpdated="04 de Maio de 2026">
      <div className="space-y-8 text-sm text-nexia-muted leading-relaxed">
        <section><h2 className="text-lg font-semibold text-white mb-3">1. Introdução</h2><p>A NEXIA OS, operada por Gilson Cambe, respeita sua privacidade e está comprometida em proteger seus dados pessoais em conformidade com a LGPD (Lei nº 13.709/2018).</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">2. Dados que Coletamos</h2><ul className="list-disc list-inside space-y-1 ml-4"><li>Dados de cadastro: nome, e-mail, telefone</li><li>Dados de uso: logs de interação com CORTEX e agentes</li><li>Dados técnicos: IP, navegador, sistema operacional</li><li>Conteúdo: mensagens enviadas ao CORTEX, documentos para RAG</li></ul></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">3. Finalidade do Tratamento</h2><ul className="list-disc list-inside space-y-1 ml-4"><li>Fornecer e melhorar os serviços de orquestração de IA</li><li>Processar pagamentos e gerenciar assinaturas</li><li>Cumprir obrigações legais e regulatórias (LGPD)</li><li>Prevenir fraudes e garantir segurança da plataforma</li></ul></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">4. Seus Direitos (LGPD)</h2><ul className="list-disc list-inside space-y-1 ml-4"><li>Acessar seus dados pessoais</li><li>Corrigir dados incompletos ou desatualizados</li><li>Solicitar anonimização, bloqueio ou eliminação</li><li>Revogar consentimento a qualquer momento</li><li>Portabilidade dos dados</li></ul></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">5. Segurança</h2><p>Criptografia AES-256 em trânsito (TLS 1.3) e em repouso, autenticação JWT, rate limiting e auditoria contínua via Sentinel QA.</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">6. Contato</h2><p>E-mail: contato@nexiaos.com.br · WhatsApp: +55 11 94403-7259 · Responsável: Gilson Cambe</p></section>
      </div>
    </LegalLayout>
  );
}
