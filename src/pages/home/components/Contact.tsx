import { useState, useCallback } from "react";
import { ScrollReveal } from "@/hooks/useScrollReveal";
import api from "@/services/api";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", company: "", message: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const handleSubmit = useCallback(async () => {
    if (!form.name.trim() || !form.email.trim() || !form.message.trim()) {
      setStatus("error");
      setErrorMsg("Preencha nome, e-mail e mensagem.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      setStatus("error");
      setErrorMsg("E-mail inválido.");
      return;
    }
    setStatus("loading");
    try {
      // Send via CORTEX as a lead notification
      await api.cortexChat({
        message: `[LEAD] Nome: ${form.name} | Email: ${form.email} | Empresa: ${form.company || "N/A"} | Mensagem: ${form.message}`,
        tenantId: "nexia",
      });
      setStatus("success");
      setForm({ name: "", email: "", company: "", message: "" });
      setTimeout(() => setStatus("idle"), 5000);
    } catch {
      setStatus("error");
      setErrorMsg("Erro ao enviar. Tente o WhatsApp.");
    }
  }, [form]);

  return (
    <section id="contact" className="py-20 px-4 md:px-8 max-w-7xl mx-auto">
      <ScrollReveal direction="up" delay={0}>
        <div className="max-w-xl mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-black text-white mb-4">
              Vamos <span className="text-nexia-cyan">conversar</span>
            </h2>
            <p className="text-nexia-muted">Entre em contato para uma demo personalizada.</p>
          </div>

          <div className="rounded-xl bg-nexia-surface border border-nexia-border p-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="text-xs text-nexia-muted mb-1.5 block">Nome *</label>
                <input value={form.name} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Seu nome" className="w-full px-3 py-2 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40" />
              </div>
              <div>
                <label className="text-xs text-nexia-muted mb-1.5 block">E-mail *</label>
                <input type="email" value={form.email} onChange={(e) => setForm(f => ({ ...f, email: e.target.value }))} placeholder="seu@email.com" className="w-full px-3 py-2 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40" />
              </div>
            </div>
            <div className="mb-4">
              <label className="text-xs text-nexia-muted mb-1.5 block">Empresa</label>
              <input value={form.company} onChange={(e) => setForm(f => ({ ...f, company: e.target.value }))} placeholder="Nome da empresa" className="w-full px-3 py-2 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40" />
            </div>
            <div className="mb-6">
              <label className="text-xs text-nexia-muted mb-1.5 block">Mensagem *</label>
              <textarea value={form.message} onChange={(e) => setForm(f => ({ ...f, message: e.target.value }))} placeholder="Como podemos ajudar?" rows={4} className="w-full px-3 py-2 text-sm bg-nexia-surface2 border border-nexia-border rounded-lg text-white placeholder-nexia-muted outline-none focus:border-nexia-cyan/40 resize-none" />
            </div>

            {status === "error" && <p className="text-xs text-red-400 mb-3">{errorMsg}</p>}
            {status === "success" && (
              <div className="mb-3 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <p className="text-xs text-emerald-400">✓ Mensagem enviada! Nossa equipe retornará em breve.</p>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3">
              <button onClick={handleSubmit} disabled={status === "loading"} className="flex-1 flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-colors disabled:opacity-60 cursor-pointer">
                {status === "loading" ? <><i className="ri-loader-4-line animate-spin" /> Enviando...</> : <><i className="ri-send-plane-line" /> Enviar mensagem</>}
              </button>
              <a href="https://wa.me/5511944037259?text=Olá! Quero saber mais sobre o NEXIA OS" target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap">
                <i className="ri-whatsapp-fill" /> WhatsApp
              </a>
            </div>
          </div>
        </div>
      </ScrollReveal>
    </section>
  );
}
