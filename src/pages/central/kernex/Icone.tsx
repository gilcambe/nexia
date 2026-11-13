// Ícones da Central nova (traço, 24x24), sem biblioteca externa.
const P: Record<string, string> = {
  casa: "M3 11l9-8 9 8M5 10v10h5v-6h4v6h5V10",
  pasta: "M3 6a2 2 0 012-2h4l2 2h8a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  pc: "M3 4h18v12H3zM8 20h8M12 16v4",
  ia: "M9 3a3 3 0 00-3 3 3 3 0 00-3 3 3 3 0 001 2.2A3 3 0 006 16a3 3 0 003 3 3 3 0 003-1V4a3 3 0 00-3-1zM15 3a3 3 0 013 3 3 3 0 013 3 3 3 0 01-1 2.2A3 3 0 0118 16a3 3 0 01-3 3 3 3 0 01-3-1",
  lista: "M9 6h12M9 12h12M9 18h12M4 6l1 1 2-2M4 12l1 1 2-2M4 18l1 1 2-2",
  arquivo: "M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9zM14 3v6h6M8 13h8M8 17h6",
  foguete: "M5 15c-1.5 1.5-2 5-2 5s3.5-.5 5-2M9 15l-3-3c1-4 4-8 10-9 0 6-4 9-8 10zM14 7.5a1.5 1.5 0 100 .01",
  cadeado: "M5 11h14v10H5zM8 11V7a4 4 0 018 0v4M12 15v2",
  grafico: "M4 20V10M10 20V4M16 20v-7M22 20H2",
  engrenagem: "M12 15a3 3 0 100-6 3 3 0 000 6zM19.4 15a1.7 1.7 0 00.3 1.8l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.8-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1a1.7 1.7 0 00-1.1-1.5 1.7 1.7 0 00-1.8.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.8 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1a1.7 1.7 0 001.5-1.1 1.7 1.7 0 00-.3-1.8l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.8.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.8-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.8V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z",
  busca: "M11 18a7 7 0 100-14 7 7 0 000 14zM21 21l-5-5",
  sino: "M18 8a6 6 0 00-12 0c0 7-3 9-3 9h18s-3-2-3-9M13.7 21a2 2 0 01-3.4 0",
  raio: "M13 2L3 14h9l-1 8 10-12h-9z",
  check: "M20 6L9 17l-5-5",
  alerta: "M12 9v4M12 17h.01M10.3 3.9L1.8 18a2 2 0 001.7 3h17a2 2 0 001.7-3L13.7 3.9a2 2 0 00-3.4 0z",
  relogio: "M12 22a10 10 0 100-20 10 10 0 000 20zM12 6v6l4 2",
  play: "M6 4l14 8-14 8z",
  pausa: "M7 4h3v16H7zM14 4h3v16h-3z",
  refazer: "M3 12a9 9 0 0115-6.7L21 8M21 3v5h-5M21 12a9 9 0 01-15 6.7L3 16M3 21v-5h5",
  troca: "M17 3l4 4-4 4M3 7h18M7 21l-4-4 4-4M21 17H3",
  enviar: "M22 2L11 13M22 2l-7 20-4-9-9-4z",
  menu: "M3 6h18M3 12h18M3 18h18",
  x: "M18 6L6 18M6 6l12 12",
  seta: "M5 12h14M13 6l6 6-6 6",
  servidor: "M3 4h18v6H3zM3 14h18v6H3zM7 7h.01M7 17h.01",
};

export default function Icone({ nome, tam = 20, cor = "currentColor" }: { nome: string; tam?: number; cor?: string }) {
  return (
    <svg width={tam} height={tam} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable="false">
      <path d={P[nome] || P.casa} />
    </svg>
  );
}

export function LogoK({ tam = 40 }: { tam?: number }) {
  // C2-E (13/11, dono: "a KERNEX já tem uma identidade visual que deve ser fixa"): o símbolo oficial (hexágono) de brand/kernex/simbolo.svg.
  return <img src="/central/logos/kernex.svg" width={tam} height={tam} alt="" aria-hidden style={{ display: "block", flexShrink: 0 }} />;
}
