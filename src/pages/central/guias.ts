export interface Guia {
  title: string;
  content: string;
}

export interface GuiasMap {
  [key: string]: Guia;
}

export const guias: GuiasMap = {
  painel: {
    title: 'Como usar o Painel',
    content: 'O Painel oferece uma visão geral de todas as funcionalidades e indicadores importantes do sistema. Navegue pelas seções para obter detalhes.'
  },
  cortex: {
    title: 'Como usar o Cortex',
    content: 'O Cortex é a inteligência artificial do sistema. Use-o para fazer perguntas, obter insights e automatizar tarefas. Experimente a funcionalidade de perguntas e respostas.'
  },
  maquinas: {
    title: 'Como usar as Máquinas',
    content: 'Nesta seção, você pode gerenciar o inventário de máquinas, monitorar seu status e agendar manutenções. Adicione novas máquinas e atualize as existentes.'
  },
  'ia-vagas': {
    title: 'Como usar a IA Vagas',
    content: 'A IA Vagas utiliza inteligência artificial para buscar e analisar oportunidades de emprego. Insira seus critérios e deixe a IA encontrar as melhores opções para você.'
  },
  saude: {
    title: 'Como usar a Saúde',
    content: 'Mantenha-se atualizado sobre sua saúde. Registre seus dados, acompanhe seus progressos e receba recomendações personalizadas.'
  },
  avisos: {
    title: 'Como usar os Avisos',
    content: 'Fique por dentro das últimas novidades e notificações importantes. Os avisos são exibidos aqui para garantir que você não perca nenhuma informação relevante.'
  },
  pedidos: {
    title: 'Como usar Pedidos',
    content: 'Visualize o histórico completo dos seus pedidos. Acompanhe o status, detalhes e informações de entrega de cada item solicitado.'
  },
  mais: {
    title: 'Como usar Mais',
    content: 'Explore outras funcionalidades e recursos adicionais que o sistema oferece. Esta seção contém links para áreas menos acessadas ou complementares.'
  },
  'sites-clientes': {
    title: 'Como usar Sites de Clientes',
    content: 'Acesse e gerencie os sites desenvolvidos para nossos clientes. Visualize o portfólio e as informações de cada projeto.'
  },
  lote: {
    title: 'Como usar Lote',
    content: 'Realize operações em lote para otimizar seu tempo. Esta funcionalidade permite executar ações em múltiplos itens simultaneamente.'
  },
  moldes: {
    title: 'Como usar Moldes',
    content: 'Gerencie os moldes utilizados no sistema. Adicione novos moldes, edite os existentes e acompanhe seu status.'
  }
};

