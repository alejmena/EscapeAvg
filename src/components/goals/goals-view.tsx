"use client";

import { useId, useState } from "react";
import {
  Archive,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  CheckSquare,
  Flag,
  Flame,
  History,
  Lightbulb,
  PencilLine,
  Plus,
  Repeat,
  RotateCcw,
  Sparkles,
  Target,
  Timer,
  Trash2,
  TrendingUp,
  Trophy,
  Hourglass,
  type LucideIcon,
} from "lucide-react";
import { GOAL_METRIC_LABEL, type GoalMetric, type GoalPeriod } from "@/lib/domain/goals";
import { diffDays, isISODate } from "@/lib/domain/dates";
import { formatShortDate } from "@/lib/format";
import { formatDuration } from "@/lib/domain/stats";
import type { Category } from "@/lib/types";
import type { GoalWithProgress } from "@/lib/data/stats";
import type { Tone } from "@/lib/sections";
import { createGoal, deleteGoal, setGoalManualValue, setGoalStatus } from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, ProgressRing } from "@/components/ui/card";
import { ErrorText, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/components/tasks/use-action";
import { cn } from "@/lib/cn";

// Cada métrica con su icono y el color de la sección de la que salen los datos.
const METRIC_STYLE: Record<GoalMetric, { icon: LucideIcon; tone: Tone }> = {
  focus_minutes: { icon: Timer, tone: "coral" },
  tasks_completed: { icon: CheckSquare, tone: "blue" },
  habit_completions: { icon: Flame, tone: "orange" },
  manual: { icon: PencilLine, tone: "teal" },
};

const PERIOD_LABEL: Record<GoalPeriod, string> = { weekly: "Semanal", monthly: "Mensual", custom: "Fechas concretas" };

// Metas rápidas en el formulario, según lo que se mide.
const SUGGESTED: Record<GoalMetric, { value: number; label: string }[]> = {
  focus_minutes: [
    { value: 60, label: "1 h" },
    { value: 150, label: "2,5 h" },
    { value: 300, label: "5 h" },
    { value: 600, label: "10 h" },
  ],
  tasks_completed: [3, 5, 10, 20].map((v) => ({ value: v, label: String(v) })),
  habit_completions: [5, 10, 20, 30].map((v) => ({ value: v, label: String(v) })),
  manual: [],
};

type Preset = { title: string; metric: GoalMetric; period: GoalPeriod; target: number };

// Ideas para un primer objetivo (abren el formulario ya relleno).
const PRESETS: Preset[] = [
  { title: "5 horas de concentración esta semana", metric: "focus_minutes", period: "weekly", target: 300 },
  { title: "Completar 10 tareas este mes", metric: "tasks_completed", period: "monthly", target: 10 },
  { title: "Cumplir mis hábitos 20 veces este mes", metric: "habit_completions", period: "monthly", target: 20 },
];

const num = new Intl.NumberFormat("es", { maximumFractionDigits: 1 });

export function GoalsView({ goals, categories, past, today }: { goals: GoalWithProgress[]; categories: Category[]; past: { id: string; title: string; status: string }[]; today: string }) {
  const [creating, setCreating] = useState<{ preset?: Preset } | null>(null);
  const { run } = useAction();
  const category = (id: string | null) => categories.find((c) => c.id === id);

  const achieved = goals.filter((g) => g.progress.achieved).length;
  const average = goals.length ? goals.reduce((a, g) => a + g.progress.ratio, 0) / goals.length : 0;
  const next = goals.filter((g) => !g.progress.achieved).sort((a, b) => b.progress.ratio - a.progress.ratio)[0];

  return (
    <div className="stagger space-y-6">
      <PageHeader
        title="Objetivos"
        subtitle="Metas medibles que se actualizan solas con tus datos."
        action={
          <Button onClick={() => setCreating({})}>
            <Plus size={16} /> Nuevo objetivo
          </Button>
        }
      />

      {goals.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={<Target size={28} />}
            title="Sin objetivos activos"
            action={
              <Button variant="tone" onClick={() => setCreating({})}>
                <Sparkles size={15} /> Crear mi primer objetivo
              </Button>
            }
          >
            Prueba algo alcanzable, por ejemplo: 5 horas de estudio esta semana.
          </EmptyState>
          <section data-reveal>
            <p className="eyebrow mb-3">Ideas para empezar</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PRESETS.map((p) => {
                const { icon: Icon, tone } = METRIC_STYLE[p.metric];
                return (
                  <button
                    key={p.title}
                    type="button"
                    onClick={() => setCreating({ preset: p })}
                    className="card-glass lift group flex items-start gap-3 rounded-[22px] p-4 text-left"
                  >
                    <span data-tone={tone} className="tone-chip h-10 w-10 rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                      <Icon size={18} aria-hidden />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-semibold leading-snug">{p.title}</span>
                      <span className="mt-1 block text-xs text-muted">{PERIOD_LABEL[p.period]} · se mide solo</span>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        </div>
      ) : (
        <>
          {/* Protagonista: cómo vas con tus metas en conjunto */}
          <Card variant="feature" className="p-6 sm:p-7">
            <div className="pointer-events-none absolute -bottom-24 -left-10 h-64 w-64 rounded-full bg-[var(--tone-2)] opacity-35 blur-3xl" aria-hidden />
            <div className="relative grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-5 gap-y-4 sm:gap-x-8">
              <div className="sm:row-span-2">
                <ProgressRing value={average} size={120} stroke={11} color="#ffffff">
                  <div className="text-center">
                    <p className="num-xl text-[32px]">
                      {Math.round(average * 100)}
                      <span className="text-base font-semibold">%</span>
                    </p>
                    <p className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">de media</p>
                  </div>
                </ProgressRing>
              </div>
              <div className="min-w-0">
                <p className="eyebrow">Tus metas ahora</p>
                <h2 className="mt-1.5 font-display text-[24px] font-bold leading-[1.1] sm:text-[32px]">
                  {achieved === goals.length ? (
                    "¡Todo cumplido!"
                  ) : (
                    <>
                      <span className="tabular">{achieved}</span>
                      <span className="text-muted">/{goals.length}</span> {goals.length === 1 ? "objetivo cumplido" : "objetivos cumplidos"}
                    </>
                  )}
                </h2>
              </div>
              <div className="col-span-2 min-w-0 sm:col-span-1 sm:col-start-2">
                {next &&
                  (next.progress.ratio > 0 ? (
                    <p className="text-sm text-muted">
                      Lo más cerca: <span className="font-semibold text-text">{next.title}</span> va por el {Math.round(next.progress.ratio * 100)}&nbsp;%.
                    </p>
                  ) : (
                    <p className="text-sm text-muted">
                      Empieza por: <span className="font-semibold text-text">{next.title}</span>. El primer avance es el que más cuesta.
                    </p>
                  ))}
                <div className="mt-3.5 flex flex-wrap gap-2">
                  <HeroPill icon={<Target size={13} />}>{goals.length - achieved} en curso</HeroPill>
                  <HeroPill icon={<Trophy size={13} />}>
                    {achieved} {achieved === 1 ? "logrado" : "logrados"}
                  </HeroPill>
                  {past.length > 0 && <HeroPill icon={<History size={13} />}>{past.length} en el historial</HeroPill>}
                </div>
              </div>
            </div>
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            {goals.map((g) => (
              <GoalCard
                key={g.id}
                goal={g}
                category={category(g.category_id)}
                today={today}
                onAchieve={() => run(() => setGoalStatus(g.id, "achieved"))}
                onDelete={() => confirm("¿Eliminar este objetivo?") && run(() => deleteGoal(g.id))}
              />
            ))}
          </div>
        </>
      )}

      {past.length > 0 && (
        <section data-reveal>
          <h2 className="mb-3 flex items-center gap-2.5 font-display text-lg font-semibold">
            <span className="tone-chip-soft h-8 w-8 rounded-xl" aria-hidden>
              <History size={16} />
            </span>
            Anteriores
            <Badge className="ml-0.5">{past.length}</Badge>
          </h2>
          <ul className="card-glass space-y-1 rounded-[26px] p-2">
            {past.map((p) => {
              const won = p.status === "achieved";
              return (
                <li key={p.id} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-surface-2/60">
                  <span
                    data-tone={won ? "gold" : "slate"}
                    className={cn("h-9 w-9 rounded-xl [&_svg]:h-4 [&_svg]:w-4", won ? "tone-chip" : "tone-chip-soft")}
                    aria-hidden
                  >
                    {won ? <Trophy /> : p.status === "archived" ? <Archive /> : <Flag />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-sm font-medium sm:truncate">{p.title}</p>
                    {p.status !== "active" && (
                      <p className={cn("text-xs font-semibold", won ? "text-gold" : "text-faint")}>{won ? "Logrado" : "Archivado"}</p>
                    )}
                  </div>
                  {p.status === "active" ? (
                    <span className="rounded-full bg-surface-2 px-2.5 py-1 text-xs font-medium text-muted">Terminado</span>
                  ) : (
                    <button
                      type="button"
                      className="press inline-flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold text-muted transition-colors hover:bg-tone-soft hover:text-tone-ink"
                      onClick={() => run(() => setGoalStatus(p.id, "active"))}
                    >
                      <RotateCcw size={13} aria-hidden />
                      Reactivar
                    </button>
                  )}
                </li>
              );
            })}
          </ul>
        </section>
      )}
      {creating && <GoalEditor categories={categories} today={today} preset={creating.preset} onClose={() => setCreating(null)} />}
    </div>
  );
}

function HeroPill({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-surface px-3 py-1.5 text-[12.5px] font-semibold ring-1 ring-inset ring-border">
      <span aria-hidden>{icon}</span>
      {children}
    </span>
  );
}

function GoalCard({
  goal: g,
  category,
  today,
  onAchieve,
  onDelete,
}: {
  goal: GoalWithProgress;
  category?: Category;
  today: string;
  onAchieve: () => void;
  onDelete: () => void;
}) {
  const achieved = g.progress.achieved;
  const { icon: Icon, tone } = METRIC_STYLE[g.metric];
  // Ritmo: qué parte del período ya ha pasado (sin contar hoy, que aún no ha terminado).
  const days = diffDays(g.range.to, g.range.from) + 1;
  const elapsed = Math.max(0, Math.min(1, diffDays(today, g.range.from) / days));
  const left = diffDays(g.range.to, today);
  const onTrack = g.progress.ratio + 0.001 >= elapsed;
  const remaining = Math.max(0, g.progress.target - g.progress.value);

  return (
    <Card variant={achieved ? "tint" : "glass"} tone={achieved ? "gold" : undefined} className="group flex flex-col gap-5 overflow-hidden">
      {achieved && <div className="pointer-events-none absolute -right-10 -top-12 h-40 w-40 rounded-full bg-tone opacity-25 blur-3xl" aria-hidden />}
      <div className="relative flex items-start gap-3">
        <span data-tone={tone} className="tone-chip h-11 w-11 rounded-2xl [&_svg]:h-5 [&_svg]:w-5" aria-hidden>
          <Icon />
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="break-words font-display text-[17px] font-semibold leading-snug">{g.title}</h3>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {achieved ? (
              <Badge variant="solid">
                <Trophy size={11} aria-hidden /> Logrado
              </Badge>
            ) : (
              <Badge variant="tone">
                <span className="h-1.5 w-1.5 rounded-full bg-tone" aria-hidden /> En curso
              </Badge>
            )}
            <Badge>
              {g.period === "custom" ? <CalendarRange size={11} aria-hidden /> : <Repeat size={11} aria-hidden />}
              {PERIOD_LABEL[g.period]}
            </Badge>
            {category && <Badge color={category.color}>{category.name}</Badge>}
          </div>
        </div>
        <button
          type="button"
          className="press grid h-8 w-8 shrink-0 place-items-center rounded-full text-faint transition-[opacity,color,background-color] hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100"
          aria-label="Eliminar objetivo"
          onClick={onDelete}
        >
          <Trash2 size={15} />
        </button>
      </div>

      <div className="relative flex items-center gap-5">
        <GoalRing ratio={g.progress.ratio} expected={achieved ? null : elapsed} achieved={achieved} label={g.title} />
        <div className="min-w-0">
          <p className="flex flex-wrap items-baseline gap-x-2">
            <span className="num-xl text-[40px]">{num.format(g.progress.value)}</span>
            <span className="text-sm font-medium text-muted">de {num.format(g.progress.target)}</span>
          </p>
          <p className="mt-1 text-xs text-muted">{GOAL_METRIC_LABEL[g.metric]}</p>
          {!achieved && (
            <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11.5px] font-semibold",
                  onTrack ? "bg-success-soft text-success" : "bg-warning-soft text-warning",
                )}
              >
                {onTrack ? <TrendingUp size={12} aria-hidden /> : <Hourglass size={12} aria-hidden />}
                {onTrack ? "A buen ritmo" : "Algo por detrás"}
              </span>
              {elapsed > 0.02 && (
                <span className="inline-flex items-center gap-1 text-[11px] text-faint">
                  <span className="h-2 w-2 rounded-full border-2 border-text" aria-hidden />
                  Ritmo esperado: {Math.round(elapsed * 100)}&nbsp;%
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {!achieved && remaining > 0 && <Remaining metric={g.metric} remaining={remaining} daysLeft={left + 1} />}

      {g.metric === "manual" && <ManualUpdate id={g.id} value={g.progress.value} />}

      {achieved && (
        <div className="relative flex flex-wrap items-center justify-between gap-3 rounded-2xl bg-[var(--gold-soft)] px-4 py-3 ring-1 ring-inset ring-tone/20">
          <p className="text-gold font-display text-[15px] font-bold">¡Objetivo alcanzado!</p>
          <button
            type="button"
            className="press shine inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-tone to-tone-2 px-3.5 py-1.5 text-xs font-semibold text-white shadow-[0_8px_18px_-8px_var(--tone)]"
            title="Marcar como logrado"
            aria-label="Marcar como logrado"
            onClick={onAchieve}
          >
            <CheckCircle2 size={14} aria-hidden />
            Marcar como logrado
          </button>
        </div>
      )}

      <div className="relative mt-auto flex flex-wrap items-center justify-between gap-2 border-t border-border/70 pt-4 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5 tabular">
          <CalendarDays size={13} aria-hidden />
          {formatShortDate(g.range.from)} – {formatShortDate(g.range.to)}
        </span>
        <span className="rounded-full bg-surface-2 px-2.5 py-1 font-semibold text-text">
          {left <= 0 ? "Último día" : left === 1 ? "Queda 1 día" : `Quedan ${left} días`}
        </span>
      </div>
    </Card>
  );
}

/**
 * Anillo de progreso del objetivo con una marca del ritmo esperado (lo que "tocaría" llevar hoy).
 * Si está logrado, el centro muestra un trofeo.
 */
function GoalRing({ ratio, expected, achieved, label, size = 96 }: { ratio: number; expected: number | null; achieved: boolean; label: string; size?: number }) {
  const gid = `gr${useId().replace(/:/g, "")}`;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(1, ratio));
  const angle = (expected ?? 0) * 2 * Math.PI;
  const pct = Math.round(v * 100);
  return (
    <div
      className="relative grid shrink-0 place-items-center"
      style={{ width: size, height: size }}
      role="progressbar"
      aria-label={label}
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <svg width={size} height={size} className="-rotate-90 overflow-visible" aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--tone)" />
            <stop offset="100%" stopColor="var(--tone-2)" />
          </linearGradient>
        </defs>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="var(--tone)" strokeOpacity={0.14} strokeWidth={stroke} fill="none" />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`url(#${gid})`}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * (1 - v)}
            className="ring-in"
            style={{ "--ring-c": c, filter: "drop-shadow(0 0 6px var(--tone))", transition: "stroke-dashoffset 900ms var(--ease-out)" } as React.CSSProperties}
          />
        )}
        {expected != null && expected > 0.02 && expected < 0.98 && (
          <circle cx={size / 2 + r * Math.cos(angle)} cy={size / 2 + r * Math.sin(angle)} r={4} fill="var(--surface)" stroke="var(--text)" strokeWidth={2}>
            <title>Ritmo esperado hoy</title>
          </circle>
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center">
        {achieved ? (
          <Trophy size={28} className="animate-float text-tone drop-shadow-[0_2px_6px_var(--tone)]" aria-hidden />
        ) : (
          <span className="font-display text-[20px] font-bold tabular">
            {pct}
            <span className="text-xs font-semibold text-muted">%</span>
          </span>
        )}
      </div>
    </div>
  );
}

/** Lo que falta para la meta y, si se mide solo, cuánto tocaría al día hasta el final del período. */
function Remaining({ metric, remaining, daysLeft }: { metric: GoalMetric; remaining: number; daysLeft: number }) {
  const amount = (n: number) =>
    metric === "focus_minutes"
      ? formatDuration(n * 60)
      : metric === "tasks_completed"
        ? `${num.format(n)} ${n === 1 ? "tarea" : "tareas"}`
        : metric === "habit_completions"
          ? `${num.format(n)} ${n === 1 ? "hábito" : "hábitos"}`
          : num.format(n);
  const perDay = metric !== "manual" && daysLeft > 1 ? remaining / daysLeft : null;
  return (
    <div className="relative flex items-center gap-2.5 rounded-2xl bg-surface-2/60 px-3.5 py-2.5 text-xs text-muted">
      <Flag size={14} className="shrink-0 text-tone" aria-hidden />
      <span>
        Te faltan <strong className="font-semibold text-text">{amount(remaining)}</strong>
        {perDay != null && (
          <>
            {" "}
            · ≈ <strong className="font-semibold text-text">{metric === "focus_minutes" ? amount(perDay) : num.format(Math.ceil(perDay))}</strong> al día
          </>
        )}
      </span>
    </div>
  );
}

function ManualUpdate({ id, value }: { id: string; value: number }) {
  const [v, setV] = useState(String(value));
  const { run, pending } = useAction();
  return (
    <form
      className="relative flex flex-wrap items-center gap-2 rounded-2xl bg-surface-2/60 p-2 pl-3.5"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setGoalManualValue(id, Number(v)));
      }}
    >
      <span className="inline-flex basis-full items-center gap-1.5 pt-1 text-xs font-semibold text-muted sm:mr-auto sm:basis-auto sm:pt-0">
        <PencilLine size={13} aria-hidden /> Lo actualizas tú
      </span>
      <Input type="number" min={0} step="any" value={v} onChange={(e) => setV(e.target.value)} className="h-9 flex-1 bg-surface sm:w-24 sm:flex-none" aria-label="Progreso actual" />
      <Button type="submit" size="sm" variant="tone" disabled={pending}>
        Actualizar
      </Button>
    </form>
  );
}

function GoalEditor({ categories, today, preset, onClose }: { categories: Category[]; today: string; preset?: Preset; onClose: () => void }) {
  const [title, setTitle] = useState(preset?.title ?? "");
  const [metric, setMetric] = useState<GoalMetric>(preset?.metric ?? "focus_minutes");
  const [period, setPeriod] = useState<GoalPeriod>(preset?.period ?? "weekly");
  const [target, setTarget] = useState(String(preset?.target ?? 300));
  const [category, setCategory] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const { run, pending, error } = useAction();
  const { icon: Icon, tone } = METRIC_STYLE[metric];
  const when =
    period === "weekly"
      ? "se renueva cada semana"
      : period === "monthly"
        ? "se renueva cada mes"
        : isISODate(start) && isISODate(end)
          ? `del ${formatShortDate(start)} al ${formatShortDate(end)}`
          : "en fechas concretas";
  const amount = Number(target) > 0 ? num.format(Number(target)) : "…";
  return (
    <Modal open onClose={onClose} title="Nuevo objetivo" sheet>
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              createGoal({
                title,
                metric,
                period,
                target_value: Number(target),
                category_id: category || null,
                start_date: period === "custom" ? start : null,
                end_date: period === "custom" ? end : null,
              }),
            onClose,
          );
        }}
      >
        {/* Vista previa en vivo */}
        <div className="card-tint flex items-center gap-3.5 rounded-2xl p-4">
          <span data-tone={tone} className="tone-chip h-12 w-12 rounded-[16px] transition-all duration-300 [&_svg]:h-[22px] [&_svg]:w-[22px]" aria-hidden>
            <Icon key={metric} className="pop-in" />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Vista previa</p>
            <p className="truncate font-display text-[17px] font-semibold leading-snug">{title.trim() || "Tu próximo objetivo"}</p>
            <p className="text-xs text-muted">
              {metric === "manual" ? `Llegar a ${amount}, lo actualizas tú` : `${amount} ${GOAL_METRIC_LABEL[metric]}`} · {when}
            </p>
          </div>
        </div>

        <Input
          autoFocus
          required
          maxLength={120}
          placeholder="Ej.: Estudiar 5 horas esta semana"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="h-12 text-[15px]"
          aria-label="Título"
        />
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Qué se mide" htmlFor="metric">
            <Select id="metric" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
              <option value="focus_minutes">Minutos de concentración</option>
              <option value="tasks_completed">Tareas completadas</option>
              <option value="habit_completions">Hábitos cumplidos</option>
              <option value="manual">Manual (lo actualizo yo)</option>
            </Select>
          </Field>
          <Field label="Meta" htmlFor="target">
            <div className="relative">
              <Input id="target" type="number" min={1} step="any" required value={target} onChange={(e) => setTarget(e.target.value)} className={metric === "focus_minutes" ? "pr-12" : undefined} />
              {metric === "focus_minutes" && (
                <span className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-faint" aria-hidden>
                  min
                </span>
              )}
            </div>
            {SUGGESTED[metric].length > 0 && (
              <div role="group" aria-label="Sugerencias rápidas" className="mt-2 flex flex-wrap gap-1.5">
                {SUGGESTED[metric].map((s) => (
                  <button
                    key={s.value}
                    type="button"
                    aria-pressed={Number(target) === s.value}
                    onClick={() => setTarget(String(s.value))}
                    className="press rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-semibold text-muted hover:border-tone/50 hover:text-text aria-pressed:border-tone aria-pressed:bg-tone-soft aria-pressed:text-tone-ink"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            )}
          </Field>
          <Field label="Período" htmlFor="period">
            <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)}>
              <option value="weekly">Esta semana (se renueva)</option>
              <option value="monthly">Este mes (se renueva)</option>
              <option value="custom">Fechas concretas</option>
            </Select>
          </Field>
          {metric !== "manual" && (
            <Field label="Categoría" htmlFor="gcat">
              <Select id="gcat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde" htmlFor="gs">
              <Input id="gs" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Hasta" htmlFor="ge">
              <Input id="ge" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        )}
        <p data-tone="amber" className="flex items-start gap-2.5 rounded-2xl bg-tone-soft/60 px-3.5 py-3 text-xs leading-relaxed text-text">
          <span className="tone-chip-soft h-6 w-6 rounded-lg bg-surface/70" aria-hidden>
            <Lightbulb size={13} />
          </span>
          <span className="pt-0.5">Consejo: empieza por una meta que estés seguro de poder cumplir. Siempre puedes subirla.</span>
        </p>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="tone" disabled={pending || !title.trim()}>
            <Plus size={15} aria-hidden />
            Crear objetivo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
