"use client";

import { createContext, useContext, useState } from "react";
import { cn } from "@/lib/cn";

const PendingContext = createContext<(pending: boolean) => void>(() => {});

/**
 * Mientras se cargan los datos de otro rango, el contenido se queda donde está pero atenuado
 * (sin esqueletos ni saltos): así se nota que algo pasa y las cifras no "parpadean".
 */
export function StatsPendingProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState(false);
  return (
    <PendingContext value={setPending}>
      <div className={cn("transition-[opacity,filter] duration-300", pending && "pointer-events-none opacity-55 saturate-50")} aria-busy={pending || undefined}>
        {children}
      </div>
    </PendingContext>
  );
}

export function useStatsPending() {
  return useContext(PendingContext);
}
