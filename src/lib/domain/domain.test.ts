import { describe, expect, it } from "vitest";
import { addMonths, localDate, startOfWeek, weekday } from "./dates";
import { nextOccurrence } from "./recurrence";
import { consistencyStreak } from "./streaks";
import { compliance, habitStreak, type HabitLike } from "./habits";
import { compare, describeChange, estimateAccuracy, periodRanges, previousRange, totals } from "./stats";
import { breakAfter, DEFAULT_POMODORO, elapsedSeconds, formatClock, normalizePomodoro, remainingSeconds } from "./timer";
import { goalProgress, goalRange } from "./goals";
import { suggestBreakdown } from "./breakdown";
import { ruleBasedRecommendations, type RecommendationInput } from "./recommendations";

describe("dates", () => {
  it("calcula la fecha local por zona horaria", () => {
    const instant = new Date("2026-10-09T03:30:00Z");
    expect(localDate(instant, "UTC")).toBe("2026-10-09");
    expect(localDate(instant, "America/Mexico_City")).toBe("2026-10-08");
  });
  it("suma meses respetando fin de mes", () => {
    expect(addMonths("2026-01-31", 1)).toBe("2026-02-28");
    expect(addMonths("2026-12-15", 1)).toBe("2027-01-15");
  });
  it("inicio de semana configurable", () => {
    expect(weekday("2026-10-09")).toBe(5); // viernes
    expect(startOfWeek("2026-10-09", 1)).toBe("2026-10-05");
    expect(startOfWeek("2026-10-09", 0)).toBe("2026-10-04");
  });
});

describe("recurrencia", () => {
  it("diaria, mensual y semanal", () => {
    expect(nextOccurrence({ freq: "daily", interval: 1 }, "2026-10-09")).toBe("2026-10-10");
    expect(nextOccurrence({ freq: "daily", interval: 3 }, "2026-10-09")).toBe("2026-10-12");
    expect(nextOccurrence({ freq: "monthly", interval: 1 }, "2026-01-31")).toBe("2026-02-28");
    expect(nextOccurrence({ freq: "weekly", interval: 1 }, "2026-10-09")).toBe("2026-10-16");
  });
  it("semanal con días concretos", () => {
    // viernes → siguiente lunes/miércoles/viernes = lunes 12
    expect(nextOccurrence({ freq: "weekly", interval: 1, weekdays: [1, 3, 5] }, "2026-10-09")).toBe("2026-10-12");
    // lunes → miércoles
    expect(nextOccurrence({ freq: "weekly", interval: 1, weekdays: [1, 3, 5] }, "2026-10-12")).toBe("2026-10-14");
    // cada 2 semanas, solo lunes: lunes 12 → lunes 26
    expect(nextOccurrence({ freq: "weekly", interval: 2, weekdays: [1] }, "2026-10-12")).toBe("2026-10-26");
  });
});

describe("racha de constancia", () => {
  it("cuenta días seguidos y hoy sin actividad no rompe", () => {
    const r = consistencyStreak(["2026-10-06", "2026-10-07", "2026-10-08"], [], "2026-10-09");
    expect(r.current).toBe(3);
    expect(r.pendingToday).toBe(true);
  });
  it("un día de descanso no rompe la racha; un hueco sí", () => {
    const active = ["2026-10-03", "2026-10-04", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09"];
    expect(consistencyStreak(active, ["2026-10-05"], "2026-10-09").current).toBe(6);
    const r = consistencyStreak(active, [], "2026-10-09");
    expect(r.current).toBe(4);
    expect(r.longest).toBe(4);
  });
  it("sin actividad reciente la racha es 0", () => {
    expect(consistencyStreak(["2026-10-01"], [], "2026-10-09").current).toBe(0);
  });
});

describe("hábitos", () => {
  const daily: HabitLike = { frequency: "daily", times_per_week: null, days_of_week: null, created_at: "2026-10-01T10:00:00Z" };
  it("cumplimiento diario excluye descansos y hoy pendiente", () => {
    const logs = [
      { log_date: "2026-10-01", status: "done" as const },
      { log_date: "2026-10-02", status: "done" as const },
      { log_date: "2026-10-03", status: "rest" as const },
      { log_date: "2026-10-05", status: "done" as const },
    ];
    // 1..5 programados, 3 es descanso, hoy (5) hecho → esperados 4 (1,2,4,5), hechos 3
    const c = compliance(daily, logs, "2026-09-01", "2026-10-05", "2026-10-05");
    expect(c).toEqual({ expected: 4, done: 3, rate: 0.75 });
  });
  it("días específicos solo cuentan los programados", () => {
    const h: HabitLike = { ...daily, frequency: "specific_days", days_of_week: [1, 3, 5] };
    // 2026-10-05 lun, 07 mié, 09 vie
    const logs = [
      { log_date: "2026-10-05", status: "done" as const },
      { log_date: "2026-10-07", status: "done" as const },
    ];
    expect(compliance(h, logs, "2026-10-05", "2026-10-09", "2026-10-09")).toEqual({ expected: 2, done: 2, rate: 1 });
    expect(habitStreak(h, logs, "2026-10-09")).toBe(2);
    expect(habitStreak(h, logs, "2026-10-10")).toBe(0); // el viernes no se hizo
  });
  it("racha diaria con descanso", () => {
    const logs = [
      { log_date: "2026-10-06", status: "done" as const },
      { log_date: "2026-10-07", status: "rest" as const },
      { log_date: "2026-10-08", status: "done" as const },
    ];
    expect(habitStreak(daily, logs, "2026-10-09")).toBe(2);
  });
  it("semanal: X veces por semana", () => {
    const h: HabitLike = { ...daily, frequency: "weekly", times_per_week: 2, created_at: "2026-09-28T00:00:00Z" };
    const logs = [
      { log_date: "2026-09-29", status: "done" as const },
      { log_date: "2026-10-01", status: "done" as const },
      { log_date: "2026-10-06", status: "done" as const },
    ];
    // semana 28/9 completa y cumplida (2/2); semana en curso: 1 hecho cuenta 1/1
    expect(compliance(h, logs, "2026-09-28", "2026-10-09", "2026-10-09")).toEqual({ expected: 3, done: 3, rate: 1 });
    expect(habitStreak(h, logs, "2026-10-09")).toBe(1);
  });
});

describe("estadísticas", () => {
  it("compara sin inventar porcentajes", () => {
    expect(compare(15, 12)).toMatchObject({ delta: 3, pct: 0.25, trend: "up" });
    expect(compare(5, 0).pct).toBeNull();
    expect(describeChange(compare(15, 12), "la semana anterior")).toBe("Un 25 % más que la semana anterior");
    expect(describeChange(compare(5, 0), "la semana anterior")).toBe("Sin datos la semana anterior para comparar");
  });
  it("rangos comparables recortados", () => {
    expect(periodRanges("week", "2026-10-07", 1)).toEqual({
      current: { from: "2026-10-05", to: "2026-10-07" },
      previous: { from: "2026-09-28", to: "2026-09-30" },
    });
    expect(periodRanges("month", "2026-03-31")).toEqual({
      current: { from: "2026-03-01", to: "2026-03-31" },
      previous: { from: "2026-02-01", to: "2026-02-28" },
    });
    expect(previousRange({ from: "2026-10-01", to: "2026-10-10" })).toEqual({ from: "2026-09-21", to: "2026-09-30" });
  });
  it("totales y días activos", () => {
    const t = totals([
      { day: "2026-10-01", focus_seconds: 1800, focus_sessions: 1, interruptions: 0, tasks_completed: 0, habits_done: 0 },
      { day: "2026-10-02", focus_seconds: 30, focus_sessions: 1, interruptions: 1, tasks_completed: 0, habits_done: 0 },
      { day: "2026-10-03", focus_seconds: 0, focus_sessions: 0, interruptions: 0, tasks_completed: 2, habits_done: 1 },
    ]);
    expect(t).toMatchObject({ focus_seconds: 1830, tasks_completed: 2, active_days: 2, days: 3 });
  });
  it("precisión de estimaciones", () => {
    expect(estimateAccuracy([{ estimated_minutes: 30, actual_seconds: 2700 }, { estimated_minutes: null, actual_seconds: 100 }])).toEqual({
      ratio: 1.5,
      sample: 1,
    });
    expect(estimateAccuracy([])).toBeNull();
  });
});

describe("temporizador", () => {
  const start = "2026-10-09T10:00:00.000Z";
  const now = Date.parse("2026-10-09T10:20:00.000Z");
  it("reconstruye el tiempo desde timestamps del servidor", () => {
    expect(elapsedSeconds({ status: "running", started_at: start, paused_at: null, paused_seconds: 120, planned_seconds: 1500 }, now)).toBe(1080);
    expect(
      elapsedSeconds({ status: "paused", started_at: start, paused_at: "2026-10-09T10:10:00.000Z", paused_seconds: 0, planned_seconds: null }, now),
    ).toBe(600);
    expect(remainingSeconds({ status: "running", started_at: start, paused_at: null, paused_seconds: 0, planned_seconds: 1500 }, now)).toBe(300);
    expect(formatClock(3725)).toBe("1:02:05");
    expect(formatClock(65)).toBe("01:05");
  });
  it("pomodoro: descansos y ajustes saneados", () => {
    expect(breakAfter(DEFAULT_POMODORO, 1)).toEqual({ minutes: 5, long: false });
    expect(breakAfter(DEFAULT_POMODORO, 4)).toEqual({ minutes: 15, long: true });
    expect(normalizePomodoro({ focus_minutes: 9999, short_break_minutes: "abc" })).toMatchObject({
      focus_minutes: 180,
      short_break_minutes: 5,
    });
  });
});

describe("objetivos", () => {
  it("rango y progreso", () => {
    expect(goalRange({ period: "weekly", start_date: null, end_date: null }, "2026-10-09")).toEqual({ from: "2026-10-05", to: "2026-10-11" });
    const g = { metric: "focus_minutes" as const, period: "weekly" as const, start_date: null, end_date: null, target_value: 600, manual_value: 0, category_id: null };
    expect(goalProgress(g, 300)).toEqual({ value: 300, target: 600, ratio: 0.5, achieved: false });
    expect(goalProgress({ ...g, metric: "manual", manual_value: 700 }, 0).achieved).toBe(true);
  });
});

describe("Just Start", () => {
  it("propone pasos según el tipo de tarea", () => {
    expect(suggestBreakdown("Estudiar tema 4 de historia").firstStep).toMatch(/material/);
    expect(suggestBreakdown("Hacer ejercicio").firstStep).toMatch(/ropa de deporte/);
    expect(suggestBreakdown("Resolver 30 ejercicios de cálculo").firstStep).toMatch(/enunciado/);
    expect(suggestBreakdown("Algo raro").steps.length).toBeGreaterThan(2);
  });
});

describe("recomendaciones", () => {
  const base: RecommendationInput = {
    postponedTasks: [],
    completedTasksWithEstimates: [],
    hourly: [],
    habitTrends: [],
    recentSessions: [],
    overdueCount: 0,
    interruptionsLast14: 0,
    focusSessionsLast14: 0,
    activeDaysLast14: 0,
  };
  it("sin datos no inventa recomendaciones", () => {
    expect(ruleBasedRecommendations(base)).toEqual([]);
  });
  it("detecta procrastinación, estimaciones y mejor horario con evidencia", () => {
    const recs = ruleBasedRecommendations({
      ...base,
      postponedTasks: [{ id: "t1", title: "Informe", postponed_count: 3 }],
      completedTasksWithEstimates: Array.from({ length: 3 }, () => ({ estimated_minutes: 30, actual_seconds: 3600 })),
      hourly: [
        { hour: 9, focus_seconds: 3000 * 4, focus_sessions: 4 },
        { hour: 21, focus_seconds: 600 * 5, focus_sessions: 5 },
      ],
    });
    expect(recs.map((r) => r.kind)).toEqual(["procrastination", "estimates", "best_time"]);
    expect(recs[0].evidence).toMatch(/3 veces/);
    expect(recs[2].title).toMatch(/9:00 y las 12:00/);
  });
  it("detecta hábitos en caída y dificultad para empezar", () => {
    const recs = ruleBasedRecommendations({
      ...base,
      habitTrends: [{ id: "h", name: "Leer", recent: 0.3, previous: 0.9, delta: -0.6 }],
      recentSessions: [
        { status: "abandoned", focus_seconds: 60 },
        { status: "abandoned", focus_seconds: 60 },
        { status: "completed", focus_seconds: 1500 },
        { status: "completed", focus_seconds: 1500 },
      ],
    });
    expect(recs.map((r) => r.kind)).toEqual(["small_start", "habit_decline"]);
  });
});
