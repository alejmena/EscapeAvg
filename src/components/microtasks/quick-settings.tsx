"use client";

import { useState } from "react";
import { Archive, Bookmark, CalendarClock, Repeat, RotateCcw, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeRepeat } from "@/lib/domain/quick";
import type { QuickTemplate } from "@/lib/types";
import { createQuickTemplate, deleteQuickTemplate, setQuickCarryOver, updateQuickTemplate } from "@/app/(app)/microtasks/actions";
import { useAction } from "@/components/tasks/use-action";
import { Badge, Card, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ErrorText, Input } from "@/components/ui/form";

const DAYS = [1, 2, 3, 4, 5, 6, 0] as const;
const SHORT = ["D", "L", "M", "X", "J", "V", "S"];

function DayPicker({ value, onChange, size = "md" }: { value: number[]; onChange: (d: number[]) => void; size?: "sm" | "md" }) {
  return (
    <div className="flex flex-wrap gap-1">
      {DAYS.map((d) => {
        const on = value.includes(d);
        return (
          <button
            key={d}
            type="button"
            aria-pressed={on}
            aria-label={`Repetir el ${["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"][d]}`}
            onClick={() => onChange(on ? value.filter((x) => x !== d) : [...value, d])}
            className={cn(
              "press rounded-full font-semibold transition-[background-color,color,box-shadow,border-color]",
              size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs",
              on
                ? "border border-transparent bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_6px_14px_-6px_var(--tone)]"
                : "border border-border bg-surface text-muted hover:border-tone/40 hover:text-text",
            )}
          >
            {SHORT[d]}
          </button>
        );
      })}
    </div>
  );
}

export function QuickSettings({ templates, carryOver }: { templates: QuickTemplate[]; carryOver: boolean }) {
  const { run, pending, error } = useAction();
  const [title, setTitle] = useState("");
  const [days, setDays] = useState<number[]>([]);
  const [keep, setKeep] = useState(carryOver);

  return (
    <div className="space-y-5">
      <Card>
        <CardTitle icon={<RotateCcw />} subtitle="¿Qué pasa con las tareas rápidas que no terminaste?">
          Reinicio diario
        </CardTitle>
        <div className="grid gap-2" role="radiogroup" aria-label="Reinicio diario">
          {[
            { v: true, t: "Se quedan para mañana", d: "Siguen en tu lista hasta que las hagas.", icon: <CalendarClock size={17} /> },
            { v: false, t: "Se archivan cada día", d: "Empiezas cada mañana con la lista limpia.", icon: <Archive size={17} /> },
          ].map((o) => {
            const on = keep === o.v;
            return (
              <button
                key={String(o.v)}
                type="button"
                role="radio"
                aria-checked={on}
                disabled={pending}
                onClick={() => {
                  setKeep(o.v);
                  run(() => setQuickCarryOver(o.v));
                }}
                className={cn(
                  "press flex items-center gap-3 rounded-2xl border p-3 text-left transition-[background-color,border-color,box-shadow] duration-200",
                  on ? "border-tone/50 bg-tone-soft/70 shadow-[0_10px_24px_-16px_var(--tone)]" : "border-border hover:border-border-strong hover:bg-surface-2/60",
                )}
              >
                <span className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl transition-colors", on ? "tone-chip" : "bg-surface-2 text-muted")} aria-hidden>
                  {o.icon}
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cn("block text-sm font-semibold", on && "text-tone-ink")}>{o.t}</span>
                  <span className="block text-xs text-muted">{o.d}</span>
                </span>
                <span
                  className={cn("grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 transition-colors", on ? "border-tone bg-tone" : "border-border-strong")}
                  aria-hidden
                >
                  {on && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                </span>
              </button>
            );
          })}
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Repeat />} subtitle="Botones de un clic o tareas que se añaden solas">
          Plantillas y repeticiones
        </CardTitle>
        <form
          className="space-y-3 rounded-2xl bg-surface-2/50 p-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!title.trim()) return;
            run(
              () => createQuickTemplate({ title, repeat_days: days }),
              () => {
                setTitle("");
                setDays([]);
              },
            );
          }}
        >
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Tender la cama" maxLength={200} aria-label="Nueva plantilla" />
          <DayPicker value={days} onChange={setDays} />
          <p className="text-xs leading-relaxed text-muted">Sin días: aparece como botón de un clic en el inicio. Con días: se añade sola esos días.</p>
          <Button type="submit" variant="tone" disabled={pending || !title.trim()} className="w-full">
            {days.length ? `Repetir: ${describeRepeat(days)}` : "Guardar plantilla"}
          </Button>
          <ErrorText>{error}</ErrorText>
        </form>

        {templates.length > 0 && (
          <ul className="mt-4 space-y-2">
            {templates.map((t) => {
              const repeats = t.repeat_days.length > 0;
              return (
                <li key={t.id} className="group rounded-2xl border border-border/70 p-3 transition-colors hover:bg-surface-2/50">
                  <div className="flex items-center gap-2.5">
                    <span className={cn("grid h-8 w-8 shrink-0 place-items-center rounded-xl", repeats ? "tone-chip" : "tone-chip-soft")} aria-hidden>
                      {repeats ? <Repeat size={14} /> : <Bookmark size={14} />}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-sm font-semibold">{t.title}</span>
                    <Badge variant={repeats ? "tone" : "neutral"}>{describeRepeat(t.repeat_days)}</Badge>
                    <button
                      type="button"
                      onClick={() => run(() => deleteQuickTemplate(t.id))}
                      className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-danger-soft hover:text-danger"
                      aria-label={`Borrar plantilla ${t.title}`}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="mt-2.5 pl-[42px]">
                    <DayPicker size="sm" value={t.repeat_days} onChange={(d) => run(() => updateQuickTemplate(t.id, { repeat_days: d }))} />
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
