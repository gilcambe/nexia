const items = [
  "Claude Sonnet 4.6", "GPT-4o", "Gemini 2.5 Pro", "Grok-3 Fast", "DeepSeek V3",
  "Llama 4 Scout", "Mistral 7B", "Perplexity", "Qwen3 Coder", "Cerebras", "Groq",
  "OpenRouter", "DeepSeek R1", "Gemini Flash", "Claude Opus 4.5",
];

export default function Marquee() {
  return (
    <section className="py-8 border-y border-nexia-border overflow-hidden bg-nexia-surface/30">
      <div className="flex gap-8 animate-marquee whitespace-nowrap">
        {[...items, ...items].map((item, i) => (
          <span key={i} className="inline-flex items-center gap-2 text-sm text-nexia-muted flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-nexia-cyan/60" />
            {item}
          </span>
        ))}
      </div>
    </section>
  );
}
