"use client";

import { useState } from "react";
import { Copy, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { WEEKDAY_NAME } from "@/lib/format";
import { WEEK_ORDER } from "@/lib/domain/schedule";
import { addScheduleBlocks, type SlotInput } from "@/app/(app)/schedule/actions";
import { useAction } from "@/components/tasks/use-action";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input } from "@/components/ui/form";

export const BLOCK_COLORS = ["#5b4bf5", "#0ab3ff", "#2fc75c", "#f59e0b", "#ff2d6f", "#8b5cf6", "#14b8a6", "#ef4444", "#64748b"];
const SHORT = ["D", "L", "M", "X", "J", "V", "S"];

/**
 * Formulario para añadir bloques al horario. Cada día elegido tiene su propia hora
 * (no tiene que ser la misma todos los días).
 */
export function BlockForm({
  initialTitle = "",
  initialColor = BLOCK_COLORS[0],
  ideaKey = null,
  defaultDay,
  onDone,
}: {
  initialTitle?: string;
  initialColor?: string;
  ideaKey?: string | null;
  defaultDay?: number;
  onDone: (count: number) => void;
}) {
  const { run, pending, error } = useAction();
  const [title, setTitle] = useState(initialTitle);
  const [color, setColor] = useState(initialColor);
  const [slots, setSlots] = useState<SlotInput[]>(defaultDay === undefined ? [] : [{ day: defaultDay, start: "18:00", end: "19:00" }]);

  const toggleDay = (d: number) =>
    setSlots((xs) => {
      if (xs.some((s) => s.day === d)) return xs.filter((s) => s.day !== d);
      const last = xs[xs.length - 1];
      const next = [...xs, { day: d, start: last?.start ?? "18:00", end: last?.end ?? "19:00" }];
      return next.sort((a, b) => WEEK_ORDER.indexOf(a.day as never) - WEEK_ORDER.indexOf(b.day as never));
    });
  const setSlot = (d: number, patch: Partial<SlotInput>) => setSlots((xs) => xs.map((s) => (s.day === d ? { ...s, ...patch } : s)));

  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addScheduleBlocks({ title, color, idea_key: ideaKey, slots }), (n) => onDone(n ?? slots.length));
      }}
    >
      <Field label="¿Qué vas a hacer?" htmlFor="block-title">
        <Input id="block-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="p. ej. Matemáticas, Inglés, Gimnasio" required />
      </Field>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Color</p>
        <div className="flex flex-wrap gap-2">
          {BLOCK_COLORS.map((c) => (
            <button
              key={c}
              type="button"
              aria-label={`Color ${c}`}
              aria-pressed={color === c}
              onClick={() => setColor(c)}
              className={cn("press h-8 w-8 rounded-full border-2", color === c ? "border-text" : "border-transparent")}
              style={{ background: c }}
            />
          ))}
        </div>
      </div>

      <div>
        <p className="mb-1.5 text-xs font-medium text-muted">Días</p>
        <div className="flex flex-wrap gap-1.5">
          {WEEK_ORDER.map((d) => {
            const on = slots.some((s) => s.day === d);
            return (
              <button
                key={d}
                type="button"
                aria-pressed={on}
                aria-label={WEEKDAY_NAME[d]}
                onClick={() => toggleDay(d)}
                className={cn("press h-10 w-10 rounded-full border text-sm font-semibold", on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted")}
              >
                {SHORT[d]}
              </button>
            );
          })}
        </div>
      </div>

      {slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted">Hora de cada día</p>
          {slots.map((s, i) => (
            <div key={s.day} className="flex items-center gap-2">
              <span className="w-20 shrink-0 text-sm font-medium">{WEEKDAY_NAME[s.day]}</span>
              <Input type="time" value={s.start} onChange={(e) => setSlot(s.day, { start: e.target.value })} className="w-[6.5rem]" aria-label={`Inicio ${WEEKDAY_NAME[s.day]}`} required />
              <span className="text-muted">–</span>
              <Input type="time" value={s.end} onChange={(e) => setSlot(s.day, { end: e.target.value })} className="w-[6.5rem]" aria-label={`Fin ${WEEKDAY_NAME[s.day]}`} required />
              {i === 0 && slots.length > 1 ? (
                <button type="button" title="Usar esta hora en todos los días" aria-label="Usar esta hora en todos los días" onClick={() => setSlots((xs) => xs.map((x) => ({ ...x, start: s.start, end: s.end })))} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text">
                  <Copy size={14} />
                </button>
              ) : (
                <button type="button" aria-label={`Quitar ${WEEKDAY_NAME[s.day]}`} onClick={() => toggleDay(s.day)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2 hover:text-text">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <Button type="submit" className="w-full" disabled={pending || !title.trim() || slots.length === 0}>
        {slots.length ? `Añadir a mi horario (${slots.length} ${slots.length === 1 ? "día" : "días"})` : "Elige los días"}
      </Button>
    </form>
  );
}
