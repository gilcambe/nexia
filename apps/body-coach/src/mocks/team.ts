export interface TeamMember {
  id: string;
  name: string;
  role: string;
  core: boolean;
  active: boolean;
  reason: string;
}

export interface TeamCategory {
  id: string;
  title: string;
  subtitle: string;
  icon: string;
  members: TeamMember[];
}

export const teamCategories: TeamCategory[] = [
  {
    id: 'direcao',
    title: 'Direção e integração',
    subtitle: 'Núcleo que integra e coordena toda a decisão de performance',
    icon: 'ri-team-line',
    members: [
      { id: 'd1', name: 'Performance Director', role: 'Integra a equipe e coordena as decisões de performance', core: true, active: true, reason: 'Prioriza a sessão do dia' },
      { id: 'd2', name: 'Head Coach', role: 'Estratégia e desenvolvimento esportivo', core: true, active: true, reason: 'Executa o treino de força' },
      { id: 'd3', name: 'Sports Scientist', role: 'Ciência aplicada ao treinamento e performance', core: true, active: true, reason: 'Gerencia carga e adaptação' },
      { id: 'd4', name: 'Performance/Data Analyst', role: 'Dados, métricas, tendências e modelagem', core: true, active: true, reason: 'Analisa prontidão e progresso' },
    ],
  },
  {
    id: 'medicina',
    title: 'Medicina',
    subtitle: 'Núcleo médico + especialistas acionados conforme necessidade',
    icon: 'ri-heart-pulse-line',
    members: [
      { id: 'm1', name: 'Médico do Esporte', role: 'Médico principal do atleta', core: true, active: true, reason: 'Camada de segurança da sessão' },
      { id: 'm2', name: 'Ortopedista Esportivo', role: 'Lesões musculoesqueléticas', core: false, active: true, reason: 'Monitora o ombro direito' },
      { id: 'm3', name: 'Cardiologista Esportivo', role: 'Sistema cardiovascular e capacidade cardiorrespiratória', core: false, active: false, reason: '' },
      { id: 'm4', name: 'Endocrinologista', role: 'Metabolismo e eixo hormonal', core: false, active: false, reason: '' },
      { id: 'm5', name: 'Fisiatra', role: 'Medicina física e reabilitação', core: false, active: false, reason: '' },
      { id: 'm6', name: 'Médico do Sono', role: 'Sono, recuperação e ritmo circadiano', core: false, active: true, reason: 'Sono 6h20 — abaixo do ideal' },
    ],
  },
  {
    id: 'reabilitacao',
    title: 'Reabilitação e prevenção',
    subtitle: 'Prevenção de lesões e longevidade como componente central',
    icon: 'ri-heart-add-line',
    members: [
      { id: 'r1', name: 'Head Physiotherapist', role: 'Coordenação da fisioterapia', core: true, active: true, reason: 'Revisa mobilidade antes do treino' },
      { id: 'r2', name: 'Fisioterapeuta Esportivo', role: 'Tratamento e prevenção', core: true, active: true, reason: 'Ombro direito sob observação' },
      { id: 'r3', name: 'Fisioterapeuta de Performance', role: 'Preparação física e movimento', core: true, active: false, reason: '' },
      { id: 'r4', name: 'Sports Massage Therapist', role: 'Recuperação muscular', core: false, active: false, reason: '' },
      { id: 'r5', name: 'Recovery Specialist', role: 'Estratégias de recuperação', core: true, active: true, reason: 'Recuperação ~18% abaixo da linha' },
    ],
  },
  {
    id: 'performance-fisica',
    title: 'Performance física',
    subtitle: 'Força, potência, condicionamento e mobilidade',
    icon: 'ri-fire-line',
    members: [
      { id: 'p1', name: 'Strength & Conditioning Coach', role: 'Força, potência e condicionamento', core: true, active: true, reason: 'Prescreve a carga do dia' },
      { id: 'p2', name: 'Strength Coach', role: 'Desenvolvimento de força', core: true, active: true, reason: 'Acompanha as séries pesadas' },
      { id: 'p3', name: 'Conditioning Specialist', role: 'Sistemas energéticos e resistência', core: true, active: false, reason: '' },
      { id: 'p4', name: 'Speed & Power Coach', role: 'Velocidade, aceleração e potência', core: false, active: false, reason: '' },
      { id: 'p5', name: 'Mobility/Movement Specialist', role: 'Mobilidade e qualidade de movimento', core: true, active: true, reason: 'Qualidade de execução no agachamento' },
    ],
  },
  {
    id: 'tecnica',
    title: 'Técnica específica',
    subtitle: 'Técnica global, refinamento e análise competitiva',
    icon: 'ri-focus-3-line',
    members: [
      { id: 't1', name: 'Head Sport Coach', role: 'Técnica global', core: true, active: true, reason: 'Supervisiona a execução' },
      { id: 't2', name: 'Technical Specialist', role: 'Refinamento técnico', core: false, active: false, reason: '' },
      { id: 't3', name: 'Video Analyst', role: 'Análise técnica por vídeo', core: false, active: false, reason: '' },
      { id: 't4', name: 'Tactical/Competition Analyst', role: 'Estratégia competitiva', core: false, active: false, reason: '' },
      { id: 't5', name: 'Opponent/Performance Analyst', role: 'Adversários e padrões competitivos', core: false, active: false, reason: '' },
    ],
  },
  {
    id: 'nutricao',
    title: 'Nutrição',
    subtitle: 'Nutrição como parte da performance, não como serviço à parte',
    icon: 'ri-restaurant-line',
    members: [
      { id: 'n1', name: 'Sports Dietitian/Nutritionist', role: 'Estratégia nutricional', core: true, active: true, reason: 'Meta de proteína pendente hoje' },
      { id: 'n2', name: 'Performance Nutrition Specialist', role: 'Nutrição orientada à performance', core: true, active: true, reason: 'Ajusta macros do dia' },
      { id: 'n3', name: 'Supplement/Anti-Doping Specialist', role: 'Controle de suplementos e risco antidoping', core: false, active: false, reason: '' },
    ],
  },
  {
    id: 'psicologia',
    title: 'Psicologia e performance cognitiva',
    subtitle: 'A dimensão mental não é periférica',
    icon: 'ri-brain-line',
    members: [
      { id: 'ps1', name: 'Sport Psychologist', role: 'Performance psicológica', core: true, active: false, reason: '' },
      { id: 'ps2', name: 'Performance Mental Coach', role: 'Foco, concentração e preparação competitiva', core: false, active: false, reason: '' },
      { id: 'ps3', name: 'Neuro/Performance Specialist', role: 'Cognição, reação e tomada de decisão', core: false, active: false, reason: '' },
    ],
  },
  {
    id: 'biomecanica',
    title: 'Biomecânica e ciência',
    subtitle: 'Análise do movimento e resposta fisiológica',
    icon: 'ri-ruler-line',
    members: [
      { id: 'b1', name: 'Biomechanist', role: 'Análise do movimento', core: false, active: false, reason: '' },
      { id: 'b2', name: 'Exercise Physiologist', role: 'Resposta fisiológica ao exercício', core: true, active: false, reason: '' },
      { id: 'b3', name: 'Human Performance Scientist', role: 'Integração fisiológica', core: true, active: false, reason: '' },
      { id: 'b4', name: 'Testing & Assessment Specialist', role: 'Testes e avaliações', core: false, active: false, reason: '' },
      { id: 'b5', name: 'Lab/Research Specialist', role: 'Pesquisa e protocolos avançados', core: false, active: false, reason: '' },
    ],
  },
  {
    id: 'dados',
    title: 'Dados e tecnologia',
    subtitle: 'O objetivo é criar o Digital Twin do atleta',
    icon: 'ri-cpu-line',
    members: [
      { id: 'da1', name: 'Sports Data Scientist', role: 'Modelagem e análise', core: true, active: true, reason: 'Modela risco de lesão e prontidão' },
      { id: 'da2', name: 'Performance Engineer/Analyst', role: 'Integração de sensores e métricas', core: true, active: false, reason: '' },
      { id: 'da3', name: 'Technology Specialist', role: 'Wearables, plataformas e equipamentos', core: false, active: false, reason: '' },
      { id: 'da4', name: 'AI/Performance Analytics Specialist', role: 'Modelos preditivos e detecção de padrões', core: true, active: true, reason: 'Digital Twin em evolução' },
    ],
  },
];