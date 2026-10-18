import { useId } from "react";

// Logo do Cortex (cada produto tem a sua inicial): C prateado metálico com um ponto verde em quadrado arredondado escuro, igual à abertura e aos ícones.
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
      <path d="M69.2 34.8A24.4 24.4 0 1 0 69.2 69.2" stroke={`url(#${id}g)`} strokeWidth="9.3" strokeLinecap="round" fill="none" />
      <circle cx="71.5" cy="52" r="4.9" fill="#00d4aa" />
    </svg>
  );
}
