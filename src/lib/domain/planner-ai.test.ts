import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import { planDay, weeklyReview, type PlanInput, type PlannerTask, type ReviewInput } from "./planner";
import { mergeAiPlan, mergeAiReview, planPrompt, reviewPrompt } from "./planner-ai";

const TODAY = "2026-10-09";

const task = (id: string, extra: Partial<PlannerTask> = {}): PlannerTask => ({
  id,
  title: id,
  priority: 0,
  status: "todo",
  due_date: null,
  estimated_minutes: 30,
  actual_seconds: 0,
  postponed_count: 0,
  project_id: null,
  created_at: `${TODAY}T08:00:00Z`,
  ...extra,
});

const input: PlanInput = {
  today: TODAY,
  hour: 9,
  // Sin historial: ritmo inicial de 60 min.
  daily: [],
  estimateRatio: null,
  bestBlockStart: null,
  pendingHabits: [],
  tasks: [task("a"), task("b"), task("hoy", { due_date: TODAY }), task("vencida", { due_date: addDays(TODAY, -1) }), task("hecha", { status: "done" })],
};

describe("plan con IA", () => {
  const base = planDay(input);

  it("solo envía tareas abiertas y el plan de reglas como punto de partida", () => {
    const sent = JSON.parse(planPrompt(input, base));
    expect(sent.remaining_minutes).toBe(60);
    expect(sent.candidates.map((c: { id: string }) => c.id)).not.toContain("hecha");
    expect(sent.rule_plan.items.length).toBe(base.items.length);
  });

  it("acepta solo tareas reales, sin duplicados ni pasarse de tu ritmo, y recalcula lo que no cabe", () => {
    const plan = mergeAiPlan(input, base, {
      headline: "  Dos tareas cortas para hoy.  ",
      items: [
        { task_id: "inventada", minutes: 10, reason: "x", just_start: false },
        { task_id: "a", minutes: 22, reason: "Corta para arrancar", just_start: true },
        { task_id: "a", minutes: 20, reason: "dup", just_start: false },
        { task_id: "hoy", minutes: 30, reason: "Vence hoy", just_start: false },
        { task_id: "b", minutes: 30, reason: "No cabe", just_start: false },
      ],
      tips: ["Uno", "Uno", "Dos", "Tres", "Cuatro"],
    });
    expect(plan).not.toBeNull();
    expect(plan!.source).toBe("ai");
    expect(plan!.items.map((i) => i.task.id)).toEqual(["a", "hoy"]);
    expect(plan!.items[0]).toMatchObject({ minutes: 20, justStart: true, reasons: ["Corta para arrancar"] });
    expect(plan!.items[1].reasons).toEqual(["Vence hoy"]);
    expect(plan!.plannedMinutes).toBe(50);
    // Lo vencido que la IA no eligió se muestra aparte para moverlo a propósito.
    expect(plan!.deferred.map((i) => i.task.id)).toEqual(["vencida"]);
    expect(plan!.headline).toBe("Dos tareas cortas para hoy.");
    expect(plan!.tips).toEqual(["Uno", "Dos", "Tres"]);
    // Los números del día no los decide la IA.
    expect(plan!.capacityMinutes).toBe(base.capacityMinutes);
    expect(plan!.doneMinutes).toBe(base.doneMinutes);
  });

  it("si la respuesta no sirve, se usa el plan por reglas", () => {
    expect(mergeAiPlan(input, base, { headline: "Hola", items: [{ task_id: "nada", minutes: 10, reason: "", just_start: false }], tips: [] })).toBeNull();
  });
});

describe("resumen semanal con IA", () => {
  const review: ReviewInput = {
    week: { from: "2026-09-28", to: "2026-10-04" },
    daily: [{ day: "2026-09-28", focus_seconds: 3600, focus_sessions: 2, interruptions: 1, tasks_completed: 3, habits_done: 1 }],
    previousDaily: [],
    restDays: 0,
    topCategory: null,
    habitCompliance: 0.5,
    goals: [],
    xp: 40,
    longestSessionSeconds: 1800,
    postponedOpen: 0,
  };
  const base = weeklyReview(review);

  it("envía totales legibles de las dos semanas", () => {
    const sent = JSON.parse(reviewPrompt(review, base));
    expect(sent.totals).toMatchObject({ focus_seconds: 3600, tasks_completed: 3 });
    expect(sent.habit_compliance_pct).toBe(50);
  });

  it("limpia y limita las listas; sin titular, reglas", () => {
    const merged = mergeAiReview(base, { headline: "Buena semana", wins: ["a", "b", "c", "d", "e", "f"], improve: [" ", "x"], next_week: [] });
    expect(merged).toMatchObject({ headline: "Buena semana", improve: ["x"], nextWeek: base.nextWeek, source: "ai" });
    expect(merged!.wins).toHaveLength(5);
    expect(mergeAiReview(base, { headline: "  ", wins: [], improve: [], next_week: [] })).toBeNull();
  });
});
