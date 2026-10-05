'use strict';
// ADR-AUTO-01: modelos prontos de robô. São só texto pré-preenchido (nome, tarefa e agenda
// sugerida) para o mecanismo genérico; o robô roda como qualquer pedido ao Orchestrator,
// com a autonomia do projeto e as aprovações de sempre.

const TEMPLATES = [
  {
    id: 'site_watch',
    name: 'Vigia do site',
    description: 'Confere todo dia se o site do projeto e os links estão no ar; se algo quebrou, abre um PR com a correção.',
    task: 'Verifique o site do projeto: abra as páginas principais e confira se todos os links, imagens e formulários funcionam. '
      + 'Se encontrar algo quebrado, corrija numa branch nova e abra um PR com a correção explicando o que estava errado. '
      + 'Se estiver tudo certo, responda só com um resumo curto do que foi conferido.',
    schedule: { kind: 'daily', time: '07:00' },
  },
  {
    id: 'pr_review',
    name: 'Revisor de PRs',
    description: 'Revisa os PRs abertos do repositório e aponta problemas de segurança, qualidade e testes.',
    task: 'Liste os pull requests abertos do repositório do projeto e revise cada um: aponte problemas de segurança, bugs, '
      + 'falta de testes e pontos de qualidade, com o arquivo e o motivo. Apenas leitura: sem merge e sem commits.',
    schedule: { kind: 'weekly', time: '09:00', days: [1, 2, 3, 4, 5] },
  },
  {
    id: 'daily_report',
    name: 'Relatório diário',
    description: 'Resume o que mudou no projeto nas últimas 24 horas: commits, PRs, deploys e erros.',
    task: 'Qual é o status do projeto? Faça um resumo do que mudou nas últimas 24 horas: commits, pull requests, '
      + 'deploys, execuções e erros. Termine com o que precisa de atenção.',
    schedule: { kind: 'daily', time: '18:00' },
  },
];

const TEMPLATE_IDS = TEMPLATES.map(t => t.id);

module.exports = { TEMPLATES, TEMPLATE_IDS };
