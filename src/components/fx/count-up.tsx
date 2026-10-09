"use client";

import { useEffect, useRef, useState } from "react";
import { formatDuration } from "@/lib/domain/stats";

/**
 * Número que "cuenta" hasta su valor al aparecer en pantalla. El HTML del servidor ya trae el valor
 * final (accesible y sin JavaScript); la animación solo se reproduce una vez en el navegador.
 */
export function CountUp({
  value,
  duration = 1100,
  kind = "int",
  suffix = "",
  className,
}: {
  value: number;
  duration?: number;
  /** "duration": el valor son segundos y se muestra como "2 h 39 min". */
  kind?: "int" | "duration";
  suffix?: string;
  className?: string;
}) {
  const format = (n: number) => (kind === "duration" ? formatDuration(n) : `${Math.round(n)}${suffix}`);
  const [shown, setShown] = useState(value);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches || value === 0) return;
    let raf = 0;
    const run = () => {
      const start = performance.now();
      const tick = (t: number) => {
        const p = Math.min(1, (t - start) / duration);
        setShown(value * (1 - Math.pow(1 - p, 4)));
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      setShown(0);
      raf = requestAnimationFrame(tick);
    };
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        io.disconnect();
        run();
      }
    });
    io.observe(el);
    return () => {
      io.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [value, duration]);
  // Durante la animación la duración se redondea a minutos enteros, igual que el valor final.

  return (
    <span ref={ref} className={className}>
      {format(shown)}
    </span>
  );
}
