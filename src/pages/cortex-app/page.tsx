import { useState, useRef, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { streamCortex } from "@/services/api";
import { listarProjetos, obterProjeto, salvarProjeto, apagarProjeto, montarPrompt, type ProjetoCortex } from "@/lib/projetosCortex";
import { lerConfigGoogle, salvarConfigGoogle, testarGoogle, listarAgenda, criarEvento, buscarDrive, lerDrive, textoAgenda, parecePerguntaDeAgenda, lerComandoAgendar, urlImagem, type ConfigGoogle } from "@/lib/googleCortex";
import { verificarConexoes, type Conexao } from "@/lib/conexoesCortex";
import { novaConversaId, salvarConversa, listarConversas, obterConversa, apagarConversa, type Conversa } from "@/lib/conversasCortex";

interface Message {
  id: string;
  role: "user" | "assistant";
  text: string;
  model?: string;
  streaming?: boolean;
  imagem?: string;
}

const MODEL_OPTIONS = [
  { value: "auto", label: "Auto-route" },
  { value: "claude", label: "Claude Sonnet 4.6" },
  { value: "claude_opus", label: "Claude Opus 4.5" },
  { value: "gpt4o", label: "GPT-4o" },
  { value: "gemini_25_pro", label: "Gemini 2.5 Pro" },
  { value: "gemini_25_flash", label: "Gemini 2.5 Flash" },
  { value: "groq_llama4_scout", label: "Llama 4 Scout (Groq)" },
  { value: "groq_llama4_maverick", label: "Llama 4 Maverick (Groq)" },
  { value: "groq_deepseek_r1", label: "DeepSeek R1 (Groq)" },
  { value: "deepseek_v3", label: "DeepSeek V3" },
  { value: "grok3", label: "Grok-3 Fast" },
  { value: "perplexity", label: "Perplexity" },
  { value: "cerebras_llama4", label: "Llama 4 Scout (Cerebras)" },
  { value: "or_deepseek_r1", label: "DeepSeek R1 (OpenRouter)" },
  { value: "or_qwen3_coder", label: "Qwen3 Coder (OpenRouter)" },
];

const CHIPS = [
  "Orquestre 3 modelos de IA",
  "Crie uma API REST em Node.js",
  "Análise de segurança OWASP",
  "Gere uma landing page React",
  "Previsão de churn SaaS",
];

const BOAS_VINDAS: Message = {
  id: "welcome",
  role: "assistant",
  text: "Olá! Sou o CORTEX v16 — orquestrador universal de IA com 50+ providers. Posso rotear sua requisição entre Claude, GPT-4o, Gemini, DeepSeek, Grok, Groq, Cerebras e mais — com streaming real token-a-token. O que você precisa?",
  model: "CORTEX v16",
};

import { useState, useEffect } from 'react';
import { ThemeContext, useTheme } from '@/hooks/useTheme';
import Sidebar from '@/pages/cortex-app/components/Sidebar';
import ChatArea from '@/pages/cortex-app/components/ChatArea';
import PreviewPanel from '@/pages/cortex-app/components/PreviewPanel';
import { cn } from '@/lib/utils';

export default function CortexPage() {
  const themeState = useTheme();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<string | null>(null);

  return (
    <ThemeContext.Provider value={themeState}>
      <div className={cn("min-h-screen flex flex-col transition-colors duration-200", themeState.theme === 'dark' ? "bg-[#0a0a0f] text-white" : "bg-gray-50 text-gray-900")}>
        <div className="flex flex-1 overflow-hidden">
          <Sidebar isOpen={sidebarOpen} onToggle={() => setSidebarOpen(!sidebarOpen)} />
          <ChatArea onOpenPreview={(content) => { setPreviewContent(content); setPreviewOpen(true); }} />
          {previewOpen && (
            <PreviewPanel content={previewContent} onClose={() => setPreviewOpen(false)} />
          )}
        </div>
      </div>
    </ThemeContext.Provider>
  );
}
