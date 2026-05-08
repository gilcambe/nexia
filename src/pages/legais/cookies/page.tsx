import LegalLayout from "../components/LegalLayout";
export default function CookiesPage() {
  return (
    <LegalLayout title="Política de Cookies" subtitle="Como utilizamos cookies e tecnologias similares na NEXIA OS" lastUpdated="04 de Maio de 2026">
      <div className="space-y-8 text-sm text-nexia-muted leading-relaxed">
        <section><h2 className="text-lg font-semibold text-white mb-3">1. O que são Cookies</h2><p>Cookies são pequenos arquivos de texto armazenados em seu dispositivo quando você visita um site.</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">2. Tipos de Cookies</h2>
          <div className="space-y-3">
            <div className="p-4 rounded-xl bg-nexia-surface border border-nexia-border"><h3 className="text-sm font-semibold text-white mb-1">Essenciais</h3><p>Necessários para funcionamento básico: autenticação JWT e preferências de idioma.</p></div>
            <div className="p-4 rounded-xl bg-nexia-surface border border-nexia-border"><h3 className="text-sm font-semibold text-white mb-1">Performance</h3><p>Coletam informações sobre tempo de carregamento e funcionalidades mais usadas.</p></div>
            <div className="p-4 rounded-xl bg-nexia-surface border border-nexia-border"><h3 className="text-sm font-semibold text-white mb-1">Funcionalidade</h3><p>Lembram preferências de tema, último modelo de IA selecionado e configurações.</p></div>
          </div>
        </section>
        <section><h2 className="text-lg font-semibold text-white mb-3">3. Gerenciamento</h2><p>Você pode gerenciar suas preferências nas configurações do seu navegador. Desativar cookies essenciais pode comprometer o funcionamento da plataforma.</p></section>
        <section><h2 className="text-lg font-semibold text-white mb-3">4. Contato</h2><p>E-mail: contato@nexiaos.com.br · WhatsApp: +55 11 94403-7259</p></section>
      </div>
    </LegalLayout>
  );
}
