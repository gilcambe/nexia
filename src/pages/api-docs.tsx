import Navbar from "./home/components/Navbar";
import Footer, { MADE_WITH_KERNEX_LINK } from "./home/components/Footer";
import ThemeWidget from "./home/components/ThemeWidget";
import { useNavigate } from "react-router-dom";

interface CodeBlockProps {
  lang: string;
  title: string;
  code: string;
}

function CodeBlock({ lang, title, code }: CodeBlockProps) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(code).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <div className="rounded-xl bg-nexia-surface border border-nexia-border overflow-hidden mb-6">
      <div className="flex items-center justify-between px-4 py-2.5 bg-nexia-surface2 border-b border-nexia-border">
        <span className="text-xs font-mono text-nexia-muted">{title}</span>
        <button onClick={handleCopy} className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-nexia-muted hover:text-white hover:bg-white/5 transition-colors cursor-pointer whitespace-nowrap">
          <i className={copied ? "ri-check-line text-emerald-400" : "ri-file-copy-line"} />
          {copied ? "Copiado" : "Copiar"}
        </button>
      </div>
      <pre className="p-4 overflow-x-auto"><code className={`language-${lang} font-mono text-[11px] leading-relaxed text-nexia-muted`}>{code}</code></pre>
    </div>
  );
}

export default function ApiDocsPage() {
  const navigate = useNavigate();

  const curl = `curl -X POST https://seu-site.cortex/api \
  -H "Content-Type: application/json" \
  -d '{\"mensagem\":\"Olá, Cortex!\"}'`;

  const python = `from openai import OpenAI

client = OpenAI(
  base_url="https://seu-site.cortex/cortex",
  api_key="SUA_CHAVE_API",
)

resposta = client.chat.completions.create(
  model="cortex",
  messages=[{\"role\": \"user\", \"content\": \"Olá, Cortex!\"}],
)

print(resposta.choices[0].message.content)`;

  const continueVsCode = `# ~/.continue/config.json
{
  "models": [{
    "title": "Cortex NEXIA",
    "provider": "openai",
    "model": "cortex",
    "apiBase": "https://seu-site.cortex/cortex",
    "apiKey": "SUA_CHAVE_API"
  }]
}`;

  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased">
      <Navbar />

      <header className="border-b border-nexia-border bg-[#0a0a0f]">
        <div className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
          <div className="flex items-center gap-2 mb-4">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-nexia-muted hover:text-white transition-colors cursor-pointer">
              <div className="w-6 h-6 flex items-center justify-center rounded-md bg-nexia-cyan/20"><i className="ri-arrow-left-line text-nexia-cyan text-xs" /></div>
              Voltar ao site
            </button>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <div className="w-10 h-10 flex items-center justify-center rounded-xl bg-nexia-cyan/10 border border-nexia-cyan/20"><i className="ri-api-line text-nexia-cyan text-xl" /></div>
            <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">API Docs — Cortex</h1>
          </div>
          <p className="text-sm md:text-base text-nexia-muted max-w-lg">Três formas rápidas de chamar o Cortex: cURL, Python (OpenAI SDK) e VS Code Continue.</p>
        </div>
      </header>

      <main className="px-4 md:px-8 py-6 max-w-7xl mx-auto">
        <section className="mb-10">
          <CodeBlock
            lang="bash"
            title="1. cURL — exemplo direto"
            code={curl}
          />
          <CodeBlock
            lang="python"
            title="2. Python — OpenAI SDK com base_url no /cortex"
            code={python}
          />
          <CodeBlock
            lang="json"
            title="3. VS Code Continue — uso no editor"
            code={continueVsCode}
          />
        </section>

        <section className="text-center py-8">
          <a href="https://wa.me/5511944037259?text=Quero%20usar%20a%20API%20do%20Cortex!" target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 px-5 py-2.5 rounded-lg border border-nexia-border text-nexia-muted text-sm hover:text-white hover:border-nexia-cyan/40 transition-all whitespace-nowrap"><i className="ri-whatsapp-fill" /> Suporte via WhatsApp</a>
        </section>
      </main>

      <Footer client={{ madeWithKernexLink: MADE_WITH_KERNEX_LINK }} />
      <ThemeWidget />
    </div>
  );
}
