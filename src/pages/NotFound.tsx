import { useLocation, useNavigate } from "react-router-dom";

export default function NotFound() {
  const location = useLocation();
  const navigate = useNavigate();

  return (
    <div className="relative flex flex-col items-center justify-center h-screen text-center px-4 bg-[#0a0a0f]">
      <h1 className="absolute bottom-0 text-9xl md:text-[12rem] font-black text-nexia-surface select-none pointer-events-none z-0">404</h1>
      <div className="relative z-10">
        <div className="w-16 h-16 flex items-center justify-center mx-auto mb-4 rounded-2xl bg-nexia-cyan/10 border border-nexia-cyan/20">
          <i className="ri-map-pin-off-line text-nexia-cyan text-2xl" />
        </div>
        <h1 className="text-xl md:text-2xl font-semibold text-white">Página não encontrada</h1>
        <p className="mt-2 text-base text-nexia-muted font-mono">{location.pathname}</p>
        <p className="mt-4 text-lg md:text-xl text-nexia-muted">Volte ao site principal e explore o NEXIA OS</p>
        <button
          onClick={() => navigate("/")}
          className="mt-6 px-5 py-2.5 rounded-lg bg-nexia-cyan text-[#0a0a0f] text-sm font-semibold hover:bg-nexia-cyan-dim transition-colors cursor-pointer"
        >
          Ir para o início
        </button>
      </div>
    </div>
  );
}
