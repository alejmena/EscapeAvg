"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

/**
 * Microinteracciones globales, con un solo listener para toda la app:
 * - `.spotlight`: la luz de la tarjeta sigue al cursor (--mx / --my).
 * - `[data-reveal]`: el bloque aparece al entrar en pantalla (añade data-revealed).
 * Sin JavaScript o con "reducir movimiento" todo se ve igual, solo sin animación.
 */
export function Interactions() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("fx-ready");

    let frame = 0;
    let last: { el: HTMLElement; x: number; y: number } | null = null;
    const onMove = (e: PointerEvent) => {
      if (e.pointerType !== "mouse") return;
      const el = (e.target as Element | null)?.closest<HTMLElement>(".spotlight");
      if (!el) return;
      const r = el.getBoundingClientRect();
      last = { el, x: e.clientX - r.left, y: e.clientY - r.top };
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        if (!last) return;
        last.el.style.setProperty("--mx", `${last.x}px`);
        last.el.style.setProperty("--my", `${last.y}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(frame);
    };
  }, []);

  // Las páginas nuevas traen bloques nuevos: se vuelven a observar en cada navegación.
  useEffect(() => {
    const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const reveal = (el: Element) => el.setAttribute("data-revealed", "");
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const el = entry.target as HTMLElement;
          const delay = Number(el.dataset.reveal) || 0;
          if (delay) el.style.transitionDelay = `${delay}ms`;
          reveal(el);
          io.unobserve(el);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    const scan = () => {
      document.querySelectorAll("[data-reveal]:not([data-revealed])").forEach((el) => (reduce ? reveal(el) : io.observe(el)));
    };
    scan();
    // Contenido que llega después (listas que crecen, modales): se observa también.
    const mo = new MutationObserver(scan);
    mo.observe(document.body, { childList: true, subtree: true });
    return () => {
      io.disconnect();
      mo.disconnect();
    };
  }, [pathname]);

  return null;
}
