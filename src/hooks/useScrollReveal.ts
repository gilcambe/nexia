import { createElement, useEffect, useState, type ReactNode } from "react";

export interface ScrollRevealProps {
  children: ReactNode;
  className?: string;
  delay?: number;
  direction?: "up" | "down" | "left" | "right";
  duration?: number;
  threshold?: number;
}

export function ScrollReveal(props: ScrollRevealProps) {
  const { children, className = "", delay = 0, direction = "up", duration = 700, threshold = 0.15 } = props;
  const [uniqueClass] = useState(() => "sr-" + Math.random().toString(36).slice(2, 9));
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = document.querySelector("." + uniqueClass);
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setVisible(true); observer.unobserve(el); } },
      { threshold, rootMargin: "0px 0px -40px 0px" }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [uniqueClass, threshold]);

  const tClass =
    direction === "up" ? "translate-y-6" :
    direction === "down" ? "-translate-y-6" :
    direction === "left" ? "translate-x-6" : "-translate-x-6";
  const vClass = visible ? "!translate-x-0 !translate-y-0 !opacity-100" : "";
  const cn = `${className} ${tClass} opacity-0 transition-all ${vClass} ${uniqueClass}`;

  return createElement("div", {
    className: cn,
    style: { transitionDuration: duration + "ms", transitionDelay: delay + "ms" },
  }, children);
}
