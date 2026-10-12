"use client";

import { useEffect, useRef, useState } from "react";

/**
 * `true` en cuanto el elemento entra en pantalla (una sola vez). Sirve para que las gráficas se
 * "dibujen" cuando el usuario llega a ellas. Con "reducir movimiento" las transiciones globales
 * duran 0 ms, así que todo aparece sin animación.
 */
export function useInView<T extends Element>() {
  const ref = useRef<T>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setSeen(true);
          io.disconnect();
        }
      },
      { rootMargin: "0px 0px -6% 0px", threshold: 0.1 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, seen] as const;
}
