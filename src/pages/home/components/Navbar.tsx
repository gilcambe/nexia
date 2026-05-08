import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTranslation } from "react-i18next";

export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const { user, logout } = useAuth();
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const navLinks = [
    { label: "Sentinel", to: "/sentinel", icon: "ri-shield-keyhole-line" },
    { label: "Pipeline", to: "/pipeline", icon: "ri-node-tree" },
    { label: "CORTEX", to: "/cortex-app", icon: "ri-brain-line" },
    { label: "Código", to: "/codigo", icon: "ri-code-box-line" },
    { label: "Docs", to: "/docs", icon: "ri-book-open-line" },
  ];

  return (
    <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-[#0a0a0f]/95 backdrop-blur-md border-b border-nexia-border" : "bg-transparent"}`}>
      <div className="px-4 md:px-8 py-4 max-w-7xl mx-auto flex items-center justify-between">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-2.5 flex-shrink-0">
          <div className="w-8 h-8 flex items-center justify-center rounded-lg bg-nexia-cyan/20 border border-nexia-cyan/30">
            <i className="ri-brain-fill text-nexia-cyan text-lg" />
          </div>
          <span className="font-bold text-white text-base tracking-tight">NEXIA<span className="text-nexia-cyan">OS</span></span>
        </Link>

        {/* Desktop nav */}
        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-nexia-muted hover:text-white rounded-lg hover:bg-white/5 transition-all">
              <i className={`${l.icon} text-xs`} />{l.label}
            </Link>
          ))}
        </nav>

        {/* Right side */}
        <div className="hidden md:flex items-center gap-3">
          <div className="flex items-center gap-1">
            {["pt", "en", "es"].map((lng) => (
              <button key={lng} onClick={() => i18n.changeLanguage(lng)}
                className={`px-2 py-1 text-xs rounded transition-colors cursor-pointer ${i18n.language === lng ? "text-nexia-cyan bg-nexia-cyan/10" : "text-nexia-muted hover:text-white"}`}>
                {lng.toUpperCase()}
              </button>
            ))}
          </div>
          {user ? (
            <div className="flex items-center gap-2">
              <span className="text-xs text-nexia-muted">{user.email}</span>
              <button onClick={() => logout()} className="px-3 py-1.5 text-xs text-nexia-muted border border-nexia-border rounded-lg hover:text-white hover:border-nexia-cyan/40 transition-colors cursor-pointer">
                {t("nav.logout")}
              </button>
            </div>
          ) : (
            <button onClick={() => navigate("/login")} className="px-4 py-1.5 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg hover:bg-nexia-cyan-dim transition-colors cursor-pointer">
              {t("nav.login")}
            </button>
          )}
        </div>

        {/* Mobile menu toggle */}
        <button onClick={() => setMenuOpen(!menuOpen)} className="md:hidden p-2 text-nexia-muted hover:text-white transition-colors cursor-pointer" aria-label="Menu">
          <i className={menuOpen ? "ri-close-line text-xl" : "ri-menu-line text-xl"} />
        </button>
      </div>

      {/* Mobile menu */}
      {menuOpen && (
        <div className="md:hidden border-t border-nexia-border bg-[#0a0a0f]/98 px-4 py-4 flex flex-col gap-2">
          {navLinks.map((l) => (
            <Link key={l.to} to={l.to} onClick={() => setMenuOpen(false)} className="flex items-center gap-2 px-3 py-2.5 text-sm text-nexia-muted hover:text-white rounded-lg hover:bg-white/5 transition-all">
              <i className={l.icon} />{l.label}
            </Link>
          ))}
          <div className="border-t border-nexia-border mt-2 pt-3">
            {user ? (
              <button onClick={() => { logout(); setMenuOpen(false); }} className="w-full px-3 py-2 text-sm text-nexia-muted border border-nexia-border rounded-lg cursor-pointer">
                Sair
              </button>
            ) : (
              <button onClick={() => { navigate("/login"); setMenuOpen(false); }} className="w-full px-3 py-2 text-sm font-medium bg-nexia-cyan text-[#0a0a0f] rounded-lg cursor-pointer">
                Entrar
              </button>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
