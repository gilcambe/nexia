import React from 'react';
import { Shield, Lock, FileText, UserCheck, Database, Mail, HelpCircle, ArrowLeft } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <Link
            to="/"
            className="inline-flex items-center text-sm font-medium text-emerald-400 hover:text-emerald-300 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Voltar para o Início
          </Link>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl shadow-xl p-8 sm:p-12">
          <div className="flex items-center space-x-4 mb-6 pb-6 border-b border-slate-800">
            <div className="p-3 bg-emerald-500/10 rounded-xl border border-emerald-500/20">
              <Shield className="w-8 h-8 text-emerald-400" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight text-white">Termos de Uso e Política de Privacidade</h1>
              <p className="text-sm text-slate-400 mt-1">Última atualização: Outubro de 2026 • Em conformidade com a LGPD (Lei nº 13.709/2018)</p>
            </div>
          </div>

          <div className="space-y-8 text-slate-300 leading-relaxed">
            {/* Quem Somos */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3 text-white font-semibold text-xl">
                <FileText className="w-5 h-5 text-emerald-400" />
                <h2>1. Quem Somos</h2>
              </div>
              <p>
                O <strong>NEXIA Body Coach AI</strong> é um aplicativo avançado de acompanhamento personalizado de treino, dieta e evolução física. Nosso compromisso é fornecer ferramentas inteligentes para o seu desenvolvimento, garantindo total transparência e segurança na manipulação das suas informações pessoais e de saúde.
              </p>
            </section>

            {/* Dados que Coletamos */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3 text-white font-semibold text-xl">
                <Database className="w-5 h-5 text-emerald-400" />
                <h2>2. Dados que Coletamos</h2>
              </div>
              <p>
                Para prestar nossos serviços com excelência e segurança, coletamos os seguintes dados informados diretamente por você:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li><strong>Dados cadastrais:</strong> Nome e endereço de e-mail.</li>
                <li><strong>Respostas de questionários:</strong> Histórico de saúde, restrições alimentares, objetivos e nível de experiência.</li>
                <li><strong>Acompanhamento diário:</strong> Refeições registradas, check-ins de rotina, peso corporal, fotos de evolução e exames enviados por iniciativa própria.</li>
              </ul>
            </section>

            {/* Como Utilizamos os Dados */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3 text-white font-semibold text-xl">
                <UserCheck className="w-5 h-5 text-emerald-400" />
                <h2>3. Como Utilizamos os Dados</h2>
              </div>
              <p>
                Seus dados são tratados estritamente para propósitos legítimos relacionados à sua jornada fitness e de saúde:
              </p>
              <ul className="list-disc pl-6 space-y-2 text-slate-300">
                <li>Geração de treinos e planos alimentares personalizados por inteligência artificial.</li>
                <li>Monitoramento e exibição da sua evolução e métricas de desempenho.</li>
                <li>Comunicação sobre atualizações do aplicativo, suporte e dicas de melhoria.</li>
              </ul>
            </section>

            {/* Segurança e Armazenamento */}
            <section className="space-y-3">
              <div className="flex items-center space-x-3 text-white font-semibold text-xl">
                <Lock className="w-5 h-5 text-emerald-400" />
                <h2>4. Segurança e Armazenamento (LGPD)</h2>
              </div>
              <p>
                Adotamos medidas técnicas e organizacionais rigorosas para proteger seus dados contra acesso não autorizado, destruição ou alteração indevida. Em conformidade com a Lei Geral de Proteção de Dados (LGPD), você possui o direito de solicitar a confirmação do tratamento, acesso, retificação, eliminação ou portabilidade dos seus dados a qualquer momento diretamente através de nossos canais de atendimento.
              </p>
            </section>

            {/* Contato */}
            <section className="space-y-3 pt-4 border-t border-slate-800">
              <div className="flex items-center space-x-3 text-white font-semibold text-xl">
                <Mail className="w-5 h-5 text-emerald-400" />
                <h2>5. Fale Conosco</h2>
              </div>
              <p>
                Se tiver qualquer dúvida sobre esta Política de Privacidade ou sobre o tratamento de seus dados, entre em contato com nossa equipe de privacidade através do e-mail de suporte disponível no aplicativo.
              </p>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
