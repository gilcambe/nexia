import { useId } from "react";

// Logo NEXIA (padrão de todos os produtos): N prateado metálico em quadrado arredondado escuro, igual à abertura e aos ícones.
// O id do degradê é único por logo: um id repetido dentro de um bloco escondido (menu do PC) apagaria o N dos outros.
export default function Logo({ tamanho = 32 }: { tamanho?: number }) {
  const id = useId();
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 104 104" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`${id}g`} x1="0" y1="0" x2="104" y2="104" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#ffffff" /><stop offset=".3" stopColor="#9aa0a6" /><stop offset=".55" stopColor="#f4f5f6" /><stop offset=".8" stopColor="#6b7078" /><stop offset="1" stopColor="#d9dce0" /></linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="104" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#1d2024" /><stop offset="1" stopColor="#050506" /></linearGradient>
      </defs>
      <rect x="2" y="2" width="100" height="100" rx="28" fill={`url(#${id}c)`} stroke={`url(#${id}g)`} strokeWidth="2.5" />
      <path d="M33 74V30l38 44V30" stroke={`url(#${id}g)`} strokeWidth="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
