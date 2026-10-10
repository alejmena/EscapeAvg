"use client";

import { useState } from "react";
import { Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeRepeat } from "@/lib/domain/quick";
import type { QuickTemplate } from "@/lib/types";
import { createQuickTemplate, deleteQuickTemplate, setQuickCarryOver, updateQuickTemplate } from "@/app/(app)/microtasks/actions";
import { useAction } from "@/components/tasks/use-action";
import { Card, CardTitle } from "@/components/ui/card";
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
              "press rounded-full border font-semibold",
              size === "sm" ? "h-7 w-7 text-[11px]" : "h-9 w-9 text-xs",
              on ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted",
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
    <div className="space-y-6">
      <Card>
        <CardTitle>Reinicio diario</CardTitle>
        <p className="mb-3 text-sm text-muted">¿Qué pasa con las tareas rápidas que no terminaste?</p>
        <div className="grid gap-2" role="radiogroup" aria-label="Reinicio diario">
          {[
            { v: true, t: "Se quedan para mañana", d: "Siguen en tu lista hasta que las hagas." },
            { v: false, t: "Se archivan cada día", d: "Empiezas cada mañana con la lista limpia." },
          ].map((o) => (
            <button
              key={String(o.v)}
              type="button"
              role="radio"
              aria-checked={keep === o.v}
              disabled={pending}
              onClick={() => {
                setKeep(o.v);
                run(() => setQuickCarryOver(o.v));
              }}
              className={cn("rounded-2xl border p-3 text-left transition-colors", keep === o.v ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2")}
            >
              <span className="block text-sm font-semibold">{o.t}</span>
              <span className="block text-xs text-muted">{o.d}</span>
            </button>
          ))}
        </div>
      </Card>

      <Card>
        <CardTitle icon={<Repeat size={15} />}>Plantillas y repeticiones</CardTitle>
        <form
          className="space-y-2"
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
          <p className="text-xs text-muted">Sin días: aparece como botón de un clic en el inicio. Con días: se añade sola esos días.</p>
          <Button type="submit" disabled={pending || !title.trim()} className="w-full">
            {days.length ? `Repetir: ${describeRepeat(days)}` : "Guardar plantilla"}
          </Button>
          <ErrorText>{error}</ErrorText>
        </form>

        {templates.length > 0 && (
          <ul className="mt-5 divide-y divide-border">
            {templates.map((t) => (
              <li key={t.id} className="py-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-medium">{t.title}</span>
                  <span className="flex shrink-0 items-center gap-1">
                    <span className="text-xs text-muted">{describeRepeat(t.repeat_days)}</span>
                    <button type="button" onClick={() => run(() => deleteQuickTemplate(t.id))} className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Borrar plantilla ${t.title}`}>
                      <Trash2 size={14} />
                    </button>
                  </span>
                </div>
                <div className="mt-2">
                  <DayPicker size="sm" value={t.repeat_days} onChange={(d) => run(() => updateQuickTemplate(t.id, { repeat_days: d }))} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
