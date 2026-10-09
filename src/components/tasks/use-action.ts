"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ActionResult } from "@/lib/types";

/**
 * Ejecuta Server Actions con estado de carga y error.
 * No usa useTransition a propósito: si el componente se desmonta durante la acción (p. ej. al cerrar
 * un modal), una transición pendiente puede quedar enlazada a las siguientes y bloquear la UI.
 */
export function useAction() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const run = useCallback(async <T,>(fn: () => Promise<ActionResult<T>>, onOk?: (data: T | undefined) => void) => {
    setError(null);
    setPending(true);
    try {
      const res = await fn();
      if (res.ok) onOk?.(res.data);
      else if (mounted.current) setError(res.error);
    } catch {
      if (mounted.current) setError("Sin conexión con el servidor. Inténtalo de nuevo.");
    } finally {
      if (mounted.current) setPending(false);
    }
  }, []);
  return { pending, error, setError, run };
}
