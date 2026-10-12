"use client";

import { useState } from "react";
import { Check, Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import { addRestDay, removeRestDay, setHabitLog } from "@/app/(app)/habits/actions";
import { useAction } from "@/components/tasks/use-action";

export function HabitToggle({ id, name, color, done, today, value }: { id: string; name: string; color: string; done: boolean; today: string; value: number | null }) {
  const { run, pending } = useAction();
  // Respuesta inmediata: se marca al tocar y se deshace si el servidor falla.
  const [on, setOn] = useState(done);
  const [prevDone, setPrevDone] = useState(done);
  if (prevDone !== done) {
    setPrevDone(done);
    setOn(done);
  }
  // Cambia en cada marcado para reiniciar la animación de la casilla.
  const [bump, setBump] = useState(0);
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        const next = !on;
        setOn(next);
        if (next) setBump((b) => b + 1);
        run(async () => {
          const res = await setHabitLog({ habit_id: id, log_date: today, status: next ? "done" : null, value: next ? value : null });
          if (!res.ok) setOn(!next);
          return res;
        });
      }}
      className={cn(
        "press group relative flex w-full items-center gap-3 overflow-hidden rounded-2xl px-3 py-2.5 text-left text-sm transition-colors",
        on ? "bg-success-soft/70" : "bg-surface-2/40 hover:bg-surface-2/80",
      )}
      aria-pressed={on}
    >
      <span
        key={bump}
        className={cn(
          "grid h-6 w-6 shrink-0 place-items-center rounded-lg border-2 transition-[background-color,transform] duration-200",
          on ? "text-white" : "group-hover:scale-110",
          bump > 0 && on && "pop-in",
        )}
        style={{ borderColor: color, backgroundColor: on ? color : `color-mix(in srgb, ${color} 10%, transparent)`, boxShadow: on ? `0 4px 12px -4px ${color}` : undefined }}
      >
        {on && <Check size={14} strokeWidth={3.2} />}
      </span>
      <span className={cn("min-w-0 flex-1 truncate font-medium transition-colors", on && "text-muted line-through decoration-2")}>{name}</span>
      {on && <span className="shrink-0 text-[11px] font-semibold text-success" aria-hidden>Hecho</span>}
    </button>
  );
}

export function RestDayButton({ today, isRest }: { today: string; isRest: boolean }) {
  const { run, pending } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => (isRest ? removeRestDay(today) : addRestDay(today)))}
      className={cn(
        "press inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors disabled:opacity-50",
        isRest ? "bg-tone-soft text-tone-ink" : "bg-surface-2 text-muted hover:text-text",
      )}
      title="Un día de descanso no rompe tu racha"
    >
      <Moon size={11} aria-hidden /> {isRest ? "Quitar descanso de hoy" : "Hoy descanso"}
    </button>
  );
}
