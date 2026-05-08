import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

export default function ThemeWidget() {
  const [open, setOpen] = useState(false);
  const { i18n } = useTranslation();
  const navigate = useNavigate();

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-2">
      {open && (
        <div className="rounded-xl bg-nexia-surface border border-nexia-border p-4 w-52 shadow-lg">
          <p className="text-xs text-nexia-muted mb-3 font-medium">Idioma</p>
          <div className="flex gap-2 mb-4">
            {["pt", "en", "es"].map((lng) => (
              <button key={lng} onClick={() => i18n.changeLanguage(lng)}
                className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors cursor-pointer ${i18n.language === lng ? "bg-nexia-cyan text-[#0a0a0f] border-nexia-cyan" : "border-nexia-border text-nexia-muted hover:text-white"}`}>
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="border-t border-nexia-border pt-3 space-y-1">
            <button onClick={() => { navigate("/cortex-app"); setOpen(false); }} className="w-full text-left text-xs text-nexia-muted hover:text-white px-2 py-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2">
              <i className="ri-brain-line" /> CORTEX v16
            </button>
            <button onClick={() => { navigate("/sentinel"); setOpen(false); }} className="w-full text-left text-xs text-nexia-muted hover:text-white px-2 py-1.5 rounded hover:bg-white/5 transition-colors cursor-pointer flex items-center gap-2">
              <i className="ri-shield-keyhole-line" /> Sentinel QA
            </button>
          </div>
        </div>
      )}
      <button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 flex items-center justify-center rounded-full bg-nexia-cyan text-[#0a0a0f] hover:bg-nexia-cyan-dim transition-colors cursor-pointer shadow-lg"
        aria-label="Configurações"
      >
        <i className={open ? "ri-close-line text-xl" : "ri-settings-3-line text-xl"} />
      </button>
    </div>
  );
}
