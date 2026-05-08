import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        nexia: {
          bg: "#0a0a0f",
          surface: "#111118",
          surface2: "#1a1a24",
          border: "#2a2a35",
          cyan: "#00d4aa",
          "cyan-dim": "#00a884",
          accent: "#10b981",
          text: "#e5e7eb",
          muted: "#9ca3af",
        },
      },
      fontFamily: { display: ["Inter", "system-ui", "sans-serif"] },
      animation: {
        marquee: "marquee 30s linear infinite",
        "marquee-reverse": "marquee-reverse 30s linear infinite",
        "pulse-slow": "pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        float: "float 6s ease-in-out infinite",
      },
      keyframes: {
        marquee: { "0%": { transform: "translateX(0%)" }, "100%": { transform: "translateX(-50%)" } },
        "marquee-reverse": { "0%": { transform: "translateX(-50%)" }, "100%": { transform: "translateX(0%)" } },
        float: { "0%, 100%": { transform: "translateY(0px)" }, "50%": { transform: "translateY(-12px)" } },
      },
    },
  },
  plugins: [],
};

export default config;
