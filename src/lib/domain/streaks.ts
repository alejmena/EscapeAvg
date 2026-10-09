import { addDays, type ISODate } from "./dates";

export type StreakResult = {
  current: number;
  longest: number;
  /** true si hoy todavía no hay actividad pero la racha sigue viva (se puede mantener hoy). */
  pendingToday: boolean;
};

/**
 * Racha de constancia: días consecutivos con actividad real.
 * - Los días de descanso (`restDays`) son neutros: ni suman ni rompen la racha.
 * - Hoy sin actividad no rompe la racha (el día no ha terminado).
 */
export function consistencyStreak(
  activeDays: Iterable<ISODate>,
  restDays: Iterable<ISODate>,
  today: ISODate,
  lookbackDays = 730,
): StreakResult {
  const active = new Set(activeDays);
  const rest = new Set(restDays);

  let current = 0;
  let cursor = today;
  const pendingToday = !active.has(today);
  if (pendingToday) cursor = addDays(today, -1);
  for (let i = 0; i < lookbackDays; i++) {
    if (active.has(cursor)) current++;
    else if (!rest.has(cursor)) break;
    cursor = addDays(cursor, -1);
  }

  let longest = 0;
  let run = 0;
  const sorted = [...active].filter((d) => d <= today).sort();
  if (sorted.length) {
    for (let d = sorted[0]; d <= today; d = addDays(d, 1)) {
      if (active.has(d)) {
        run++;
        longest = Math.max(longest, run);
      } else if (!rest.has(d) && d !== today) {
        run = 0;
      }
    }
  }
  return { current, longest: Math.max(longest, current), pendingToday: pendingToday && current > 0 };
}
