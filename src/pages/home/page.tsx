import Navbar from "./components/Navbar";
import Hero from "./components/Hero";
import Marquee from "./components/Marquee";
import Orchestrator from "./components/Orchestrator";
import Features from "./components/Features";
import CortexTerminal from "./components/CortexTerminal";
import Agents from "./components/Agents";
import Assistant from "./components/Assistant";
import Contact from "./components/Contact";
import Footer from "./components/Footer";
import ThemeWidget from "./components/ThemeWidget";

export default function Home() {
  return (
    <div className="min-h-screen bg-[#0a0a0f] text-white font-display antialiased selection:bg-nexia-cyan/20 selection:text-nexia-cyan">
      <Navbar />
      <main>
        <Hero />
        <Marquee />
        <Orchestrator />
        <Features />
        <CortexTerminal />
        <Agents />
        <Assistant />
        <Contact />
      </main>
      <Footer />
      <ThemeWidget />
    </div>
  );
}
