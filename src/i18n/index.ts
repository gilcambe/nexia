import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";

const resources = {
  pt: {
    translation: {
      nav: { home: "Início", sentinel: "Sentinel", pipeline: "Pipeline", docs: "Docs", code: "Código", login: "Entrar", logout: "Sair" },
      hero: { title: "Sistema Operacional de", highlight: "Inteligência Artificial", subtitle: "Orquestre Claude, GPT-4o, Gemini, Grok e 15+ IAs em uma única plataforma SaaS.", cta: "Testar CORTEX v16", secondary: "Ver Pipeline" },
      agent: { cortex: "Orquestrador universal de IA com roteamento inteligente", dev: "Desenvolvimento de software, arquitetura e código", security: "CISO virtual, LGPD, OWASP e pentest", business: "Estratégia, MRR, churn e crescimento SaaS", finance: "DRE, fluxo de caixa e análise financeira", legal: "Contratos, compliance e análise jurídica" },
    },
  },
  en: {
    translation: {
      nav: { home: "Home", sentinel: "Sentinel", pipeline: "Pipeline", docs: "Docs", code: "Code", login: "Sign In", logout: "Sign Out" },
      hero: { title: "Artificial Intelligence", highlight: "Operating System", subtitle: "Orchestrate Claude, GPT-4o, Gemini, Grok and 15+ AIs in a single SaaS platform.", cta: "Try CORTEX v16", secondary: "View Pipeline" },
      agent: { cortex: "Universal AI orchestrator with intelligent routing", dev: "Software development, architecture and code", security: "Virtual CISO, OWASP and pentest", business: "Strategy, MRR, churn and SaaS growth", finance: "P&L, cash flow and financial analysis", legal: "Contracts, compliance and legal analysis" },
    },
  },
  es: {
    translation: {
      nav: { home: "Inicio", sentinel: "Sentinel", pipeline: "Pipeline", docs: "Docs", code: "Código", login: "Entrar", logout: "Salir" },
      hero: { title: "Sistema Operativo de", highlight: "Inteligencia Artificial", subtitle: "Orquesta Claude, GPT-4o, Gemini, Grok y 15+ IAs en una única plataforma SaaS.", cta: "Probar CORTEX v16", secondary: "Ver Pipeline" },
      agent: { cortex: "Orquestrador universal de IA con enrutamiento inteligente", dev: "Desarrollo de software, arquitectura y código", security: "CISO virtual, OWASP y pentest", business: "Estrategia, MRR, churn y crecimiento SaaS", finance: "P&L, flujo de caja y análisis financiero", legal: "Contratos, compliance y análisis jurídico" },
    },
  },
};

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: "pt",
    interpolation: { escapeValue: false },
  });

export default i18n;
