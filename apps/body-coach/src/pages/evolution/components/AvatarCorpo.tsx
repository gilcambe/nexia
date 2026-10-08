import React, { useState } from "react";

export type FrontMuscleGroup =
  | "peito"
  | "ombros"
  | "biceps"
  | "triceps"
  | "abdomen"
  | "quadriceps"
  | "panturrilha";

export type BackMuscleGroup =
  | "trapezio"
  | "costas"
  | "deltoide_posterior"
  | "triceps"
  | "gluteos"
  | "posterior"
  | "panturrilha";

export type MuscleGroup = FrontMuscleGroup | BackMuscleGroup;

export type Volume = Record<string, number>;

interface AvatarCorpoProps {
  volume: Volume;
  largura?: number;
  altura?: number;
  viewMode?: "split" | "front" | "back";
}

const MuscleLabels: Record<MuscleGroup, string> = {
  peito: "Peitoral",
  ombros: "Ombros (Anterior/Lateral)",
  biceps: "Bíceps",
  triceps: "Tríceps",
  abdomen: "Abdômen",
  quadriceps: "Quadríceps",
  panturrilha: "Panturrilhas",
  trapezio: "Trapézio",
  costas: "Dorsais / Romboides",
  deltoide_posterior: "Deltoide Posterior",
  gluteos: "Glúteos",
  posterior: "Posterior de Coxa",
};

const MuscleColors: Record<MuscleGroup, string> = {
  peito: "#f43f5e",
  ombros: "#fb923c",
  biceps: "#38bdf8",
  triceps: "#2dd4bf",
  abdomen: "#34d399",
  quadriceps: "#a855f7",
  panturrilha: "#ec4899",
  trapezio: "#6366f1",
  costas: "#3b82f6",
  deltoide_posterior: "#8b5cf6",
  gluteos: "#14b8a6",
  posterior: "#06b6d4",
};

export const AvatarCorpo: React.FC<AvatarCorpoProps> = ({
  volume,
  largura = 700,
  altura = 460,
  viewMode = "split",
}) => {
  const [activeTab, setActiveTab] = useState<"split" | "front" | "back">(viewMode);
  const [hoveredMuscle, setHoveredMuscle] = useState<MuscleGroup | null>(null);

  const getVol = (group: string) => volume[group] || 0;

  // Função para calcular escala baseada no volume (ex: 0 séries = escala 1.0, 20 séries = 1.15)
  const getScaleTransform = (group: string, cx: number, cy: number) => {
    const v = getVol(group);
    const scale = 1 + Math.min(v * 0.008, 0.2);
    return `scale(${scale}) translate(${cx * (1 - scale)}, ${cy * (1 - scale)})`;
  };

  const getOpacity = (group: string) => {
    const v = getVol(group);
    if (v === 0) return 0.35;
    return Math.min(0.5 + v * 0.025, 1);
  };

  return (
    <div className="flex flex-col items-center select-none w-full">
      {/* Seletor de Visão se necessário */}
      <div className="flex gap-2 mb-4 bg-slate-800 p-1 rounded-xl text-xs font-medium text-slate-300">
        <button
          onClick={() => setActiveTab("split")}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === "split" ? "bg-indigo-600 text-white shadow" : "hover:text-white"
          }`}
        >
          Frente e Costas (Lado a Lado)
        </button>
        <button
          onClick={() => setActiveTab("front")}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === "front" ? "bg-indigo-600 text-white shadow" : "hover:text-white"
          }`}
        >
          Apenas Frente
        </button>
        <button
          onClick={() => setActiveTab("back")}
          className={`px-3 py-1.5 rounded-lg transition-all ${
            activeTab === "back" ? "bg-indigo-600 text-white shadow" : "hover:text-white"
          }`}
        >
          Apenas Costas
        </button>
      </div>

      <div className="relative bg-slate-900/80 border border-slate-800 rounded-2xl p-4 shadow-xl backdrop-blur flex flex-col md:flex-row items-center justify-center gap-8">
        <svg
          width={largura}
          height={altura}
          viewBox={activeTab === "split" ? "0 0 600 400" : "0 0 300 400"}
          className="overflow-visible"
          role="img"
          aria-label="Anatomia muscular interativa por volume de treino"
        >
          <defs>
            <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          {/* ================= VISTA DE FRENTE ================= */}
          {(activeTab === "split" || activeTab === "front") && (
            <g transform={activeTab === "split" ? "translate(0, 0)" : "translate(75, 0)"}>
              {/* Silhueta Base Frente */}
              <g className="text-slate-800" fill="currentColor" opacity="0.3">
                <ellipse cx="100" cy="45" rx="22" ry="26" /> {/* Cabeça */}
                <path d="M78 72 C78 70, 122 70, 122 72 L125 90 C125 90, 110 95, 100 95 C90 95, 75 90, 75 90 Z" /> {/* Pescoço/Trapézio */}
                {/* Tronco & Braços & Pernas silhueta */}
                <path d="M72 95 L55 180 L70 185 L82 120 L85 200 L68 310 L88 315 L100 230 L112 315 L132 310 L115 200 L118 120 L130 185 L145 180 L128 95 Z" />
              </g>

              {/* GRUPOS MUSCULARES DA FRENTE */}

              {/* Ombros (Anterior / Lateral) */}
              <g
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredMuscle("ombros")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M72 95 Q52 100 56 125 Q70 120 78 110 Z"
                  fill={MuscleColors.ombros}
                  opacity={getOpacity("ombros")}
                  filter={hoveredMuscle === "ombros" ? "url(#glow)" : undefined}
                />
                <path
                  d="M128 95 Q148 100 144 125 Q130 120 122 110 Z"
                  fill={MuscleColors.ombros}
                  opacity={getOpacity("ombros")}
                  filter={hoveredMuscle === "ombros" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Peitoral */}
              <g
                className="cursor-pointer transition-transform"
                onMouseEnter={() => setHoveredMuscle("peito")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M80 102 Q100 105 100 130 Q85 130 78 115 Z"
                  fill={MuscleColors.peito}
                  opacity={getOpacity("peito")}
                  filter={hoveredMuscle === "peito" ? "url(#glow)" : undefined}
                />
                <path
                  d="M120 102 Q100 105 100 130 Q115 130 122 115 Z"
                  fill={MuscleColors.peito}
                  opacity={getOpacity("peito")}
                  filter={hoveredMuscle === "peito" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Bíceps */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("biceps")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M58 130 Q50 155 58 175 Q68 165 65 135 Z"
                  fill={MuscleColors.biceps}
                  opacity={getOpacity("biceps")}
                  filter={hoveredMuscle === "biceps" ? "url(#glow)" : undefined}
                />
                <path
                  d="M142 130 Q150 155 142 175 Q132 165 135 135 Z"
                  fill={MuscleColors.biceps}
                  opacity={getOpacity("biceps")}
                  filter={hoveredMuscle === "biceps" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Abdômen */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("abdomen")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M87 135 Q100 138 113 135 Q111 175 100 180 Q89 175 87 135 Z"
                  fill={MuscleColors.abdomen}
                  opacity={getOpacity("abdomen")}
                  filter={hoveredMuscle === "abdomen" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Quadríceps */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("quadriceps")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M74 205 Q98 210 97 265 Q83 265 72 215 Z"
                  fill={MuscleColors.quadriceps}
                  opacity={getOpacity("quadriceps")}
                  filter={hoveredMuscle === "quadriceps" ? "url(#glow)" : undefined}
                />
                <path
                  d="M126 205 Q102 210 103 265 Q117 265 128 215 Z"
                  fill={MuscleColors.quadriceps}
                  opacity={getOpacity("quadriceps")}
                  filter={hoveredMuscle === "quadriceps" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Panturrilhas (Frente/Lateral) */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("panturrilha")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M74 280 Q85 285 83 330 Q74 330 72 290 Z"
                  fill={MuscleColors.panturrilha}
                  opacity={getOpacity("panturrilha")}
                  filter={hoveredMuscle === "panturrilha" ? "url(#glow)" : undefined}
                />
                <path
                  d="M126 280 Q115 285 117 330 Q126 330 128 290 Z"
                  fill={MuscleColors.panturrilha}
                  opacity={getOpacity("panturrilha")}
                  filter={hoveredMuscle === "panturrilha" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Rótulo da Vista */}
              <text x="100" y="380" textAnchor="middle" className="text-xs font-semibold fill-slate-400">
                FRENTE
              </text>
            </g>
          )}

          {/* ================= VISTA DE COSTAS ================= */}
          {(activeTab === "split" || activeTab === "back") && (
            <g transform={activeTab === "split" ? "translate(300, 0)" : "translate(75, 0)"}>
              {/* Silhueta Base Costas */}
              <g className="text-slate-800" fill="currentColor" opacity="0.3">
                <ellipse cx="100" cy="45" rx="22" ry="26" /> {/* Cabeça */}
                <path d="M78 72 C78 70, 122 70, 122 72 L125 90 C125 90, 110 95, 100 95 C90 95, 75 90, 75 90 Z" /> {/* Pescoço */}
                <path d="M72 95 L55 180 L70 185 L82 120 L85 200 L68 310 L88 315 L100 230 L112 315 L132 310 L115 200 L118 120 L130 185 L145 180 L128 95 Z" />
              </g>

              {/* GRUPOS MUSCULARES DE COSTAS */}

              {/* Trapézio */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("trapezio")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M100 88 Q118 105 100 135 Q82 105 100 88 Z"
                  fill={MuscleColors.trapezio}
                  opacity={getOpacity("trapezio")}
                  filter={hoveredMuscle === "trapezio" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Deltoide Posterior */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("deltoide_posterior")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M72 98 Q52 102 55 125 Q68 120 78 112 Z"
                  fill={MuscleColors.deltoide_posterior}
                  opacity={getOpacity("deltoide_posterior")}
                  filter={hoveredMuscle === "deltoide_posterior" ? "url(#glow)" : undefined}
                />
                <path
                  d="M128 98 Q148 102 145 125 Q132 120 122 112 Z"
                  fill={MuscleColors.deltoide_posterior}
                  opacity={getOpacity("deltoide_posterior")}
                  filter={hoveredMuscle === "deltoide_posterior" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Dorsais (Costas / Lats em V) */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("costas")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M84 135 Q100 140 116 135 Q125 180 100 195 Q75 180 84 135 Z"
                  fill={MuscleColors.costas}
                  opacity={getOpacity("costas")}
                  filter={hoveredMuscle === "costas" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Tríceps */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("triceps")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M58 130 Q50 155 58 175 Q68 165 65 135 Z"
                  fill={MuscleColors.triceps}
                  opacity={getOpacity("triceps")}
                  filter={hoveredMuscle === "triceps" ? "url(#glow)" : undefined}
                />
                <path
                  d="M142 130 Q150 155 142 175 Q132 165 135 135 Z"
                  fill={MuscleColors.triceps}
                  opacity={getOpacity("triceps")}
                  filter={hoveredMuscle === "triceps" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Glúteos */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("gluteos")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M83 198 Q100 205 117 198 Q122 235 100 240 Q78 235 83 198 Z"
                  fill={MuscleColors.gluteos}
                  opacity={getOpacity("gluteos")}
                  filter={hoveredMuscle === "gluteos" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Posterior de Coxa */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("posterior")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M77 245 Q97 250 95 305 Q81 305 74 250 Z"
                  fill={MuscleColors.posterior}
                  opacity={getOpacity("posterior")}
                  filter={hoveredMuscle === "posterior" ? "url(#glow)" : undefined}
                />
                <path
                  d="M123 245 Q103 250 105 305 Q119 305 126 250 Z"
                  fill={MuscleColors.posterior}
                  opacity={getOpacity("posterior")}
                  filter={hoveredMuscle === "posterior" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Panturrilha (Costas) */}
              <g
                className="cursor-pointer"
                onMouseEnter={() => setHoveredMuscle("panturrilha")}
                onMouseLeave={() => setHoveredMuscle(null)}
              >
                <path
                  d="M74 312 Q90 318 87 355 Q76 355 72 320 Z"
                  fill={MuscleColors.panturrilha}
                  opacity={getOpacity("panturrilha")}
                  filter={hoveredMuscle === "panturrilha" ? "url(#glow)" : undefined}
                />
                <path
                  d="M126 312 Q110 318 113 355 Q124 355 128 320 Z"
                  fill={MuscleColors.panturrilha}
                  opacity={getOpacity("panturrilha")}
                  filter={hoveredMuscle === "panturrilha" ? "url(#glow)" : undefined}
                />
              </g>

              {/* Rótulo da Vista */}
              <text x="100" y="380" textAnchor="middle" className="text-xs font-semibold fill-slate-400">
                COSTAS
              </text>
            </g>
          )}
        </svg>

        {/* Legenda Lateral / Tooltip Dinâmico */}
        <div className="flex flex-col gap-3 min-w-[220px] max-w-[260px] text-left">
          <div className="bg-slate-800/90 border border-slate-700/60 p-3.5 rounded-xl shadow">
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">
              Detalhe Muscular
            </h4>
            {hoveredMuscle ? (
              <div>
                <div className="text-sm font-bold text-white flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full inline-block shadow-sm"
                    style={{ backgroundColor: MuscleColors[hoveredMuscle] }}
                  />
                  {MuscleLabels[hoveredMuscle]}
                </div>
                <p className="text-xs text-slate-300 mt-1">
                  Volume semanal: <strong className="text-indigo-400">{getVol(hoveredMuscle)} séries</strong>
                </p>
              </div>
            ) : (
              <p className="text-xs text-slate-400 italic">
                Passe o cursor sobre qualquer grupo muscular para inspecionar o volume.
              </p>
            )}
          </div>

          <div className="bg-slate-800/50 border border-slate-700/40 p-3 rounded-xl text-xs space-y-1.5 text-slate-300">
            <div className="font-semibold text-slate-200 mb-1">Legenda de Cores & Séries</div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-slate-600 opacity-50" /> 0 séries (Baixo)
              </span>
              <span className="text-slate-400">0-5</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-indigo-500" /> Moderado
              </span>
              <span className="text-slate-400">6-15</span>
            </div>
            <div className="flex justify-between items-center text-[11px]">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Alto Volume
              </span>
              <span className="text-slate-400">16+</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};


// Exemplos de uso:
// <AvatarCorpo volume={{ peito: 15, ombros: 10, biceps: 8, triceps: 7, abdomen: 12, costas: 9, gluteos: 11, quadriceps: 14, posterior: 6, panturrilha: 5 }} />
// <AvatarCorpo volume={{ peito: 5, ombros: 3, biceps: 2, triceps: 2, abdomen: 4, costas: 3, gluteos: 3, quadriceps: 5, posterior: 2, panturrilha: 2 }} largura={600} altura={400} />
