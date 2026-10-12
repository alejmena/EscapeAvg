"use client";

import { useState } from "react";
import { Check, Clock3, Crown, Info, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/cn";
import { goalLabel, goalRank, HEAVY_GOAL_MINUTES, rankLabel, RANKS, SYMBOLIC_NOTE, type RankId } from "@/lib/domain/discipline";
import { updateDailyGoal } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, ProgressRing } from "@/components/ui/card";
import { Input } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";
import type { Tone } from "@/lib/sections";

const OPTIONS = RANKS.filter((r) => r.minHours >= 3);
const MAX_HOURS = 13;

// La escalera de rangos va subiendo de color: verde (empezar) → oro (élite) → coral (extremo).
const RANK_TONE: Partial<Record<RankId, Tone>> = {
  construyendo: "green",
  constancia: "teal",
  alto: "blue",
  avanzada: "indigo",
  elite5: "gold",
  elite1: "gold",
  extraordinario: "coral",
  excepcional: "coral",
};

function toneFor(minutes: number): Tone {
  const r = goalRank(minutes);
  if (r) return RANK_TONE[r.id] ?? "gold";
  const h = minutes / 60;
  return h < 5 ? "green" : h < 7 ? "teal" : h < 9 ? "blue" : h < 10 ? "indigo" : h < 12 ? "gold" : "coral";
}

/** Objetivo diario: un rango de la tabla o un número de horas personalizado. */
export function GoalPicker({ goalMinutes, ready }: { goalMinutes: number; ready: boolean }) {
  const [value, setValue] = useState(goalMinutes);
  const [custom, setCustom] = useState(goalRank(goalMinutes) ? "" : String(goalMinutes / 60));
  const [saved, setSaved] = useState(false);
  const { run, pending, error } = useAction();
  const save = (minutes: number) => {
    setValue(minutes);
    setSaved(false);
    run(() => updateDailyGoal(minutes), () => setSaved(true));
  };
  const hours = value / 60;
  const hoursShort = Number.isInteger(hours) ? String(hours) : hours.toFixed(1).replace(".", ",");

  return (
    <Card variant="tint" tone="gold" data-testid="goal-picker" className="overflow-hidden">
      <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-tone opacity-[0.14] blur-3xl" aria-hidden />

      <div className="relative flex items-start gap-3.5">
        <span className="tone-chip h-11 w-11 rounded-2xl">
          <Crown size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-semibold leading-tight tracking-tight">Objetivo diario de disciplina</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            Elige cuántas horas de desarrollo personal quieres cumplir en un día. Al alcanzarlo, la app te dirá que hiciste lo suficiente: la
            meta no se mueve.
          </p>
        </div>
      </div>

      {/* Meta actual */}
      <div data-tone={toneFor(value)} className="relative mt-5 flex items-center gap-4 rounded-[22px] border border-card-border bg-surface/70 p-4 shadow-soft backdrop-blur sm:gap-5">
        <ProgressRing value={Math.min(1, hours / MAX_HOURS)} size={76} stroke={7}>
          <span key={value} className="pop-in num-xl text-[22px]">
            {hoursShort}
            <span className="text-[13px] font-semibold text-muted">h</span>
          </span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-[13px] text-muted">
            Objetivo actual: <span className="mt-0.5 block font-display text-[19px] font-bold leading-tight text-text">{goalLabel(value)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">≈ {Math.round(hours * 7)} h de desarrollo a la semana</p>
        </div>
        {saved && (
          <Badge variant="success" className="pop-in shrink-0 self-start">
            <Check size={12} strokeWidth={3} aria-hidden /> Guardado
          </Badge>
        )}
      </div>

      {/* Escalera de rangos */}
      <div className="relative mt-4 grid gap-2.5 sm:grid-cols-2">
        {OPTIONS.map((r) => {
          const minutes = r.minHours * 60;
          const active = value === minutes;
          return (
            <button
              key={r.id}
              type="button"
              data-tone={RANK_TONE[r.id] ?? "gold"}
              disabled={!ready || pending}
              onClick={() => {
                setCustom("");
                save(minutes);
              }}
              className={cn(
                "press group relative flex items-center gap-3 overflow-hidden rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow] duration-300 disabled:opacity-60",
                active
                  ? "border-tone/60 bg-tone-soft shadow-[0_10px_24px_-14px_var(--tone)]"
                  : "border-border bg-surface/60 hover:border-tone/40 hover:bg-surface",
              )}
              aria-pressed={active}
            >
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-sm font-semibold">
                  {r.minHours >= 10 && <Crown size={13} className="shrink-0 text-[var(--gold)]" aria-hidden />}
                  <span className="truncate">{rankLabel(r)}</span>
                </span>
                <span className="block text-xs text-muted">
                  {r.minHours} h al día
                  {r.id === "elite1" && " · meta extraordinaria"}
                  {minutes >= HEAVY_GOAL_MINUTES && " · no para cada día"}
                </span>
                <span className="mt-2 flex gap-[3px]" aria-hidden>
                  {Array.from({ length: MAX_HOURS }, (_, i) => (
                    <span
                      key={i}
                      className={cn(
                        "h-1 flex-1 rounded-full transition-colors duration-300",
                        i < r.minHours ? (active ? "bg-gradient-to-r from-tone to-tone-2" : "bg-tone opacity-50 group-hover:opacity-80") : "bg-surface-3",
                      )}
                    />
                  ))}
                </span>
              </span>
              {/* Va después en el DOM (el nombre accesible empieza por el rango) pero se ve a la izquierda. */}
              <span
                className={cn(
                  "order-first grid h-11 w-11 shrink-0 place-items-center rounded-[14px] font-display text-[17px] font-bold tabular transition-all duration-300",
                  active ? "tone-chip scale-105" : "tone-chip-soft group-hover:scale-105",
                )}
                aria-hidden
              >
                {r.minHours}h
              </span>
              {active && (
                <span className="pop-in grid h-6 w-6 shrink-0 place-items-center rounded-full bg-tone text-white" aria-hidden>
                  <Check size={14} strokeWidth={3} />
                </span>
              )}
            </button>
          );
        })}
      </div>

      <form
        className="relative mt-3 flex flex-wrap items-end gap-3 rounded-2xl border border-dashed border-border-strong p-3"
        onSubmit={(e) => {
          e.preventDefault();
          const h = Number(custom.replace(",", "."));
          if (h > 0) save(Math.round(h * 60));
        }}
      >
        <span className="tone-chip-soft hidden h-10 w-10 rounded-xl sm:inline-grid" aria-hidden>
          <Clock3 size={18} />
        </span>
        <label className="text-sm">
          <span className="mb-1 block text-xs font-semibold text-muted">Personalizado (horas)</span>
          <Input
            type="number"
            min={1}
            max={16}
            step={0.5}
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            className="w-32"
            disabled={!ready}
            placeholder="p. ej. 6,5"
            aria-label="Objetivo personalizado en horas"
          />
        </label>
        <Button type="submit" variant="tone" disabled={!ready || !custom || pending}>
          Usar
        </Button>
        <p className="w-full text-xs text-muted sm:w-auto sm:flex-1 sm:self-center">Entre 1 y 16 horas, en tramos de media hora.</p>
      </form>

      {value >= HEAVY_GOAL_MINUTES && (
        <p className="pop-in relative mt-3 flex gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-sm text-warning">
          <TriangleAlert size={18} className="mt-px shrink-0" aria-hidden />
          <span>
            Más de 12 horas al día no es una meta sana para todos los días. Úsala solo para jornadas excepcionales y protege tu sueño y tu
            descanso.
          </span>
        </p>
      )}
      {!ready && (
        <p className="relative mt-3 flex gap-2 text-sm text-warning">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" aria-hidden />
          Disponible cuando se active la actualización de la base de datos (aviso en el Inicio).
        </p>
      )}
      {error && <p className="relative mt-2 text-sm text-danger">{error}</p>}
      <p className="relative mt-4 flex gap-1.5 text-xs text-muted">
        <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
        {SYMBOLIC_NOTE}
      </p>
    </Card>
  );
}
