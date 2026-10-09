"use client";

import { Check, Moon } from "lucide-react";
import { cn } from "@/lib/cn";
import { addRestDay, removeRestDay, setHabitLog } from "@/app/(app)/habits/actions";
import { useAction } from "@/components/tasks/use-action";

export function HabitToggle({ id, name, color, done, today, value }: { id: string; name: string; color: string; done: boolean; today: string; value: number | null }) {
  const { run, pending } = useAction();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => run(() => setHabitLog({ habit_id: id, log_date: today, status: done ? null : "done", value: done ? null : value }))}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
        done ? "border-transparent bg-success-soft" : "border-border hover:border-accent",
      )}
      aria-pressed={done}
    >
      <span
        className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-md border-2", done ? "text-white" : "")}
        style={{ borderColor: color, backgroundColor: done ? color : undefined }}
      >
        {done && <Check size={12} strokeWidth={3} />}
      </span>
      <span className={cn(done && "text-muted line-through")}>{name}</span>
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
      className="inline-flex items-center gap-1 text-xs text-muted hover:text-text"
      title="Un día de descanso no rompe tu racha"
    >
      <Moon size={12} /> {isRest ? "Quitar descanso de hoy" : "Hoy descanso"}
    </button>
  );
}
