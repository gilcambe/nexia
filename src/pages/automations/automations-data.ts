export interface AutomationTemplate {
  id: string;
  name: string;
  defaultTime: string;
  defaultChannel: string;
  description: string;
}

export interface AutomationItemPayload {
  id?: string;
  name: string;
  template?: string;
  scheduleTime?: string;
  channel?: string;
  active?: boolean;
  status?: "ativa" | "pausada";
  createdAt?: string;
}

export const AUTOMATION_TEMPLATES: AutomationTemplate[] = [
  {
    id: "resumo_pedidos",
    name: "Resumo diário de pedidos às 9h",
    defaultTime: "09:00",
    defaultChannel: "WhatsApp",
    description: "Envia o consolidado das vendas e pedidos do dia anterior direto no canal escolhido.",
  },
  {
    id: "alerta_leads",
    name: "Alerta de novos leads no WhatsApp",
    defaultTime: "08:00",
    defaultChannel: "WhatsApp",
    description: "Notifica imediatamente quando um novo cliente/lead preenche o formulário.",
  },
  {
    id: "lembrete_cobranca",
    name: "Lembrete de cobrança pendente",
    defaultTime: "10:00",
    defaultChannel: "E-mail",
    description: "Dispara aviso automático para clientes com faturas ou pagamentos pendentes.",
  },
  {
    id: "relatorio_semanal",
    name: "Relatório semanal de desempenho",
    defaultTime: "18:00",
    defaultChannel: "Painel/Notificação",
    description: "Gera um balanço com métricas de desempenho e relatórios ao final da semana.",
  },
];

export const CHANNELS = ["WhatsApp", "E-mail", "Painel/Notificação"];

export function toggleAutomationStatus<T extends { active: boolean; status: "ativa" | "pausada" }>(item: T): T {
  const active = !item.active;
  const status = active ? "ativa" : "pausada";
  return { ...item, active, status };
}

export function createAutomationItem(payload: AutomationItemPayload) {
  const name = (payload.name || "").trim();
  if (!name) throw new Error("Nome da automação é obrigatório");
  return {
    id: payload.id || `aut-${Date.now()}`,
    name,
    template: payload.template || "custom",
    scheduleTime: payload.scheduleTime || "09:00",
    channel: payload.channel || "WhatsApp",
    active: payload.active !== undefined ? payload.active : true,
    status: (payload.status || (payload.active === false ? "pausada" : "ativa")) as "ativa" | "pausada",
    createdAt: payload.createdAt || new Date().toISOString(),
  };
}
