"use client";

import { useMemo, useState } from "react";
import { Archive, ArchiveRestore, Check, Flame, Moon, Pencil, Plus, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { addDays, eachDay, type ISODate, startOfWeek, weekday } from "@/lib/domain/dates";
import { compliance, habitStreak, isScheduled } from "@/lib/domain/habits";
import { formatLongDate, WEEKDAY_NAME, WEEKDAY_SHORT } from "@/lib/format";
import type { Category, Habit, HabitLog } from "@/lib/types";
import { archiveHabit, createHabit, deleteHabit, setHabitLog, updateHabit } from "@/app/(app)/habits/actions";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, ProgressRing } from "@/components/ui/card";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/components/tasks/use-action";

const COLORS = ["#10b981", "#6366f1", "#0ea5e9", "#f59e0b", "#ec4899", "#ef4444", "#8b5cf6", "#14b8a6"];

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
  const [creating, setCreating] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const byHabit = useMemo(() => {
    const m = new Map<string, HabitLog[]>();
    for (const l of logs) m.set(l.habit_id, [...(m.get(l.habit_id) ?? []), l]);
    return m;
  }, [logs]);

  const active = habits.filter((h) => !h.archived_at);
  const archived = habits.filter((h) => h.archived_at);
  const dueToday = active.filter((h) => isScheduled(h, today));
  const doneToday = dueToday.filter((h) => byHabit.get(h.id)?.some((l) => l.log_date === today && l.status === "done")).length;

  return (
    <div>
      <PageHeader
        title="Hábitos"
        subtitle={dueToday.length ? `${doneToday} de ${dueToday.length} para hoy` : "Pequeñas acciones repetidas"}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nuevo hábito
          </Button>
        }
      />
      {active.length === 0 ? (
        <EmptyState icon={<Flame size={28} />} title="Crea tu primer hábito">
          Empieza con algo pequeño: leer 10 páginas, estudiar 20 minutos, caminar.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {active.map((h) => (
            <HabitCard
              key={h.id}
              habit={h}
              logs={byHabit.get(h.id) ?? []}
              today={today}
              weekStartsOn={weekStartsOn}
              streaksEnabled={streaksEnabled && h.streaks_enabled}
              onEdit={() => setEditing(h)}
            />
          ))}
        </div>
      )}

      {archived.length > 0 && (
        <div className="mt-8">
          <button type="button" onClick={() => setShowArchived(!showArchived)} className="text-sm text-muted hover:text-text">
            {showArchived ? "Ocultar" : "Ver"} archivados ({archived.length})
          </button>
          {showArchived && <ArchivedList habits={archived} />}
        </div>
      )}

      {(creating || editing) && (
        <HabitEditor
          habit={editing}
          categories={categories}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}

function ArchivedList({ habits }: { habits: Habit[] }) {
  const { run } = useAction();
  return (
    <ul className="mt-3 space-y-2">
      {habits.map((h) => (
        <li key={h.id} className="flex items-center justify-between rounded-xl border border-border bg-surface px-3 py-2 text-sm">
          <span className="text-muted">{h.name}</span>
          <span className="flex gap-1">
            <Button variant="ghost" size="sm" onClick={() => run(() => archiveHabit(h.id, false))}>
              <ArchiveRestore size={14} /> Restaurar
            </Button>
            <Button
              variant="ghost"
              size="sm"
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
}: {
  habit: Habit;
  logs: HabitLog[];
  today: ISODate;
  weekStartsOn: number;
  streaksEnabled: boolean;
  onEdit: () => void;
}) {
  const { run, pending, error } = useAction();
  const [showCalendar, setShowCalendar] = useState(false);
  const map = new Map(logs.map((l) => [l.log_date, l]));
  const streak = habitStreak(habit, logs, today, weekStartsOn);
  const c30 = compliance(habit, logs, addDays(today, -29), today, today, weekStartsOn);
  const last7 = eachDay(addDays(today, -6), today);
  const todayLog = map.get(today);
  const scheduledToday = isScheduled(habit, today);

  const cycle = (date: ISODate) => {
    const cur = map.get(date)?.status;
    // vacío → hecho → descanso → no hecho → vacío
    const next = cur === undefined ? "done" : cur === "done" ? "rest" : cur === "rest" ? "skipped" : null;
    run(() => setHabitLog({ habit_id: habit.id, log_date: date, status: next, value: next === "done" ? habit.target_value : null }));
  };

  const freqLabel =
    habit.frequency === "daily"
      ? "Cada día"
      : habit.frequency === "weekly"
        ? `${habit.times_per_week} veces por semana`
        : (habit.days_of_week ?? []).map((d) => WEEKDAY_NAME[d].slice(0, 3)).join(", ");

  return (
    <Card className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <ProgressRing value={c30.rate ?? 0} size={48} stroke={5} color={habit.color}>
            <span className="text-[11px] font-semibold tabular">{c30.rate === null ? "–" : `${Math.round(c30.rate * 100)}%`}</span>
          </ProgressRing>
          <div className="min-w-0">
            <h3 className="truncate font-medium">{habit.name}</h3>
            <p className="text-xs text-muted">
              {freqLabel}
              {habit.target_value ? ` · ${habit.target_value} ${habit.unit ?? ""}` : ""}
            </p>
            {streaksEnabled && streak > 0 && (
              <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-medium text-warning">
                <Flame size={12} /> {streak} {habit.frequency === "weekly" ? (streak === 1 ? "semana" : "semanas") : streak === 1 ? "vez seguida" : "seguidas"}
              </p>
            )}
          </div>
        </div>
        <div className="flex shrink-0 gap-0.5">
          <button type="button" onClick={onEdit} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" aria-label="Editar">
            <Pencil size={14} />
          </button>
          <button
            type="button"
            onClick={() => run(() => archiveHabit(habit.id, true))}
            className="rounded-lg p-1.5 text-muted hover:bg-surface-2"
            aria-label="Archivar"
            title="Archivar"
          >
            <Archive size={14} />
          </button>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-1.5" aria-label="Últimos 7 días">
          {last7.map((d) => {
            const s = map.get(d)?.status;
            const sched = isScheduled(habit, d);
            return (
              <button
                key={d}
                type="button"
                disabled={pending}
                onClick={() => cycle(d)}
                title={`${formatLongDate(d)}: ${s === "done" ? "hecho" : s === "rest" ? "descanso" : s === "skipped" ? "no hecho" : "sin registrar"}`}
                className={cn(
                  "flex h-9 w-8 flex-col items-center justify-center rounded-lg text-[10px] transition-colors",
                  s === "done" ? "text-white" : s === "rest" ? "bg-surface-2 text-muted" : s === "skipped" ? "bg-danger-soft text-danger" : "bg-surface-2/60 text-muted",
                  !sched && !s && "opacity-40",
                  d === today && "ring-1 ring-accent",
                )}
                style={s === "done" ? { backgroundColor: habit.color } : undefined}
              >
                <span>{WEEKDAY_SHORT[weekday(d)]}</span>
                {s === "done" ? <Check size={11} strokeWidth={3} /> : s === "rest" ? <Moon size={10} /> : <span>{Number(d.slice(8))}</span>}
              </button>
            );
          })}
        </div>
        {scheduledToday && todayLog?.status !== "done" ? (
          <Button size="sm" disabled={pending} onClick={() => run(() => setHabitLog({ habit_id: habit.id, log_date: today, status: "done", value: habit.target_value }))}>
            <Check size={14} /> Hecho
          </Button>
        ) : todayLog?.status === "done" ? (
          <span className="text-xs font-medium text-success">¡Hecho hoy!</span>
        ) : (
          <span className="text-xs text-muted">Hoy libre</span>
        )}
      </div>
      {error && <ErrorText>{error}</ErrorText>}

      <button type="button" onClick={() => setShowCalendar(!showCalendar)} className="self-start text-xs text-muted hover:text-text">
        {showCalendar ? "Ocultar historial" : "Ver historial"}
      </button>
      {showCalendar && <HabitCalendar habit={habit} logs={logs} today={today} weekStartsOn={weekStartsOn} />}
      <p className="text-[11px] text-muted">Toca un día para cambiarlo: hecho → descanso → no hecho → vacío. Los descansos no rompen la racha.</p>
    </Card>
  );
}

function HabitCalendar({ habit, logs, today, weekStartsOn }: { habit: Habit; logs: HabitLog[]; today: ISODate; weekStartsOn: number }) {
  const weeks = 18;
  const start = startOfWeek(addDays(today, -(weeks - 1) * 7), weekStartsOn);
  const map = new Map(logs.map((l) => [l.log_date, l.status]));
  const cols: ISODate[][] = [];
  for (let w = 0; w < weeks; w++) cols.push(eachDay(addDays(start, w * 7), addDays(start, w * 7 + 6)));
  const c90 = compliance(habit, logs, addDays(today, -89), today, today, weekStartsOn);
  const total = logs.filter((l) => l.status === "done").length;
  return (
    <div className="space-y-2">
      <div className="flex gap-[3px] overflow-x-auto pb-1">
        {cols.map((col, i) => (
          <div key={i} className="flex flex-col gap-[3px]">
            {col.map((d) => {
              const s = map.get(d);
              return (
                <div
                  key={d}
                  title={`${formatLongDate(d)}${s ? ` · ${s === "done" ? "hecho" : s === "rest" ? "descanso" : "no hecho"}` : ""}`}
                  className={cn("h-3 w-3 rounded-[3px]", d > today ? "opacity-0" : s === "rest" ? "bg-border" : s === "skipped" ? "bg-danger-soft" : "bg-surface-2")}
                  style={s === "done" ? { backgroundColor: habit.color } : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
      <p className="text-xs text-muted">
        90 días: {c90.rate === null ? "sin datos" : `${Math.round(c90.rate * 100)} % de cumplimiento (${c90.done}/${c90.expected})`} · {total} {total === 1 ? "vez" : "veces"} en total
      </p>
    </div>
  );
}

function HabitEditor({ habit, categories, onClose }: { habit: Habit | null; categories: Category[]; onClose: () => void }) {
  const [name, setName] = useState(habit?.name ?? "");
  const [description, setDescription] = useState(habit?.description ?? "");
  const [frequency, setFrequency] = useState<Habit["frequency"]>(habit?.frequency ?? "daily");
  const [times, setTimes] = useState(String(habit?.times_per_week ?? 3));
  const [days, setDays] = useState<number[]>(habit?.days_of_week ?? [1, 3, 5]);
  const [target, setTarget] = useState(habit?.target_value ? String(habit.target_value) : "");
  const [unit, setUnit] = useState(habit?.unit ?? "");
  const [color, setColor] = useState(habit?.color ?? COLORS[0]);
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
        <Input autoFocus required maxLength={60} placeholder="Ej.: Leer, Estudiar inglés, Dormir antes de las 23:30" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
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
          <div className="flex gap-1.5" role="group" aria-label="Días">
            {[1, 2, 3, 4, 5, 6, 0].map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => setDays(days.includes(d) ? days.filter((x) => x !== d) : [...days, d])}
                className={cn("h-9 w-9 rounded-full text-sm", days.includes(d) ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}
              >
                {WEEKDAY_SHORT[d]}
              </button>
            ))}
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
        <div className="flex gap-2" role="radiogroup" aria-label="Color">
          {COLORS.map((c) => (
            <button
              key={c}
              type="button"
              role="radio"
              aria-checked={color === c}
              aria-label={c}
              onClick={() => setColor(c)}
              className={cn("h-7 w-7 rounded-full", color === c && "ring-2 ring-offset-2 ring-offset-surface")}
              style={{ backgroundColor: c, ["--tw-ring-color" as string]: c }}
            />
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={streaks} onChange={(e) => setStreaks(e.target.checked)} />
          Mostrar racha para este hábito
        </label>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !name.trim()}>
            {habit ? "Guardar" : "Crear hábito"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
