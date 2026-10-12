"use client";

import { useEffect, useState } from "react";

/** Devuelve Date.now() actualizado cada `ms` mientras `active` sea true. */
export function useNow(active: boolean, ms = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const sync = setTimeout(() => setNow(Date.now()), 0);
    if (!active) return () => clearTimeout(sync);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(sync);
      clearInterval(id);
    };
  }, [active, ms]);
  return now;
}

/**
 * Hora actual solo en el navegador: null en el servidor y en la primera pintura, así lo que depende
 * de la hora (p. ej. "termina a las 10:55") no provoca desajustes de hidratación.
 */
export function useClientNow(ms = 15_000): number | null {
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const sync = setTimeout(() => setNow(Date.now()), 0);
    const id = setInterval(() => setNow(Date.now()), ms);
    return () => {
      clearTimeout(sync);
      clearInterval(id);
    };
  }, [ms]);
  return now;
}
