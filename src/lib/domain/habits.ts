import { addDays, diffDays, eachDay, type ISODate, startOfWeek, weekday } from "./dates";

export type HabitFrequency = "daily" | "weekly" | "specific_days";

export type HabitLike = {
  frequency: HabitFrequency;
  times_per_week: number | null;
  days_of_week: number[] | null;
  created_at: string;
};

export type HabitLogStatus = "done" | "skipped" | "rest";
export type HabitLogLike = { log_date: ISODate; status: HabitLogStatus };

export function isScheduled(habit: HabitLike, date: ISODate): boolean {
  switch (habit.frequency) {
    case "daily":
    case "weekly":
      return true;
    case "specific_days":
      return (habit.days_of_week ?? []).includes(weekday(date));
  }
}

function logMap(logs: HabitLogLike[]): Map<ISODate, HabitLogStatus> {
  return new Map(logs.map((l) => [l.log_date, l.status]));
}

export type Compliance = {
  /** Oportunidades evaluables (días programados, o semanas × objetivo). Los descansos no cuentan. */
  expected: number;
  done: number;
  /** 0–1, o null si aún no hay nada que evaluar. */
  rate: number | null;
};

/**
 * Porcentaje de cumplimiento en [from, to]. Los días de descanso justificado se excluyen
 * del denominador, y no se evalúan días anteriores a la creación del hábito.
 * Para hábitos semanales, la semana en curso solo cuenta lo ya cumplido (no penaliza lo que aún puede hacerse).
 */
export function compliance(
  habit: HabitLike,
  logs: HabitLogLike[],
  from: ISODate,
  to: ISODate,
  today: ISODate,
  weekStartsOn = 1,
): Compliance {
  const created = habit.created_at.slice(0, 10);
  const start = from < created ? created : from;
  const end = to > today ? today : to;
  if (start > end) return { expected: 0, done: 0, rate: null };
  const map = logMap(logs);

  if (habit.frequency === "weekly") {
    const target = Math.max(1, habit.times_per_week ?? 1);
    let expected = 0;
    let done = 0;
    for (let ws = startOfWeek(start, weekStartsOn); ws <= end; ws = addDays(ws, 7)) {
      const days = eachDay(ws < start ? start : ws, addDays(ws, 6) > end ? end : addDays(ws, 6));
      const doneCount = days.filter((d) => map.get(d) === "done").length;
      const restCount = days.filter((d) => map.get(d) === "rest").length;
      const weekTarget = Math.max(0, target - restCount);
      const weekComplete = addDays(ws, 6) <= end && addDays(ws, 6) < today;
      if (weekComplete) {
        expected += weekTarget;
        done += Math.min(doneCount, weekTarget);
      } else {
        // Semana en curso: solo suma lo hecho (hasta el objetivo) al numerador y denominador.
        const counted = Math.min(doneCount, weekTarget);
        expected += counted;
        done += counted;
      }
    }
    return { expected, done, rate: expected ? done / expected : null };
  }

  let expected = 0;
  let done = 0;
  for (const d of eachDay(start, end)) {
    if (!isScheduled(habit, d)) continue;
    const s = map.get(d);
    if (s === "rest") continue;
    if (d === today && s !== "done") continue; // hoy aún no terminó
    expected++;
    if (s === "done") done++;
  }
  return { expected, done, rate: expected ? done / expected : null };
}

/**
 * Racha del hábito en "oportunidades" consecutivas cumplidas (días programados o semanas).
 * Descansos justificados no la rompen. Hoy / esta semana sin completar tampoco.
 */
export function habitStreak(habit: HabitLike, logs: HabitLogLike[], today: ISODate, weekStartsOn = 1): number {
  const map = logMap(logs);
  const created = habit.created_at.slice(0, 10);

  if (habit.frequency === "weekly") {
    const target = Math.max(1, habit.times_per_week ?? 1);
    let streak = 0;
    let ws = startOfWeek(today, weekStartsOn);
    for (let i = 0; i < 520; i++) {
      const days = eachDay(ws, addDays(ws, 6));
      const doneCount = days.filter((d) => map.get(d) === "done").length;
      const restCount = days.filter((d) => map.get(d) === "rest").length;
      const met = doneCount >= Math.max(0, target - restCount) && doneCount + restCount > 0;
      const inProgress = ws === startOfWeek(today, weekStartsOn);
      if (met) streak++;
      else if (!inProgress) break;
      ws = addDays(ws, -7);
      if (addDays(ws, 6) < created) break;
    }
    return streak;
  }

  let streak = 0;
  let d = today;
  for (let i = 0; i < 1500 && d >= created; i++, d = addDays(d, -1)) {
    if (!isScheduled(habit, d)) continue;
    const s = map.get(d);
    if (s === "done") streak++;
    else if (s === "rest") continue;
    else if (d === today) continue;
    else break;
  }
  return streak;
}

/** Cambio de cumplimiento entre los últimos `window` días y los `window` anteriores. */
export function complianceTrend(
  habit: HabitLike,
  logs: HabitLogLike[],
  today: ISODate,
  window = 14,
): { recent: number | null; previous: number | null; delta: number | null } {
  const recent = compliance(habit, logs, addDays(today, -(window - 1)), today, today).rate;
  const previous = compliance(habit, logs, addDays(today, -(2 * window - 1)), addDays(today, -window), today).rate;
  const enoughHistory = diffDays(today, habit.created_at.slice(0, 10)) >= 2 * window - 1;
  return {
    recent,
    previous: enoughHistory ? previous : null,
    delta: enoughHistory && recent !== null && previous !== null ? recent - previous : null,
  };
}
