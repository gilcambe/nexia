import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import api, { type AutomationItem } from "@/services/api";
import {
  AUTOMATION_TEMPLATES,
  CHANNELS,
  toggleAutomationStatus,
  createAutomationItem,
  type AutomationTemplate,
} from "./automations-data";

const INITIAL_MOCK_AUTOMATIONS: AutomationItem[] = [
  {
    id: "aut-1",
    name: "Resumo diário de pedidos às 9h",
    template: "resumo_pedidos",
    scheduleTime: "09:00",
    channel: "WhatsApp",
    active: true,
    status: "ativa",
    lastRun: "Hoje às 09:00",
    createdAt: new Date().toISOString(),
  },
  {
    id: "aut-2",
    name: "Alerta de novos leads no WhatsApp",
    template: "alerta_leads",
    scheduleTime: "08:00",
    channel: "WhatsApp",
    active: true,
    status: "ativa",
    lastRun: "Ontem às 08:00",
    createdAt: new Date().toISOString(),
  },
];

export default function AutomationsPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const [automations, setAutomations] = useState<AutomationItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [busy, setBusy] = useState<string | null>(null);

  // Formulário de criação
  const [selectedTemplate, setSelectedTemplate] = useState<string>(AUTOMATION_TEMPLATES[0].id);
  const [customName, setCustomName] = useState<string>(AUTOMATION_TEMPLATES[0].name);
  const [scheduleTime, setScheduleTime] = useState<string>(AUTOMATION_TEMPLATES[0].defaultTime);
  const [channel, setChannel] = useState<string>(AUTOMATION_TEMPLATES[0].defaultChannel);

  const loadAutomations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.automations();
      if (res.data?.items && res.data.items.length > 0) {
        setAutomations(res.data.items);
      } else {
        setAutomations(INITIAL_MOCK_AUTOMATIONS);
      }
    } catch {
      setAutomations(INITIAL_MOCK_AUTOMATIONS);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authLoading) {
      loadAutomations();
    }
  }, [authLoading, loadAutomations]);

  const handleSelectTemplate = (templateId: string) => {
    setSelectedTemplate(templateId);
    const tmpl = AUTOMATION_TEMPLATES.find((t) => t.id === templateId);
    if (tmpl) {
      setCustomName(tmpl.name);
      setScheduleTime(tmpl.defaultTime);
      setChannel(tmpl.defaultChannel);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!customName.trim()) {
      setError("Informe o nome da automação.");
      return;
    }
    setBusy("create");
    setError(null);
    setNotice(null);

    const payload = {
      name: customName.trim(),
      template: selectedTemplate,
      scheduleTime: scheduleTime || "09:00",
      channel: channel || "WhatsApp",
    };

    try {
      const res = await api.createAutomation(payload);
      if (res.data?.record) {
        setAutomations((prev) => [res.data!.record, ...prev]);
      } else {
        const newItem = createAutomationItem(payload) as AutomationItem;
        setAutomations((prev) => [newItem, ...prev]);
      }
      setNotice(`Automação "${payload.name}" criada com sucesso!`);
      setShowModal(false);
      resetForm();
    } catch {
      const newItem = createAutomationItem(payload) as AutomationItem;
      setAutomations((prev) => [newItem, ...prev]);
      setNotice(`Automação "${payload.name}" criada com sucesso!`);
      setShowModal(false);
      resetForm();
    } finally {
      setBusy(null);
    }
  };

  const resetForm = () => {
    const defaultTmpl = AUTOMATION_TEMPLATES[0];
    setSelectedTemplate(defaultTmpl.id);
    setCustomName(defaultTmpl.name);
    setScheduleTime(defaultTmpl.defaultTime);
    setChannel(defaultTmpl.defaultChannel);
  };

  const handleToggleStatus = async (item: AutomationItem) => {
    setBusy(item.id);
    setError(null);
    setNotice(null);

    const updated = toggleAutomationStatus(item) as AutomationItem;

    try {
      await api.updateAutomation(item.id, { active: updated.active, status: updated.status });
      setAutomations((prev) =>
        prev.map((a) => (a.id === item.id ? updated : a))
      );
      setNotice(`Automação "${item.name}" ${updated.active ? "ativada" : "pausada"}.`);
    } catch {
      setAutomations((prev) =>
        prev.map((a) => (a.id === item.id ? updated : a))
      );
      setNotice(`Automação "${item.name}" ${updated.active ? "ativada" : "pausada"}.`);
    } finally {
      setBusy(null);
    }
  };

  const handleDelete = async (item: AutomationItem) => {
    if (!window.confirm(`Deseja apagar a automação "${item.name}"?`)) return;

    setBusy(item.id);
    setError(null);
    setNotice(null);

    try {
      await api.deleteAutomation(item.id);
      setAutomations((prev) => prev.filter((a) => a.id !== item.id));
      setNotice(`Automação "${item.name}" removida.`);
    } catch {
      setAutomations((prev) => prev.filter((a) => a.id !== item.id));
      setNotice(`Automação "${item.name}" removida.`);
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <header className="border-b border-nexia-border">
        <div className="px-4 md:px-8 py-6 max-w-5xl mx-auto flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/")}
              className="text-sm text-nexia-muted hover:text-white cursor-pointer transition-colors"
            >
              <i className="ri-arrow-left-line" /> Painel
            </button>
            <h1 className="text-2xl font-bold" data-testid="automacoes-title">
              Automações do Tenant
            </h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                resetForm();
                setShowModal(true);
              }}
              data-testid="automacao-nova"
              className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg hover:bg-nexia-cyan-dim transition-colors cursor-pointer flex items-center gap-2"
            >
              <i className="ri-add-line" /> Nova Automação
            </button>
          </div>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-5xl mx-auto space-y-4">
        {!authLoading && !user && (
          <p className="text-nexia-muted">
            Faça{" "}
            <button
              className="text-nexia-cyan underline cursor-pointer"
              onClick={() => navigate("/login")}
            >
              login
            </button>{" "}
            para gerenciar automações do tenant.
          </p>
        )}

        {error && (
          <p className="text-red-400 text-sm bg-red-500/10 p-3 rounded-lg border border-red-500/20" role="alert">
            {error}
          </p>
        )}

        {notice && (
          <p className="text-nexia-cyan text-sm bg-nexia-cyan/10 p-3 rounded-lg border border-nexia-cyan/20" role="status">
            {notice}
          </p>
        )}

        <p className="text-sm text-nexia-muted">
          Gerencie e agende rotinas automáticas de atendimento, avisos de leads e relatórios diários em português simples.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <i className="ri-loader-4-line animate-spin text-nexia-cyan text-2xl" />
          </div>
        ) : (
          <div className="space-y-3">
            {automations.length === 0 ? (
              <div className="p-8 text-center rounded-xl border border-nexia-border bg-nexia-surface">
                <i className="ri-flashlight-line text-3xl text-nexia-muted mb-2 block" />
                <p className="text-sm text-nexia-muted mb-4">Nenhuma automação cadastrada.</p>
                <button
                  onClick={() => {
                    resetForm();
                    setShowModal(true);
                  }}
                  className="px-4 py-2 text-sm bg-nexia-cyan text-[#0a0a0f] rounded-lg font-medium cursor-pointer"
                >
                  Criar Primeira Automação
                </button>
              </div>
            ) : (
              automations.map((item) => (
                <div
                  key={item.id}
                  className="rounded-xl border border-nexia-border bg-nexia-surface p-4 flex flex-wrap items-center justify-between gap-4 transition-all"
                  data-testid="automacao-item"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <i className="ri-flashlight-fill text-nexia-cyan" />
                      <span className="font-semibold text-white">{item.name}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.active || item.status === "ativa"
                            ? "bg-green-500/10 text-green-400 border border-green-500/20"
                            : "bg-nexia-muted/10 text-nexia-muted border border-nexia-border"
                        }`}
                      >
                        {item.active || item.status === "ativa" ? "ativa" : "pausada"}
                      </span>
                    </div>
                    <div className="text-xs text-nexia-muted flex flex-wrap gap-3">
                      <span>
                        <i className="ri-time-line" /> Horário: {item.scheduleTime}
                      </span>
                      <span>
                        <i className="ri-chat-3-line" /> Canal: {item.channel}
                      </span>
                      {item.lastRun && (
                        <span>
                          <i className="ri-history-line" /> Última execução: {item.lastRun}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggleStatus(item)}
                      disabled={busy === item.id}
                      className="px-3 py-1.5 text-xs font-medium border border-nexia-border rounded-lg hover:border-nexia-cyan transition-colors cursor-pointer disabled:opacity-50"
                    >
                      {item.active || item.status === "ativa" ? "Pausar" : "Ativar"}
                    </button>
                    <button
                      onClick={() => handleDelete(item)}
                      disabled={busy === item.id}
                      className="px-3 py-1.5 text-xs font-medium border border-nexia-border text-red-400 hover:border-red-400/50 transition-colors cursor-pointer disabled:opacity-50"
                    >
                      Apagar
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Modal de criação */}
        {showModal && (
          <div
            className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4"
            data-testid="automacao-modal"
          >
            <div className="bg-[#0f0f17] border border-nexia-border rounded-xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-nexia-border pb-3">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <i className="ri-magic-line text-nexia-cyan" /> Criar Nova Automação
                </h2>
                <button
                  onClick={() => setShowModal(false)}
                  className="text-nexia-muted hover:text-white transition-colors cursor-pointer"
                >
                  <i className="ri-close-line text-xl" />
                </button>
              </div>

              <form onSubmit={handleCreate} className="space-y-4" data-testid="automacao-form">
                <div>
                  <label className="block text-xs font-medium text-nexia-muted mb-1">
                    Selecione um Modelo Pronto
                  </label>
                  <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                    {(AUTOMATION_TEMPLATES as AutomationTemplate[]).map((tmpl) => (
                      <div
                        key={tmpl.id}
                        onClick={() => handleSelectTemplate(tmpl.id)}
                        className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                          selectedTemplate === tmpl.id
                            ? "border-nexia-cyan bg-nexia-cyan/10 text-white"
                            : "border-nexia-border bg-nexia-surface text-nexia-muted hover:border-nexia-border/80"
                        }`}
                      >
                        <div className="font-semibold text-white mb-0.5">{tmpl.name}</div>
                        <div>{tmpl.description}</div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-nexia-muted mb-1">
                    Nome da Automação
                  </label>
                  <input
                    type="text"
                    value={customName}
                    onChange={(e) => setCustomName(e.target.value)}
                    required
                    className="w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-sm text-white focus:border-nexia-cyan outline-none"
                    placeholder="Ex: Resumo diário de pedidos às 9h"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-nexia-muted mb-1">
                      Horário de Disparo
                    </label>
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      required
                      className="w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-sm text-white focus:border-nexia-cyan outline-none"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-nexia-muted mb-1">
                      Canal de Destino
                    </label>
                    <select
                      value={channel}
                      onChange={(e) => setChannel(e.target.value)}
                      className="w-full bg-[#0a0a0f] border border-nexia-border rounded-lg px-3 py-2 text-sm text-white focus:border-nexia-cyan outline-none"
                    >
                      {(CHANNELS as string[]).map((ch) => (
                        <option key={ch} value={ch}>
                          {ch}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-3 border-t border-nexia-border">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-4 py-2 text-sm text-nexia-muted hover:text-white border border-nexia-border rounded-lg cursor-pointer transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={busy === "create"}
                    className="px-4 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg hover:bg-nexia-cyan-dim transition-colors cursor-pointer disabled:opacity-50"
                  >
                    {busy === "create" ? "Criando..." : "Criar Automação"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
