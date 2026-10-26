// src/pages/chat.js
import React, { useState, useEffect, useRef } from "react";
import { initTurnstile } from "../config/turnstile";

export default function ChatPage() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [turnstileToken, setTurnstileToken] = useState("");
  const [isVerified, setIsVerified] = useState(false);
  const [loading, setLoading] = useState(false);
  const turnstileRef = useRef(null);

  useEffect(() => {
    // Inicializa Turnstile apenas se ainda não tiver token e container existir
    if (!isVerified && !turnstileToken && turnstileRef.current) {
      initTurnstile(turnstileRef.current, (token) => {
        setTurnstileToken(token);
        setIsVerified(true);
      });
    }
  }, [isVerified, turnstileToken]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    if (!isVerified || !turnstileToken) {
      alert("Por favor, complete a verificação Turnstile antes de enviar a primeira mensagem.");
      return;
    }

    setLoading(true);
    try {
      // Valida token server-side antes de prosseguir
      const validateRes = await fetch("/api/turnstileValidate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: turnstileToken }),
      });

      if (!validateRes.ok) {
        const errData = await validateRes.json().catch(() => ({}));
        alert(errData.error || "Erro na validação de segurança (403)");
        setLoading(false);
        return;
      }

      const userMsg = { role: "user", content: input };
      setMessages((prev) => [...prev, userMsg]);
      setInput("");

      // Simula resposta do assistente
      setTimeout(() => {
        setMessages((prev) => [
          ...prev,
          { role: "assistant", content: "Mensagem recebida e aceita com sucesso!" },
        ]);
        setLoading(false);
      }, 500);
    } catch (err) {
      console.error(err);
      alert("Erro ao enviar mensagem");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white flex flex-col items-center justify-between p-4">
      <div className="w-full max-w-2xl bg-[#12121a] rounded-xl p-4 flex flex-col h-[80vh] shadow-xl border border-gray-800">
        <header className="border-b border-gray-800 pb-3 mb-4">
          <h1 className="text-xl font-bold text-nexia-cyan">Chat Seguro com Turnstile</h1>
        </header>

        <div className="flex-1 overflow-y-auto space-y-3 pr-2">
          {messages.length === 0 && (
            <p className="text-gray-400 text-center mt-10">
              Envie sua primeira mensagem. Complete o Turnstile abaixo se necessário.
            </p>
          )}
          {messages.map((m, idx) => (
            <div
              key={idx}
              className={`p-3 rounded-lg max-w-[80%] ${
                m.role === "user"
                  ? "bg-nexia-cyan/20 ml-auto text-white border border-nexia-cyan/30"
                  : "bg-gray-800 mr-auto text-gray-200"
              }`}
            >
              {m.content}
            </div>
          ))}
        </div>

        {!isVerified && (
          <div className="my-3 p-3 bg-gray-900 rounded-lg flex flex-col items-center border border-gray-700">
            <p className="text-sm text-gray-300 mb-2">Verifique que você é humano:</p>
            <div ref={turnstileRef} id="turnstile-container"></div>
          </div>
        )}

        <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite sua mensagem..."
            className="flex-1 bg-gray-900 border border-gray-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-nexia-cyan"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading}
            className="bg-nexia-cyan text-black font-semibold px-5 py-2 rounded-lg hover:opacity-90 transition disabled:opacity-50"
          >
            {loading ? "Enviando..." : "Enviar"}
          </button>
        </form>
      </div>
    </div>
  );
}
