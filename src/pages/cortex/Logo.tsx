import { useId } from "react";

// Logo NEXIA: um N em degradê verde-água para violeta, dentro de um quadrado arredondado.
// O id do degradê é único por logo: um id repetido dentro de um bloco escondido (menu do PC) apagaria o N dos outros.
export default function Logo({ tamanho = 32 }: { tamanho?: number }) {
  const id = useId();
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 512 512" aria-hidden="true" className="shrink-0">
      <defs><linearGradient id={id} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#00d4aa" /><stop offset="1" stopColor="#6c5ce7" /></linearGradient></defs>
      <rect width="512" height="512" rx="112" fill="#0b0b10" stroke="#2a2a35" strokeWidth="8" />
      <path d="M148 372V140h44l128 156V140h44v232h-44L192 216v156z" fill={`url(#${id})`} />
    </svg>
  );
}
