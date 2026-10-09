import { describe, expect, it } from "vitest";
import { addDays, eachDay, zonedDayStart, zonedParts } from "./dates";
import { periodRanges, type DailyStat } from "./stats";
import {
  bestBlock,
  bestWeekday,
  bucketize,
  calendarHeatmap,
  comparisonSentences,
  consistencyTrend,
  levelScale,
  periodComparisons,
  personalRecords,
  projectStats,
  rollingAverage,
  stalledProjects,
  weekdayHourMatrix,
  type SessionPoint,
} from "./analytics";
import { ruleBasedRecommendations, type RecommendationInput } from "./recommendations";

const day = (d: string, focusMin = 0, tasks = 0, habits = 0): DailyStat => ({
  day: d,
  focus_seconds: focusMin * 60,
  focus_sessions: focusMin ? 1 : 0,
  interruptions: 0,
  tasks_completed: tasks,
  habits_done: habits,
});

const series = (from: string, to: string, f: (d: string, i: number) => DailyStat) => eachDay(from, to).map((d, i) => f(d, i));

describe("fechas con zona horaria", () => {
  it("inicio del día local en UTC, también con horario de verano", () => {
    expect(zonedDayStart("2026-10-09", "UTC")).toBe("2026-10-09T00:00:00.000Z");
    expect(zonedDayStart("2026-10-09", "America/Mexico_City")).toBe("2026-10-09T06:00:00.000Z");
    // Madrid: verano UTC+2, invierno UTC+1 (el cambio es el 25 oct 2026).
    expect(zonedDayStart("2026-10-09", "Europe/Madrid")).toBe("2026-10-08T22:00:00.000Z");
    expect(zonedDayStart("2026-10-26", "Europe/Madrid")).toBe("2026-10-25T23:00:00.000Z");
  });
  it("partes locales de un instante", () => {
    const z = zonedParts(new Date("2026-10-09T03:30:00Z"), "America/Mexico_City");
    expect(z.date).toBe("2026-10-08");
    expect(z.weekday).toBe(4);
    expect(z.hour).toBe(21);
  });
  it("año en curso frente al mismo tramo del año anterior", () => {
    expect(periodRanges("year", "2026-10-09")).toEqual({
      current: { from: "2026-01-01", to: "2026-10-09" },
      previous: { from: "2025-01-01", to: "2025-10-09" },
    });
  });
});

describe("mapa de calor", () => {
  it("niveles por cuartiles de tus propios días activos; 0 sin actividad", () => {
    const level = levelScale([0, 10, 20, 30, 40, 50], "focus");
    expect(level(0)).toBe(0);
    expect(level(10)).toBe(1);
    expect(level(50)).toBe(4);
    expect(levelScale([], "active")(3)).toBe(4);
  });
  it("columnas por semana con relleno fuera del rango y etiquetas de mes", () => {
    const days = series("2026-09-20", "2026-10-09", (d, i) => day(d, i % 3 === 0 ? 30 : 0));
    const h = calendarHeatmap(days, "focus", "2026-09-20", "2026-10-09", 1);
    expect(h.weeks.every((w) => w.length === 7)).toBe(true);
    expect(h.weeks[0][0].day).toBe("2026-09-14"); // lunes anterior
    expect(h.weeks[0][0].inRange).toBe(false);
    expect(h.months.map((m) => m.month)).toEqual(["2026-09-01", "2026-10-01"]);
    expect(h.activeDays).toBe(7);
    expect(h.total).toBe(210);
  });
});

describe("comparativas", () => {
  it("semana, mes y año con frases honestas", () => {
    // Semana pasada (mismos días lun–vie): 60 min/día; esta semana: 75 min/día.
    const days = series("2025-01-01", "2026-10-09", (d) => {
      if (d >= "2026-10-05") return day(d, 75, 2);
      if (d >= "2026-09-28" && d <= "2026-10-02") return day(d, 60, 1);
      return day(d);
    });
    const [week, month, year] = periodComparisons(days, "2026-10-09", 1, "2025-06-01");
    expect(week.focus.current).toBe(5 * 75 * 60);
    expect(week.focus.pct).toBeCloseTo(0.25);
    expect(comparisonSentences(week)[0]).toBe("Esta semana te concentraste 6,3 h, un 25 % más que la semana anterior.");
    expect(comparisonSentences(week)[1]).toBe("Esta semana completaste 10 tareas frente a 5 en la semana anterior.");
    expect(month.previousBeforeAccount).toBe(false);
    expect(year.previousBeforeAccount).toBe(true);
  });
  it("sin base suficiente no da porcentaje", () => {
    const days = series("2026-09-28", "2026-10-09", (d) => (d === "2026-09-29" ? day(d, 5) : d === "2026-10-06" ? day(d, 120) : day(d)));
    const [week] = periodComparisons(days, "2026-10-09", 1);
    expect(comparisonSentences(week)[0]).toBe("Esta semana te concentraste 2 h (frente a 5 min en la semana anterior).");
  });
  it("agrupa por semanas y meses", () => {
    const days = series("2026-09-28", "2026-10-11", (d) => day(d, 10));
    const w = bucketize(days, "week", 1);
    expect(w.map((b) => b.key)).toEqual(["2026-09-28", "2026-10-05"]);
    expect(w[0].totals.focus_seconds).toBe(7 * 600);
    expect(bucketize(days, "month").map((b) => b.key)).toEqual(["2026-09-01", "2026-10-01"]);
  });
});

describe("tendencias y récords", () => {
  it("media móvil", () => {
    expect(rollingAverage([7, 7, 7, 0, 0, 0, 0, 7], 7)).toEqual([7, 7, 7, 5.25, 4.2, 3.5, 3, 3]);
  });
  it("constancia en 90 días; descansos y días previos a la cuenta no cuentan", () => {
    const today = "2026-10-09";
    const days = series(addDays(today, -89), today, (d, i) => day(d, i >= 45 ? 30 : i % 3 === 0 ? 30 : 0));
    const t = consistencyTrend(days, today)!;
    expect(t.trend).toBe("up");
    expect(t.recentRate).toBe(1);
    expect(t.sentence).toMatch(/^Tu constancia mejoró durante los últimos 90 días/);
    // Cuenta creada hace 20 días: la mitad anterior no tiene 14 días comparables.
    expect(consistencyTrend(days, today, [], addDays(today, -20))).toBeNull();
  });
  it("récords personales y racha más larga con descanso", () => {
    const days = [day("2026-10-01", 30), day("2026-10-02", 90, 4), day("2026-10-03"), day("2026-10-04", 20), day("2026-10-05"), day("2026-10-06", 10)];
    const r = personalRecords(days, 1, ["2026-10-03"]);
    expect(r.bestFocusDay).toEqual({ day: "2026-10-02", seconds: 5400 });
    expect(r.bestTasksDay).toEqual({ day: "2026-10-02", tasks: 4 });
    expect(r.longestActiveRun).toEqual({ from: "2026-10-01", to: "2026-10-04", days: 3 });
    expect(r.bestWeek?.from).toBe("2026-09-28");
  });
});

describe("patrones", () => {
  const s = (iso: string, min: number, extra: Partial<SessionPoint> = {}): SessionPoint => ({
    started_at: iso,
    focus_seconds: min * 60,
    status: "completed",
    category_id: null,
    project_id: null,
    ...extra,
  });
  it("matriz día × hora en la zona del usuario, sin sesiones abandonadas", () => {
    const m = weekdayHourMatrix([s("2026-10-09T03:30:00Z", 25), s("2026-10-09T15:00:00Z", 50, { status: "abandoned" })], "America/Mexico_City");
    expect(m.seconds[4][21]).toBe(1500);
    expect(m.total).toBe(1);
  });
  it("mejor franja con mínimo de sesiones", () => {
    const sessions = [s("2026-10-05T09:00:00Z", 30), s("2026-10-06T10:00:00Z", 30), s("2026-10-07T11:00:00Z", 30), s("2026-10-07T20:00:00Z", 120)];
    expect(bestBlock(sessions, "UTC")).toEqual({ start: 9, seconds: 5400, sessions: 3 });
  });
  it("mejor día de la semana solo si sobresale con 4+ semanas", () => {
    const days = series("2026-09-07", "2026-10-04", (d) => day(d, new Date(`${d}T00:00:00Z`).getUTCDay() === 2 ? 120 : 20));
    expect(bestWeekday(days)?.weekday).toBe(2);
    expect(bestWeekday(days.slice(0, 20))).toBeNull();
  });
});

describe("proyectos", () => {
  it("avance, ritmo, proyección y proyectos parados", () => {
    const today = "2026-10-09";
    const projects = [
      { id: "p1", name: "Tesis", status: "active", target_date: "2026-10-20", category_id: null, created_at: "2026-08-01T00:00:00Z" },
      { id: "p2", name: "Web", status: "active", target_date: null, category_id: null, created_at: "2026-08-01T00:00:00Z" },
      { id: "p3", name: "Nuevo", status: "active", target_date: null, category_id: null, created_at: "2026-10-08T00:00:00Z" },
    ];
    const t = (project_id: string, status: string, completed_at: string | null = null) => ({ project_id, parent_id: null, status, completed_at, actual_seconds: 600 });
    const tasks = [
      t("p1", "done", "2026-09-20T10:00:00Z"),
      t("p1", "done", "2026-10-01T10:00:00Z"),
      t("p1", "todo"),
      t("p1", "todo"),
      t("p1", "todo"),
      t("p1", "todo"),
      t("p2", "todo"),
      t("p3", "todo"),
    ];
    const sessions: SessionPoint[] = [{ started_at: "2026-10-08T10:00:00Z", focus_seconds: 1800, status: "completed", category_id: null, project_id: "p1" }];
    const stats = projectStats(projects, tasks, sessions, today, "UTC", 1, 4);
    const p1 = stats[0];
    expect(p1.tasksDone).toBe(2);
    expect(p1.progress).toBeCloseTo(1 / 3);
    expect(p1.weeklyPace).toBe(0.5);
    expect(p1.projectedFinish).toBe("2026-12-04"); // 4 pendientes / 0,5 por semana = 8 semanas
    expect(p1.onTrack).toBe(false);
    expect(p1.focusAllTime).toBe(3600);
    expect(p1.weekly).toEqual([0, 0, 0, 1800]);
    expect(stalledProjects(stats, today, "UTC").map((p) => p.id)).toEqual(["p2"]);
  });
});

describe("recomendaciones de la Fase 2", () => {
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
  it("constancia en caída, mejor día y proyectos", () => {
    const recs = ruleBasedRecommendations({
      ...base,
      consistency: { trend: "down", recentRate: 0.3, previousRate: 0.7 },
      bestWeekday: { weekday: 2, avgFocusSeconds: 7200, overallAvg: 2400 },
      stalledProjects: [{ id: "p2", name: "Web" }],
      behindProjects: [{ id: "p1", name: "Tesis", projectedFinish: "4 dic", target_date: "20 oct" }],
    });
    expect(recs.map((r) => r.id)).toEqual(["project-behind-p1", "consistency-down", "project-stalled-p2", "best-day"]);
    expect(recs.find((r) => r.id === "best-day")?.title).toBe("Los martes son tu día más productivo");
  });
  it("sin señales no recomienda nada", () => {
    expect(ruleBasedRecommendations({ ...base, consistency: null, bestWeekday: null })).toEqual([]);
  });
});
