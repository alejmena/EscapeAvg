"use client";

import { useState } from "react";
import { Check, Copy, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { WEEKDAY_NAME } from "@/lib/format";
import { WEEK_ORDER } from "@/lib/domain/schedule";
import { addScheduleBlocks, type SlotInput } from "@/app/(app)/schedule/actions";
import { useAction } from "@/components/tasks/use-action";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input } from "@/components/ui/form";

export const BLOCK_COLORS = ["#5b4bf5", "#0ab3ff", "#2fc75c", "#f59e0b", "#ff2d6f", "#8b5cf6", "#14b8a6", "#ef4444", "#64748b"];
const SHORT = ["D", "L", "M", "X", "J", "V", "S"];

/** Color de texto legible sobre un bloque de color: blanco en los oscuros, un tono muy profundo del mismo color en los claros. */
export function inkFor(hex: string): string {
  const n = parseInt(hex.replace("#", ""), 16);
  if (Number.isNaN(n)) return "#fff";
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const l = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return l > 0.3 ? `color-mix(in srgb, ${hex} 22%, #000)` : "#fff";
}

/** Muestras de color con anillo y marca en la elegida. */
export function ColorSwatches({ colors, value, onChange }: { colors: string[]; value: string; onChange: (c: string) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5 sm:gap-2">
      {colors.map((c) => {
        const on = value === c;
        return (
          <button
            key={c}
            type="button"
            aria-label={`Color ${c}`}
            aria-pressed={on}
            onClick={() => onChange(c)}
            className={cn("press grid h-8 w-8 place-items-center rounded-full transition-[transform,box-shadow] duration-200 hover:scale-110", on && "scale-110")}
            style={{
              background: `linear-gradient(140deg, color-mix(in srgb, ${c} 75%, #fff), ${c})`,
              color: inkFor(c),
              boxShadow: on ? `0 0 0 2px var(--surface), 0 0 0 4px ${c}, 0 6px 14px -4px ${c}` : `0 4px 10px -6px ${c}`,
            }}
          >
            {on && <Check size={15} strokeWidth={3} className="pop-in" aria-hidden />}
          </button>
        );
      })}
    </div>
  );
}

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
      className="space-y-5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => addScheduleBlocks({ title, color, idea_key: ideaKey, slots }), (n) => onDone(n ?? slots.length));
      }}
    >
      <Field label="¿Qué vas a hacer?" htmlFor="block-title">
        <Input id="block-title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={80} placeholder="p. ej. Matemáticas, Inglés, Gimnasio" required />
      </Field>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted">Color</p>
        <ColorSwatches colors={BLOCK_COLORS} value={color} onChange={setColor} />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold text-muted">Días</p>
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
                className={cn(
                  "press h-10 w-10 rounded-full text-sm font-bold transition-[background-color,color,box-shadow] duration-200",
                  on ? "tone-chip" : "border border-border bg-surface text-muted hover:border-border-strong hover:text-text",
                )}
              >
                {SHORT[d]}
              </button>
            );
          })}
        </div>
      </div>

      {slots.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted">Hora de cada día</p>
          {slots.map((s, i) => (
            <div key={s.day} className="pop-in flex items-center gap-1.5 rounded-2xl border border-border bg-surface-2/50 p-1.5 pl-2.5 sm:gap-2 sm:pl-3">
              <span className="hidden h-6 w-1.5 shrink-0 rounded-full sm:block" style={{ background: color }} aria-hidden />
              <span className="w-9 shrink-0 text-sm font-semibold sm:w-20">
                <span className="sm:hidden" aria-hidden>
                  {WEEKDAY_NAME[s.day].slice(0, 3)}
                </span>
                <span className="max-sm:sr-only">{WEEKDAY_NAME[s.day]}</span>
              </span>
              <Input type="time" value={s.start} onChange={(e) => setSlot(s.day, { start: e.target.value })} className="w-0 min-w-0 flex-1 max-sm:px-2! sm:w-[6.5rem] sm:flex-none" aria-label={`Inicio ${WEEKDAY_NAME[s.day]}`} required />
              <span className="text-muted" aria-hidden>
                –
              </span>
              <Input type="time" value={s.end} onChange={(e) => setSlot(s.day, { end: e.target.value })} className="w-0 min-w-0 flex-1 max-sm:px-2! sm:w-[6.5rem] sm:flex-none" aria-label={`Fin ${WEEKDAY_NAME[s.day]}`} required />
              {i === 0 && slots.length > 1 ? (
                <button type="button" title="Usar esta hora en todos los días" aria-label="Usar esta hora en todos los días" onClick={() => setSlots((xs) => xs.map((x) => ({ ...x, start: s.start, end: s.end })))} className="press grid h-7 w-7 shrink-0 place-items-center rounded-full text-tone-ink hover:bg-tone-soft sm:h-8 sm:w-8">
                  <Copy size={14} />
                </button>
              ) : (
                <button type="button" aria-label={`Quitar ${WEEKDAY_NAME[s.day]}`} onClick={() => toggleDay(s.day)} className="press grid h-7 w-7 shrink-0 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger sm:h-8 sm:w-8">
                  <X size={14} />
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      <ErrorText>{error}</ErrorText>
      <Button type="submit" size="lg" className="w-full" disabled={pending || !title.trim() || slots.length === 0}>
        {slots.length ? `Añadir a mi horario (${slots.length} ${slots.length === 1 ? "día" : "días"})` : "Elige los días"}
      </Button>
    </form>
  );
}
