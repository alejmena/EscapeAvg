"use client";

import { useEffect } from "react";

/**
 * Microinteracciones globales con un solo listener para toda la app: en las tarjetas `.spotlight` la luz
 * sigue al cursor (--mx / --my). La aparición al hacer scroll (`data-reveal`) es solo CSS (globals.css).
 */
export function Interactions() {
  useEffect(() => {
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

  return null;
}
