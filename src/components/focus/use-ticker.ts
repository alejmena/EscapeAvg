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
