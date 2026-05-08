export const qaEngines = [
  { id: "e2e", name: "E2E Playwright", status: "running", tests: 847, passed: 821, failed: 14, skipped: 12, lastRun: "2 min atrás", duration: "4m 23s", icon: "ri-global-line" },
  { id: "api", name: "API Tester", status: "running", tests: 312, passed: 312, failed: 0, skipped: 0, lastRun: "5 min atrás", duration: "1m 08s", icon: "ri-plug-line" },
  { id: "perf", name: "Perf. k6", status: "idle", tests: 156, passed: 153, failed: 3, skipped: 0, lastRun: "1h atrás", duration: "8m 45s", icon: "ri-timer-flash-line" },
  { id: "security", name: "Security Scanner", status: "running", tests: 68, passed: 62, failed: 4, skipped: 2, lastRun: "30s atrás", duration: "2m 12s", icon: "ri-shield-check-line" },
  { id: "visual", name: "Visual Regression", status: "idle", tests: 42, passed: 40, failed: 2, skipped: 0, lastRun: "3h atrás", duration: "6m 30s", icon: "ri-eye-line" },
  { id: "a11y", name: "Acessibilidade", status: "idle", tests: 94, passed: 88, failed: 4, skipped: 2, lastRun: "45 min atrás", duration: "3m 15s", icon: "ri-wheelchair-line" },
];

export const aiModules = [
  { id: "codefixer", name: "CodeFixer", description: "Corrige bugs automaticamente via análise estática + LLM", fixed: 47, pending: 3, accuracy: 94.2, icon: "ri-code-box-line", color: "#00d4aa" },
  { id: "analyzer", name: "Analysis Engine", description: "Mapeia arquitetura, dependências e tech stack do projeto", projects: 12, avgTime: "2m 30s", accuracy: 98.7, icon: "ri-brain-line", color: "#f59e0b" },
];

export const recentFindings = [
  { id: "f1", severity: "critical", engine: "Security Scanner", title: "XSS reflexivo detectado no campo de busca", file: "src/components/Search.tsx:23", fix: "Sanitizar input com DOMPurify", status: "open" },
  { id: "f2", severity: "high", engine: "E2E Playwright", title: "Formulário de contato retorna 500 no submit", file: "src/pages/Contact.tsx:89", fix: "Adicionar tratamento de erro no catch do fetch", status: "open" },
  { id: "f3", severity: "high", engine: "Perf. k6", title: "LCP > 2.5s em 3G simulation", file: "src/pages/Home.tsx (Hero image)", fix: "Usar imagem otimizada WebP + lazy loading", status: "fixed" },
  { id: "f4", severity: "medium", engine: "API Tester", title: "Rate limit não aplicado no endpoint /api/v1/leads", file: "functions/leads/index.ts:15", fix: "Adicionar middleware de rate limiting", status: "open" },
  { id: "f5", severity: "medium", engine: "Acessibilidade", title: "Botão sem aria-label no menu mobile", file: "src/components/Navbar.tsx:67", fix: "Adicionar aria-label descritivo ao botão hamburger", status: "fixed" },
  { id: "f6", severity: "low", engine: "Visual Regression", title: "Alinhamento deslocado 2px no card de preço", file: "src/components/PricingCard.tsx:45", fix: "Ajustar padding-top de 16px para 18px", status: "open" },
];

export const projectScan = {
  name: "NEXIA OS", url: "https://nexia-os.onrender.com",
  techStack: ["React 18", "TypeScript", "TailwindCSS", "Vite", "i18next", "React Router"],
  totalFiles: 47, totalLines: 3847, testCoverage: 72.4, securityScore: 84, performanceScore: 78, a11yScore: 91,
  lastFullScan: "2026-05-03T14:30:00Z",
};

export const scanHistory = [
  { date: "03 Mai", critical: 2, high: 3, medium: 4, low: 1, passed: 92 },
  { date: "02 Mai", critical: 4, high: 5, medium: 6, low: 3, passed: 88 },
  { date: "01 Mai", critical: 1, high: 2, medium: 3, low: 2, passed: 95 },
  { date: "30 Abr", critical: 3, high: 4, medium: 5, low: 2, passed: 89 },
  { date: "29 Abr", critical: 5, high: 6, medium: 7, low: 4, passed: 85 },
  { date: "28 Abr", critical: 2, high: 3, medium: 4, low: 1, passed: 93 },
  { date: "27 Abr", critical: 1, high: 2, medium: 3, low: 1, passed: 96 },
];
