import LegalLayout from "../components/LegalLayout";
export default function LGPDPage() {
  return (
    <LegalLayout title="LGPD — Lei Geral de Proteção de Dados" subtitle="Compromisso da NEXIA OS com a proteção de dados pessoais no Brasil" lastUpdated="04 de Maio de 2026">
      <div className="space-y-8 text-sm text-nexia-muted leading-relaxed">
        <section><h2 className="text-lg font-semibold text-white mb-3">1. Compromisso com a LGPD</h2><p>A NEXIA OS está plenamente comprometida com a Lei Geral de Proteção de Dados (Lei nº 13.709/2018).</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">2. Controlador e DPO</h2><ul className="list-disc list-inside space-y-1 ml-4"><li><strong className="text-white">Nome:</strong> Gilson Cambe</li><li><strong className="text-white">E-mail:</strong> contato@nexiaos.com.br</li><li><strong className="text-white">WhatsApp:</strong> +55 11 94403-7259</li></ul></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">3. Bases Legais para Tratamento</h2><ul className="list-disc list-inside space-y-1 ml-4"><li>Execução de contrato: fornecimento dos serviços contratados</li><li>Consentimento: envio de comunicações marketing</li><li>Legítimo interesse: prevenção de fraudes e segurança</li><li>Cumprimento de obrigação legal</li></ul></section>
        <section>
          <h2 className="text-lg font-semibold text-white mb-3">4. Direitos do Titular</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {["Confirmação de existência","Acesso aos dados","Correção","Anonimização","Portabilidade","Eliminação","Informação sobre compartilhamento","Revogação de consentimento"].map(r => (
              <div key={r} className="p-3 rounded-lg bg-nexia-surface border border-nexia-border"><p className="text-sm text-white">{r}</p></div>
            ))}
          </div>
        </section>
        <section><h2 className="text-lg font-semibold text-white mb-3">5. Medidas de Segurança</h2><ul className="list-disc list-inside space-y-1 ml-4"><li>Criptografia AES-256 em trânsito (TLS 1.3) e em repouso</li><li>Autenticação multifator disponível em todos os planos</li><li>Rate limiting e WAF para prevenir ataques</li><li>Isolamento multi-tenant por cliente</li><li>Backups criptografados com retenção de 90 dias</li></ul></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">6. Como Exercer seus Direitos</h2><p>Envie para contato@nexiaos.com.br com assunto "LGPD — [Seu Nome]". Resposta em até 15 dias úteis.</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">7. Reclamação à ANPD</h2><p>Site: <a href="https://www.gov.br/anpd" target="_blank" rel="noopener noreferrer" className="text-nexia-cyan hover:underline">www.gov.br/anpd</a></p></section>
      </div>
    </LegalLayout>
  );
}
