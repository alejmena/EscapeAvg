"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  Archive,
  ArchiveRestore,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronDown,
  Coffee,
  Flame,
  Moon,
  PartyPopper,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
  TrendingUp,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { addDays, eachDay, type ISODate, startOfWeek, weekday } from "@/lib/domain/dates";
import { compliance, habitStreak, isScheduled } from "@/lib/domain/habits";
import { formatLongDate, WEEKDAY_NAME, WEEKDAY_SHORT } from "@/lib/format";
import type { Category, Habit, HabitLog } from "@/lib/types";
import { archiveHabit, createHabit, deleteHabit, setHabitLog, updateHabit } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, ProgressBar, ProgressRing, StatTile } from "@/components/ui/card";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/components/tasks/use-action";
import { burst } from "@/components/fx/burst";

const COLORS = ["#10b981", "#6366f1", "#0ea5e9", "#f59e0b", "#ec4899", "#ef4444", "#8b5cf6", "#14b8a6"];

// Ideas para un primer hábito (abren el formulario ya relleno).
const IDEAS = [
  { name: "Meditar 5 minutos", color: "#8b5cf6" },
  { name: "Caminar 20 minutos", color: "#10b981" },
  { name: "Estudiar 25 minutos", color: "#0ea5e9" },
  { name: "Dormir antes de las 23:30", color: "#6366f1" },
];

type DayState = "done" | "rest" | "skipped" | undefined;

/** Destello del color del hábito sobre la tarjeta al marcarlo (nada con "reducir movimiento"). */
function flash(el: HTMLElement | null) {
  try {
    if (!el || matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    el.animate([{ opacity: 0 }, { opacity: 1, offset: 0.25 }, { opacity: 0 }], { duration: 1100, easing: "cubic-bezier(0.22, 1, 0.36, 1)" });
  } catch {
    // Solo decorativo.
  }
}

const streakUnit = (habit: Habit, n: number) =>
  habit.frequency === "weekly" ? (n === 1 ? "semana" : "semanas") : n === 1 ? "vez seguida" : "seguidas";

export function HabitsView({
  habits,
  logs,
  categories,
  today,
  weekStartsOn,
  streaksEnabled,
}: {
  habits: Habit[];
  logs: HabitLog[];
  categories: Category[];
  today: ISODate;
  weekStartsOn: number;
  streaksEnabled: boolean;
}) {
  const [editing, setEditing] = useState<Habit | null>(null);
  const [creating, setCreating] = useState<{ name?: string; color?: string } | null>(null);
  const [showArchived, setShowArchived] = useState(false);
  const byHabit = useMemo(() => {
    const m = new Map<string, HabitLog[]>();
    for (const l of logs) m.set(l.habit_id, [...(m.get(l.habit_id) ?? []), l]);
    return m;
  }, [logs]);

  const active = useMemo(() => habits.filter((h) => !h.archived_at), [habits]);
  const archived = habits.filter((h) => h.archived_at);
  const dueToday = active.filter((h) => isScheduled(h, today));
  const isDone = (h: Habit) => byHabit.get(h.id)?.some((l) => l.log_date === today && l.status === "done") ?? false;
  const doneToday = dueToday.filter(isDone).length;
  const allDone = dueToday.length > 0 && doneToday === dueToday.length;

  // Resumen: mejor racha activa, semana en curso y cumplimiento medio de 30 días.
  const summary = useMemo(() => {
    const weekStart = startOfWeek(today, weekStartsOn);
    const weekDays = eachDay(weekStart, addDays(weekStart, 6));
    let best: { n: number; habit: Habit } | null = null;
    let weekDone = 0;
    let weekPlanned = 0;
    const rates: number[] = [];
    for (const h of active) {
      const hl = byHabit.get(h.id) ?? [];
      if (streaksEnabled && h.streaks_enabled) {
        const n = habitStreak(h, hl, today, weekStartsOn);
        if (!best || n > best.n) best = { n, habit: h };
      }
      weekDone += hl.filter((l) => l.status === "done" && l.log_date >= weekStart && l.log_date <= today).length;
      weekPlanned += h.frequency === "weekly" ? Math.max(1, h.times_per_week ?? 1) : weekDays.filter((d) => isScheduled(h, d)).length;
      const r = compliance(h, hl, addDays(today, -29), today, today, weekStartsOn).rate;
      if (r !== null) rates.push(r);
    }
    return { best, weekDone, weekPlanned, avg: rates.length ? rates.reduce((a, r) => a + r, 0) / rates.length : null };
  }, [active, byHabit, today, weekStartsOn, streaksEnabled]);

  // Hábitos hechos en cada uno de los últimos 7 días (barras de la tarjeta destacada).
  const week7 = eachDay(addDays(today, -6), today).map((d) => ({
    d,
    done: active.filter((h) => byHabit.get(h.id)?.some((l) => l.log_date === d && l.status === "done")).length,
  }));
  const week7Max = Math.max(1, active.length, ...week7.map((w) => w.done));

  // Celebración al completar todos los hábitos del día.
  const heroBurst = useRef<HTMLSpanElement>(null);
  const prevDone = useRef(doneToday);
  useEffect(() => {
    if (allDone && doneToday > prevDone.current) burst(heroBurst.current, ["#ffffff", "var(--tone-2)", "#ffe7c2"], { count: 26, spread: 92 });
    prevDone.current = doneToday;
  }, [doneToday, allDone]);

  const left = dueToday.length - doneToday;
  const message = !dueToday.length
    ? "Hoy no toca ningún hábito. Descansar también es parte del plan."
    : allDone
      ? "¡Día redondo! Has cumplido todo lo que tocaba hoy."
      : doneToday === 0
        ? "Empieza por el más fácil: el primero es el que más cuesta."
        : `Te ${left === 1 ? "falta 1" : `faltan ${left}`}. Cada repetición cuenta.`;

  return (
    <div className="stagger">
      <PageHeader
        title="Hábitos"
        subtitle="Pequeñas acciones repetidas que, sumadas, te sacan de la media."
        action={
          <Button variant="tone" onClick={() => setCreating({})}>
            <Plus size={16} /> Nuevo hábito
          </Button>
        }
      />
      {active.length === 0 ? (
        <div className="space-y-6">
          <EmptyState
            icon={<Flame size={28} />}
            title="Crea tu primer hábito"
            action={
              <Button variant="tone" onClick={() => setCreating({})}>
                <Sparkles size={15} /> Crear mi primer hábito
              </Button>
            }
          >
            Empieza con algo pequeño: leer 10 páginas, estudiar 20 minutos, caminar.
          </EmptyState>
          <section data-reveal>
            <p className="eyebrow mb-3">Ideas para empezar</p>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {IDEAS.map((idea) => (
                <button
                  key={idea.name}
                  type="button"
                  onClick={() => setCreating(idea)}
                  className="card-glass lift group flex items-center gap-3 rounded-[22px] p-4 text-left"
                >
                  <span
                    className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-white transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
                    style={{ background: idea.color, boxShadow: `0 8px 18px -8px ${idea.color}` }}
                  >
                    <Flame size={18} aria-hidden />
                  </span>
                  <span className="min-w-0">
                    <span className="block text-sm font-semibold leading-snug">{idea.name}</span>
                    <span className="mt-0.5 block text-xs text-muted">Cada día</span>
                  </span>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="grid gap-4 lg:grid-cols-3">
            <Card variant="feature" className="flex flex-col justify-center overflow-clip lg:col-span-2">
              <span ref={heroBurst} className="pointer-events-none absolute left-[76px] top-[76px] h-0 w-0 sm:left-[80px] sm:top-1/2" aria-hidden />
              <Flame className="pointer-events-none absolute -bottom-14 -left-10 h-52 w-52 rotate-12 text-white/[0.08]" strokeWidth={1.4} aria-hidden />
              <div className="relative grid gap-5 sm:grid-cols-[auto_minmax(0,1fr)_auto] sm:items-center">
                <div className="flex items-center justify-between gap-5 sm:contents">
                  <div className="sm:col-start-1 sm:row-start-1">
                    <ProgressRing value={dueToday.length ? doneToday / dueToday.length : 0} size={112} stroke={10} color="#ffffff">
                      <span className="leading-none">
                        <span className="num-xl text-[36px]">{doneToday}</span>
                        <span className="font-display text-lg font-semibold text-white/70">/{dueToday.length}</span>
                      </span>
                    </ProgressRing>
                  </div>
                  <div className="w-40 sm:col-start-3 sm:row-start-1 sm:w-44" aria-hidden>
                    <p className="mb-2 text-right text-[10.5px] font-bold uppercase tracking-[0.12em] text-white/70">Últimos 7 días</p>
                    <div className="flex h-20 items-end gap-1.5 sm:h-24">
                      {week7.map((w, i) => (
                        <div key={w.d} className="flex h-full flex-1 flex-col items-center gap-1.5" title={`${formatLongDate(w.d)}: ${w.done}`}>
                          <div className="relative w-full max-w-[16px] flex-1 overflow-hidden rounded-full bg-white/15">
                            <div
                              className={cn("grow-up absolute inset-x-0 bottom-0 rounded-full bg-white", w.d !== today && "opacity-70")}
                              style={{ height: `${(w.done / week7Max) * 100}%`, animationDelay: `${i * 70}ms` }}
                            />
                          </div>
                          <span className={cn("text-[10px] font-semibold", w.d === today ? "text-white" : "text-white/65")}>{WEEKDAY_SHORT[weekday(w.d)]}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
                <div className="min-w-0 sm:col-start-2 sm:row-start-1">
                  <p className="eyebrow">Hoy · {formatLongDate(today)}</p>
                  <h2 className="mt-1 font-display text-[26px] font-bold leading-tight sm:text-[30px]">
                    {dueToday.length ? `${doneToday} de ${dueToday.length} para hoy` : "Día libre"}
                  </h2>
                  <p className="mt-1.5 max-w-md text-sm text-muted">{message}</p>
                  <div className="mt-4 flex flex-wrap items-center gap-2">
                    {dueToday.length > 0 && (
                      <span className="flex flex-wrap items-center gap-1.5" aria-hidden>
                        {dueToday.map((h) => {
                          const done = isDone(h);
                          return (
                            <span
                              key={h.id}
                              title={`${h.name}${done ? " ✓" : ""}`}
                              className={cn("grid h-7 w-7 place-items-center rounded-full ring-2 ring-white/50 transition-transform hover:scale-110", !done && "bg-white/20")}
                              style={done ? { background: h.color } : { boxShadow: `inset 0 0 0 2.5px ${h.color}` }}
                            >
                              {done && <Check size={13} strokeWidth={3.2} />}
                            </span>
                          );
                        })}
                      </span>
                    )}
                    {summary.avg !== null && (
                      <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-xs font-semibold ring-1 ring-inset ring-white/25">
                        <TrendingUp size={13} aria-hidden /> {Math.round(summary.avg * 100)} % en 30 días
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </Card>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-1">
              <StatTile
                icon={<Flame />}
                label="Mejor racha"
                value={
                  summary.best && summary.best.n > 0 ? (
                    <>
                      {summary.best.n}
                      <span className="ml-1.5 font-sans text-sm font-semibold tracking-normal text-muted">{streakUnit(summary.best.habit, summary.best.n)}</span>
                    </>
                  ) : (
                    "–"
                  )
                }
                footnote={streaksEnabled ? "Los descansos no la rompen" : "Rachas desactivadas"}
              />
              <StatTile
                icon={<CalendarCheck />}
                label="Esta semana"
                value={
                  <>
                    {summary.weekDone}
                    <span className="ml-1 font-sans text-sm font-semibold tracking-normal text-muted">/ {summary.weekPlanned}</span>
                  </>
                }
              >
                <ProgressBar value={summary.weekPlanned ? summary.weekDone / summary.weekPlanned : 0} size="sm" className="mt-3" label="Hábitos cumplidos esta semana" />
              </StatTile>
            </div>
          </div>

          <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
            {active.map((h, i) => (
              <HabitCard
                key={h.id}
                index={i}
                habit={h}
                logs={byHabit.get(h.id) ?? []}
                today={today}
                weekStartsOn={weekStartsOn}
                streaksEnabled={streaksEnabled && h.streaks_enabled}
                onEdit={() => setEditing(h)}
              />
            ))}
          </div>

          <div data-reveal className="flex flex-wrap items-center gap-x-4 gap-y-2.5 rounded-[22px] border border-border bg-surface/40 px-4 py-3 text-xs text-muted">
            <LegendItem state="done" label="Hecho" />
            <LegendItem state="rest" label="Descanso" />
            <LegendItem state="skipped" label="No hecho" />
            <LegendItem state={undefined} label="Vacío" />
            <span className="basis-full leading-relaxed xl:basis-auto xl:flex-1">
              Toca un día para cambiarlo: hecho → descanso → no hecho → vacío. Los descansos no rompen la racha.
            </span>
          </div>
        </div>
      )}

      {archived.length > 0 && (
        <section className="mt-8" data-reveal>
          <button
            type="button"
            onClick={() => setShowArchived(!showArchived)}
            aria-expanded={showArchived}
            className="press inline-flex items-center gap-2 rounded-full border border-border bg-surface/60 px-4 py-2 text-sm font-medium text-muted hover:border-border-strong hover:text-text"
          >
            <Archive size={15} aria-hidden />
            {showArchived ? "Ocultar" : "Ver"} archivados ({archived.length})
            <ChevronDown size={14} className={cn("transition-transform duration-300", showArchived && "rotate-180")} aria-hidden />
          </button>
          {showArchived && <ArchivedList habits={archived} />}
        </section>
      )}

      {(creating || editing) && (
        <HabitEditor
          habit={editing}
          draft={creating ?? undefined}
          categories={categories}
          onClose={() => {
            setCreating(null);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

/** Pastilla de un día con su estado: la misma en la tira, la leyenda y (en pequeño) el calendario. */
function dayClasses(s: DayState) {
  return s === "done"
    ? "border-transparent text-white"
    : s === "rest"
      ? "border-dashed border-border-strong bg-surface-2/70 text-muted"
      : s === "skipped"
        ? "border-danger/25 bg-danger-soft text-danger"
        : "border-border bg-surface/50 text-muted";
}

function DayIcon({ s, day }: { s: DayState; day?: number }) {
  if (s === "done") return <Check size={15} strokeWidth={3.2} aria-hidden />;
  if (s === "rest") return <Moon size={14} aria-hidden />;
  if (s === "skipped") return <X size={14} strokeWidth={3} aria-hidden />;
  return <span className="tabular">{day ?? "·"}</span>;
}

function LegendItem({ state, label }: { state: DayState; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className={cn("grid h-6 w-6 place-items-center rounded-lg border text-[10px] font-bold", dayClasses(state))}
        style={state === "done" ? { background: "linear-gradient(160deg, var(--tone-2), var(--tone))" } : undefined}
        aria-hidden
      >
        <DayIcon s={state} day={12} />
      </span>
      {label}
    </span>
  );
}

function ArchivedList({ habits }: { habits: Habit[] }) {
  const { run } = useAction();
  return (
    <ul className="mt-3 grid gap-2 sm:grid-cols-2">
      {habits.map((h) => (
        <li key={h.id} className="pop-in flex items-center justify-between gap-3 rounded-2xl border border-border bg-surface/50 px-3 py-2 text-sm transition-colors hover:bg-surface-2/60">
          <span className="flex min-w-0 items-center gap-2.5">
            <span className="h-2.5 w-2.5 shrink-0 rounded-full opacity-60" style={{ background: h.color }} aria-hidden />
            <span className="truncate text-muted">{h.name}</span>
          </span>
          <span className="flex shrink-0 gap-1">
            <Button variant="ghost" size="sm" onClick={() => run(() => archiveHabit(h.id, false))}>
              <ArchiveRestore size={14} /> Restaurar
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="hover:bg-danger-soft hover:text-danger"
              title="Eliminar"
              aria-label="Eliminar"
              onClick={() => confirm(`¿Eliminar "${h.name}" y todo su historial?`) && run(() => deleteHabit(h.id))}
            >
              <Trash2 size={14} />
            </Button>
          </span>
        </li>
      ))}
    </ul>
  );
}

function HabitCard({
  habit,
  logs,
  today,
  weekStartsOn,
  streaksEnabled,
  onEdit,
  index,
}: {
  habit: Habit;
  logs: HabitLog[];
  today: ISODate;
  weekStartsOn: number;
  streaksEnabled: boolean;
  onEdit: () => void;
  index: number;
}) {
  const { run, pending, error } = useAction();
  const [showCalendar, setShowCalendar] = useState(false);
  const burstRef = useRef<HTMLSpanElement>(null);
  const flashRef = useRef<HTMLSpanElement>(null);
  const map = new Map(logs.map((l) => [l.log_date, l]));
  const streak = habitStreak(habit, logs, today, weekStartsOn);
  const c30 = compliance(habit, logs, addDays(today, -29), today, today, weekStartsOn);
  const last7 = eachDay(addDays(today, -6), today);
  const todayLog = map.get(today);
  const scheduledToday = isScheduled(habit, today);
  const doneToday = todayLog?.status === "done";
  const hot = streak >= (habit.frequency === "weekly" ? 3 : 7);

  const cycle = (date: ISODate) => {
    const cur = map.get(date)?.status;
    // vacío → hecho → descanso → no hecho → vacío
    const next = cur === undefined ? "done" : cur === "done" ? "rest" : cur === "rest" ? "skipped" : null;
    if (next === "done" && date === today) flash(flashRef.current);
    run(() => setHabitLog({ habit_id: habit.id, log_date: date, status: next, value: next === "done" ? habit.target_value : null }));
  };

  const markDone = () => {
    burst(burstRef.current, [habit.color, "var(--tone)", "var(--tone-2)", "var(--gold-2)"]);
    flash(flashRef.current);
    run(() => setHabitLog({ habit_id: habit.id, log_date: today, status: "done", value: habit.target_value }));
  };

  const freqLabel =
    habit.frequency === "daily"
      ? "Cada día"
      : habit.frequency === "weekly"
        ? `${habit.times_per_week} veces por semana`
        : (habit.days_of_week ?? []).map((d) => WEEKDAY_NAME[d].slice(0, 3)).join(", ");

  return (
    <Card className="flex flex-col gap-4 overflow-clip" data-reveal={index > 1 ? String((index % 2) * 90) : undefined}>
      {/* Acento con el color del hábito */}
      <span
        className="pointer-events-none absolute inset-x-0 top-0 h-1"
        style={{ background: `linear-gradient(90deg, ${habit.color}, color-mix(in srgb, ${habit.color} 15%, transparent))` }}
        aria-hidden
      />
      <span
        className={cn("pointer-events-none absolute -right-14 -top-20 h-48 w-48 rounded-full blur-3xl transition-opacity duration-700", doneToday ? "opacity-[0.26]" : "opacity-[0.14]")}
        style={{ background: habit.color }}
        aria-hidden
      />
      <span
        ref={flashRef}
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0"
        style={{ boxShadow: `inset 0 0 0 2px ${habit.color}, inset 0 0 70px -24px ${habit.color}` }}
        aria-hidden
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3.5">
          <ProgressRing value={c30.rate ?? 0} size={60} stroke={6} color={habit.color}>
            <span className="text-[12px] font-bold tabular">{c30.rate === null ? "–" : `${Math.round(c30.rate * 100)}%`}</span>
          </ProgressRing>
          <div className="min-w-0">
            <h3 className="truncate font-display text-[17px] font-semibold leading-tight">{habit.name}</h3>
            <p className="mt-0.5 truncate text-xs text-muted">
              {freqLabel}
              {habit.target_value ? ` · ${habit.target_value} ${habit.unit ?? ""}` : ""}
            </p>
            {streaksEnabled && streak > 0 && (
              <p className="mt-1.5 inline-flex items-center gap-1.5 rounded-full bg-tone-soft py-0.5 pl-0.5 pr-2.5 text-xs font-semibold text-tone-ink">
                <span className="relative grid h-5 w-5 place-items-center">
                  {hot && <span className="animate-glow absolute inset-0 rounded-full bg-tone blur-[6px] motion-reduce:animate-none" aria-hidden />}
                  <span className="tone-chip relative h-5 w-5 rounded-full">
                    <Flame size={11} className="fill-white/50" aria-hidden />
                  </span>
                </span>
                {streak} {streakUnit(habit, streak)}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button type="button" onClick={onEdit} className="press grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text" aria-label="Editar">
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => run(() => archiveHabit(habit.id, true))}
            className="press grid h-8 w-8 place-items-center rounded-full text-muted hover:bg-surface-2 hover:text-text"
            aria-label="Archivar"
            title="Archivar"
          >
            <Archive size={14} />
          </button>
        </div>
      </div>

      <div className="relative grid grid-cols-7 gap-1.5" role="group" aria-label="Últimos 7 días">
        {last7.map((d) => {
          const s = map.get(d)?.status;
          const sched = isScheduled(habit, d);
          const isToday = d === today;
          return (
            <button
              key={d}
              type="button"
              disabled={pending}
              onClick={() => cycle(d)}
              title={`${formatLongDate(d)}: ${s === "done" ? "hecho" : s === "rest" ? "descanso" : s === "skipped" ? "no hecho" : "sin registrar"}`}
              className={cn(
                "press relative flex h-[58px] min-w-0 flex-col items-center justify-center gap-1 rounded-2xl border text-[10.5px] font-semibold transition-[background-color,border-color,box-shadow,transform,translate] duration-300 hover:-translate-y-0.5 disabled:cursor-wait",
                dayClasses(s),
                !s && "hover:border-border-strong hover:text-text",
                !sched && !s && "border-dashed opacity-45",
                isToday && "ring-2 ring-tone ring-offset-2 ring-offset-surface",
              )}
              style={
                s === "done"
                  ? { background: `linear-gradient(160deg, color-mix(in srgb, ${habit.color} 72%, #fff), ${habit.color})`, boxShadow: `0 8px 16px -8px ${habit.color}` }
                  : undefined
              }
            >
              <span className={cn("uppercase", s === "done" ? "text-white/85" : isToday && "text-tone-ink")}>{WEEKDAY_SHORT[weekday(d)]}</span>
              <span key={s ?? "empty"} className="pop-in grid h-5 place-items-center text-[13px] font-bold">
                <DayIcon s={s} day={Number(d.slice(8))} />
              </span>
            </button>
          );
        })}
      </div>

      <div className="relative flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => setShowCalendar(!showCalendar)}
          aria-expanded={showCalendar}
          className="press -ml-2 inline-flex items-center gap-1.5 rounded-full px-2.5 py-1.5 text-xs font-medium text-muted hover:bg-surface-2 hover:text-text"
        >
          <CalendarDays size={14} aria-hidden />
          {showCalendar ? "Ocultar historial" : "Ver historial"}
          <ChevronDown size={13} className={cn("transition-transform duration-300", showCalendar && "rotate-180")} aria-hidden />
        </button>
        <div className="relative">
          <span ref={burstRef} className="pointer-events-none absolute left-5 top-1/2 h-0 w-0" aria-hidden />
          {scheduledToday && !doneToday ? (
            <button
              type="button"
              disabled={pending}
              onClick={markDone}
              className="press group/done inline-flex h-11 items-center gap-2 rounded-full pl-1.5 pr-5 text-sm font-semibold text-text ring-1 ring-inset hover:brightness-105 disabled:opacity-60"
              style={{ background: `color-mix(in srgb, ${habit.color} 14%, transparent)`, ["--tw-ring-color" as string]: `color-mix(in srgb, ${habit.color} 38%, transparent)` }}
            >
              <span
                className="grid h-8 w-8 place-items-center rounded-full text-white transition-transform duration-300 group-hover/done:-rotate-12 group-hover/done:scale-110"
                style={{ background: habit.color, boxShadow: `0 6px 14px -6px ${habit.color}` }}
              >
                <Check size={16} strokeWidth={3} aria-hidden />
              </span>
              Hecho
            </button>
          ) : doneToday ? (
            <span className="pop-in inline-flex h-11 items-center gap-2 rounded-full bg-success-soft pl-1.5 pr-4 text-sm font-semibold text-success">
              <span className="grid h-8 w-8 place-items-center rounded-full bg-success text-white dark:text-bg" aria-hidden>
                <PartyPopper size={15} />
              </span>
              ¡Hecho hoy!
            </span>
          ) : (
            <span className="inline-flex h-11 items-center gap-2 rounded-full bg-surface-2/70 px-4 text-xs font-medium text-muted">
              <Coffee size={14} aria-hidden /> Hoy libre
            </span>
          )}
        </div>
      </div>
      {error && <ErrorText>{error}</ErrorText>}
      {showCalendar && <HabitCalendar habit={habit} logs={logs} today={today} weekStartsOn={weekStartsOn} />}
    </Card>
  );
}

const monthFmt = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });

function HabitCalendar({ habit, logs, today, weekStartsOn }: { habit: Habit; logs: HabitLog[]; today: ISODate; weekStartsOn: number }) {
  const weeks = 18;
  const start = startOfWeek(addDays(today, -(weeks - 1) * 7), weekStartsOn);
  const map = new Map(logs.map((l) => [l.log_date, l.status]));
  const cols: ISODate[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(eachDay(addDays(start, w * 7), addDays(start, w * 7 + 6)));
  const c90 = compliance(habit, logs, addDays(today, -89), today, today, weekStartsOn);
  const total = logs.filter((l) => l.status === "done").length;
  // Etiqueta de mes en la primera semana de cada mes (salvo en la última columna, que no cabe).
  const monthOf = (d: ISODate) => d.slice(0, 7);
  return (
    <div className="animate-in relative space-y-3 rounded-[20px] border border-border bg-surface-2/40 p-3">
      <div className="grid justify-between gap-y-[3px]" style={{ gridTemplateColumns: `repeat(${weeks}, minmax(0, 15px))` }}>
        {cols.map((col, i) => (
          <span key={`m${i}`} className="h-3 overflow-visible whitespace-nowrap text-[9px] font-medium leading-3 text-faint">
            {(i === 0 || monthOf(col[0]) !== monthOf(cols[i - 1][0])) && i < weeks - 1 ? monthFmt.format(new Date(`${col[6]}T00:00:00Z`)) : ""}
          </span>
        ))}
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((d) => {
              const s = map.get(d);
              return (
                <div
                  key={d}
                  title={`${formatLongDate(d)}${s ? ` · ${s === "done" ? "hecho" : s === "rest" ? "descanso" : "no hecho"}` : ""}`}
                  className={cn(
                    "aspect-square w-full rounded-[3px] transition-transform hover:scale-125",
                    d > today ? "opacity-0" : s === "rest" ? "bg-border-strong" : s === "skipped" ? "bg-danger/35" : !s && "bg-surface-3/80",
                    d === today && "ring-1 ring-tone ring-offset-1 ring-offset-surface",
                  )}
                  style={s === "done" && d <= today ? { backgroundColor: habit.color, boxShadow: `0 0 6px -1px ${habit.color}` } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-xl bg-surface/60 px-2 py-2">
          <p className="num-xl text-lg">{c90.rate === null ? "–" : `${Math.round(c90.rate * 100)} %`}</p>
          <p className="mt-0.5 text-[10.5px] text-muted">cumplimiento 90 días</p>
        </div>
        <div className="rounded-xl bg-surface/60 px-2 py-2">
          <p className="num-xl text-lg">
            {c90.done}/{c90.expected}
          </p>
          <p className="mt-0.5 text-[10.5px] text-muted">cumplidas en 90 días</p>
        </div>
        <div className="rounded-xl bg-surface/60 px-2 py-2">
          <p className="num-xl text-lg">{total}</p>
          <p className="mt-0.5 text-[10.5px] text-muted">{total === 1 ? "vez en total" : "veces en total"}</p>
        </div>
      </div>
    </div>
  );
}

function HabitEditor({
  habit,
  draft,
  categories,
  onClose,
}: {
  habit: Habit | null;
  draft?: { name?: string; color?: string };
  categories: Category[];
  onClose: () => void;
}) {
  const [name, setName] = useState(habit?.name ?? draft?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [frequency, setFrequency] = useState<Habit["frequency"]>(habit?.frequency ?? "daily");
  const [times, setTimes] = useState(String(habit?.times_per_week ?? 3));
  const [days, setDays] = useState<number[]>(habit?.days_of_week ?? [1, 3, 5]);
  const [target, setTarget] = useState(habit?.target_value ? String(habit.target_value) : "");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [color, setColor] = useState(habit?.color ?? draft?.color ?? COLORS[0]);
  const [category, setCategory] = useState(habit?.category_id ?? "");
  const [streaks, setStreaks] = useState(habit?.streaks_enabled ?? true);
  const { run, pending, error } = useAction();

  const submit = () => {
    const payload = {
      name,
      description: description || null,
      frequency,
      times_per_week: frequency === "weekly" ? Number(times) : null,
      days_of_week: frequency === "specific_days" ? days : null,
      target_value: target ? Number(target) : null,
      unit: unit || null,
      color,
      category_id: category || null,
      streaks_enabled: streaks,
    };
    run<unknown>(() => (habit ? updateHabit(habit.id, payload) : createHabit(payload)), onClose);
  };

  return (
    <Modal open onClose={onClose} title={habit ? "Editar hábito" : "Nuevo hábito"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
      >
        <div className="flex items-center gap-3">
          <span
            className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] text-white transition-colors duration-300"
            style={{ background: color, boxShadow: `0 10px 22px -10px ${color}` }}
            aria-hidden
          >
            <Flame size={22} />
          </span>
          <Input
            autoFocus
            required
            maxLength={60}
            placeholder="Ej.: Leer, Estudiar inglés, Dormir antes de las 23:30"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nombre"
            className="h-12 text-[15px]"
          />
        </div>
        <Textarea placeholder="¿Por qué es importante para ti? (opcional)" maxLength={500} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Descripción" />
        <Field label="Frecuencia" htmlFor="freq">
          <Select id="freq" value={frequency} onChange={(e) => setFrequency(e.target.value as Habit["frequency"])}>
            <option value="daily">Cada día</option>
            <option value="specific_days">Días concretos</option>
            <option value="weekly">X veces por semana</option>
          </Select>
        </Field>
        {frequency === "weekly" && (
          <Field label="Veces por semana" htmlFor="times">
            <Input id="times" type="number" min={1} max={7} value={times} onChange={(e) => setTimes(e.target.value)} />
          </Field>
        )}
        {frequency === "specific_days" && (
          <div className="flex flex-wrap gap-1.5" role="group" aria-label="Días">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setDays(on ? days.filter((x) => x !== d) : [...days, d])}
                  className={cn(
                    "press h-10 w-10 rounded-full text-sm font-semibold transition-colors",
                    on ? "bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_6px_14px_-6px_var(--tone)]" : "bg-surface-2 text-muted hover:text-text",
                  )}
                >
                  {WEEKDAY_SHORT[d]}
                </button>
              );
            })}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Objetivo por vez (opcional)" htmlFor="target">
            <Input id="target" type="number" min={0} step="any" placeholder="20" value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="Unidad" htmlFor="unit">
            <Input id="unit" maxLength={20} placeholder="páginas, minutos…" value={unit} onChange={(e) => setUnit(e.target.value)} />
          </Field>
        </div>
        <Field label="Categoría" htmlFor="hcat">
          <Select id="hcat" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
        </Field>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted">Color</p>
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Color">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                role="radio"
                aria-checked={color === c}
                aria-label={c}
                onClick={() => setColor(c)}
                className={cn(
                  "press grid h-8 w-8 place-items-center rounded-full text-white transition-transform hover:scale-110",
                  color === c && "scale-110 ring-2 ring-offset-2 ring-offset-surface",
                )}
                style={{ backgroundColor: c, ["--tw-ring-color" as string]: c, boxShadow: color === c ? `0 6px 14px -6px ${c}` : undefined }}
              >
                {color === c && <Check size={14} strokeWidth={3} aria-hidden />}
              </button>
            ))}
          </div>
        </div>
        <label className="flex cursor-pointer items-center gap-3 rounded-2xl border border-border bg-surface-2/40 px-3 py-2.5 text-sm hover:bg-surface-2/70">
          <input type="checkbox" checked={streaks} onChange={(e) => setStreaks(e.target.checked)} className="h-4 w-4 accent-[var(--tone)]" />
          <Flame size={15} className="text-tone" aria-hidden />
          Mostrar racha para este hábito
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" variant="tone" disabled={pending || !name.trim()}>
            {habit ? "Guardar" : "Crear hábito"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
