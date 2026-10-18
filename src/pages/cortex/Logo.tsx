import { useId } from "react";

// Logo do Cortex: um C com nós de rede (neurônios) em verde e violeta sobre quadrado arredondado escuro.
// O N prateado da NEXIA aparece só na abertura de 2 segundos. O id do degradê é único por logo (useId).
export default function Logo({ tamanho = 32 }: { tamanho?: number }) {
  const id = useId();
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 512 512" fill="none" aria-hidden="true" className="shrink-0">
      <defs>
        <linearGradient id={`${id}g`} x1="80" y1="60" x2="440" y2="460" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#00d4aa" /><stop offset="1" stopColor="#7c6cf0" /></linearGradient>
        <linearGradient id={`${id}c`} x1="0" y1="0" x2="0" y2="512" gradientUnits="userSpaceOnUse"><stop offset="0" stopColor="#14161a" /><stop offset="1" stopColor="#050506" /></linearGradient>
      </defs>
      <rect x="9.8" y="9.8" width="492.3" height="492.3" rx="137.8" fill={`url(#${id}c)`} stroke={`url(#${id}g)`} strokeWidth="10" />
      <path d="M354 158A130 130 0 1 0 354 354" stroke={`url(#${id}g)`} strokeWidth="52" strokeLinecap="round" />
      <circle cx="354" cy="158" r="26" fill="#00d4aa" /><circle cx="354" cy="354" r="26" fill="#7c6cf0" /><circle cx="256" cy="256" r="30" fill={`url(#${id}g)`} />
      <path d="M256 256L354 158M256 256L354 354" stroke={`url(#${id}g)`} strokeWidth="12" strokeLinecap="round" opacity=".7" />
    </svg>
  );
}
