"use client";

import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/cn";

// Ángulos del destello al completar un paso.
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315];

/**
 * Paso del itinerario del plan: número, línea que lo une con el siguiente y contenido.
 * Al marcar la tarea se tacha y lanza un pequeño destello mientras el plan se recalcula en el servidor
 * (con "reducir movimiento" solo cambia el color).
 */
export function PlanStep({ index, first, children }: { index: number; first: boolean; children: React.ReactNode }) {
  const [done, setDone] = useState(false);
  return (
    <li
      data-done={done ? "" : undefined}
      className="group/step relative pl-12 sm:pl-14"
      onClick={(e) => {
        const box = (e.target as Element).closest('[role="checkbox"]');
        if (!box) return;
        // TaskCheckbox cambia su estado en este mismo clic: se lee en el siguiente fotograma.
        requestAnimationFrame(() => setDone(box.getAttribute("aria-checked") === "true"));
      }}
    >
      {/* Línea hasta el siguiente paso */}
      <span
        aria-hidden
        className={cn(
          "absolute bottom-[-14px] left-[17px] w-0.5 rounded-full bg-gradient-to-b from-tone/60 to-tone/15 transition-colors duration-500",
          first ? "top-12" : "top-11",
          "group-data-[done]/step:from-success/70",
        )}
      />
      <span
        aria-hidden
        className={cn(
          "absolute left-0 grid h-9 w-9 place-items-center rounded-full font-display text-sm font-bold tabular transition-[transform,background-color,color] duration-500",
          first ? "tone-chip top-4 sm:top-5" : "tone-chip-soft top-2.5",
          done && "scale-110 !bg-none !bg-success !text-white",
        )}
      >
        {first && !done && <span className="absolute inset-0 rounded-full animate-[pulse-dot_2s_ease-out_infinite]" />}
        {done ? <Check size={16} strokeWidth={3} /> : index + 1}
        {done && (
          <span className="pointer-events-none absolute inset-0 grid scale-[0.3] place-items-center">
            {SPARKS.map((a) => (
              <span
                key={a}
                className="celebrate-spark absolute h-7 w-2 rounded-full bg-success"
                style={{ "--a": `${a}deg` } as React.CSSProperties}
              />
            ))}
          </span>
        )}
      </span>
      <div className={cn("transition-opacity duration-500", done && "opacity-75")}>{children}</div>
    </li>
  );
}
