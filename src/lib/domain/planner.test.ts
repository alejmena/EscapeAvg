import { describe, expect, it } from "vitest";
import { addDays, eachDay } from "./dates";
import { dailyCapacity, planDay, scoreTask, taskMinutes, weeklyReview, type PlannerTask } from "./planner";
import type { DailyStat } from "./stats";

const TODAY = "2026-10-09"; // viernes

const day = (d: string, focusMin: number, tasks = 0, habits = 0): DailyStat => ({
  day: d,
  focus_seconds: focusMin * 60,
  focus_sessions: focusMin > 0 ? 1 : 0,
  interruptions: 0,
  tasks_completed: tasks,
  habits_done: habits,
});

const task = (id: string, extra: Partial<PlannerTask> = {}): PlannerTask => ({
  id,
  title: id,
  priority: 0,
  status: "todo",
  due_date: null,
  estimated_minutes: null,
  actual_seconds: 0,
  postponed_count: 0,
  project_id: null,
  created_at: `${TODAY}T08:00:00Z`,
  ...extra,
});

const history = (minutes: (d: string) => number) => eachDay(addDays(TODAY, -28), TODAY).map((d) => day(d, d === TODAY ? 0 : minutes(d)));

describe("capacidad diaria", () => {
  it("usa la mediana de tus días activos y el día de la semana", () => {
    expect(dailyCapacity([], TODAY)).toEqual({ minutes: 60, source: "default" });
    expect(dailyCapacity(history(() => 90), TODAY)).toEqual({ minutes: 90, source: "weekday" });
    // Los viernes rindes más: se mezcla con la media general.
    const thursdays = history((d) => (new Date(`${d}T00:00:00Z`).getUTCDay() === 5 ? 150 : 90));
    expect(dailyCapacity(thursdays, TODAY).minutes).toBe(120);
  });

  it("corrige estimaciones con tu precisión histórica", () => {
    expect(taskMinutes(task("a"), null)).toBe(25);
    expect(taskMinutes(task("a", { estimated_minutes: 30 }), 1.5)).toBe(45);
    expect(taskMinutes(task("a", { estimated_minutes: 60, actual_seconds: 50 * 60 }), 1)).toBe(10);
  });
});

describe("plan del día", () => {
  it("prioriza lo vencido y lo de hoy, explica por qué y no se pasa de tu ritmo", () => {
    expect(scoreTask(task("v", { due_date: addDays(TODAY, -2) }), TODAY)).toMatchObject({ mustDo: true, reasons: ["Vencida hace 2 días"] });
    const plan = planDay({
      today: TODAY,
      hour: 9,
      tasks: [
        task("sin-fecha", { estimated_minutes: 30 }),
        task("hoy", { due_date: TODAY, estimated_minutes: 30 }),
        task("alta", { priority: 3, estimated_minutes: 30 }),
        task("vencida", { due_date: addDays(TODAY, -1), estimated_minutes: 30, postponed_count: 3 }),
      ],
      daily: history(() => 90),
      estimateRatio: null,
      bestBlockStart: 9,
      pendingHabits: [],
    });
    expect(plan.items.map((i) => i.task.id)).toEqual(["vencida", "hoy", "alta"]);
    expect(plan.plannedMinutes).toBe(90);
    expect(plan.items[0].justStart).toBe(true);
    expect(plan.items[0].reasons).toEqual(["Venció ayer", "Pospuesta 3 veces"]);
    expect(plan.tips.some((t) => t.includes("9:00–12:00"))).toBe(true);
  });

  it("avisa si lo que vence hoy no cabe", () => {
    const plan = planDay({
      today: TODAY,
      hour: 9,
      tasks: [1, 2, 3].map((n) => task(`t${n}`, { due_date: TODAY, estimated_minutes: 60 })),
      daily: history(() => 90),
      estimateRatio: null,
      bestBlockStart: null,
      pendingHabits: [],
    });
    expect(plan.items).toHaveLength(1);
    expect(plan.deferred).toHaveLength(2);
    expect(plan.tips[0]).toContain("2 tareas con fecha que no caben");
  });

  it("si ya cumpliste tu ritmo, no propone más que lo urgente", () => {
    const daily = history(() => 60).map((d) => (d.day === TODAY ? day(TODAY, 70) : d));
    const plan = planDay({ today: TODAY, hour: 15, tasks: [task("x")], daily, estimateRatio: null, bestBlockStart: null, pendingHabits: [] });
    expect(plan.remainingMinutes).toBe(0);
    expect(plan.items).toHaveLength(0);
    expect(plan.headline).toContain("Lo que sigue es extra");
  });
});

describe("resumen semanal", () => {
  const week = { from: "2026-09-28", to: "2026-10-04" };
  const days = (mins: number[]) => eachDay(week.from, week.to).map((d, i) => day(d, mins[i] ?? 0, mins[i] ? 1 : 0));
  const prev = eachDay(addDays(week.from, -7), addDays(week.to, -7)).map((d, i) => day(d, i < 3 ? 60 : 0, i < 3 ? 1 : 0));

  it("destaca logros, señala mejoras y propone metas alcanzables", () => {
    const r = weeklyReview({
      week,
      daily: days([60, 90, 0, 60, 120, 0, 30]),
      previousDaily: prev,
      restDays: 0,
      topCategory: { name: "Estudio", focus_seconds: 3 * 3600 },
      habitCompliance: 0.4,
      goals: [
        { title: "5 h", achieved: true },
        { title: "10 tareas", achieved: false },
      ],
      xp: 600,
      longestSessionSeconds: 3600,
      postponedOpen: 0,
    });
    expect(r.headline).toBe("5 días activos, 6 h de concentración y 5 tareas completadas. Un 100 % más de concentración que la semana anterior.");
    expect(r.wins).toContain("Fuiste más constante: 5 días activos frente a 3.");
    expect(r.wins).toContain("Tu mejor día fue el viernes, con 2 h de concentración.");
    expect(r.improve[0]).toContain("40 % de tus hábitos");
    expect(r.improve[1]).toContain("10 tareas");
    expect(r.nextWeek[0]).toBe("Apunta a 6 días activos, aunque algunos sean solo 10 minutos.");
  });

  it("semana sin actividad: sin culpa, con un paso pequeño", () => {
    const r = weeklyReview({ week, daily: days([]), previousDaily: prev, restDays: 2, topCategory: null, habitCompliance: null, goals: [], xp: 0, longestSessionSeconds: 0, postponedOpen: 0 });
    expect(r.headline).toContain("Semana en pausa");
    expect(r.wins[0]).toContain("2 días de descanso");
  });
});
