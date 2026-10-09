import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import {
  achievements,
  computeXp,
  levelInfo,
  suggestChallenges,
  sumXp,
  taskEligible,
  xpBySource,
  xpToReach,
  type XpSources,
  type XpTask,
} from "./gamification";

const empty = (): XpSources => ({ sessions: [], tasks: [], habitLogs: [], habitCategory: {}, goals: [], restDays: [] });
const session = (iso: string, min: number, kind = "pomodoro", category_id: string | null = null) => ({ started_at: iso, focus_seconds: min * 60, kind, category_id });
const task = (created: string, completed: string, extra: Partial<XpTask> = {}): XpTask => ({
  created_at: created,
  completed_at: completed,
  actual_seconds: 0,
  parent_id: null,
  category_id: null,
  estimated_minutes: null,
  ...extra,
});

describe("XP", () => {
  it("concentración: 1 XP/min, tope por sesión y diario, manual a la mitad", () => {
    const src = empty();
    src.sessions = [session("2026-10-09T08:00:00Z", 25), session("2026-10-09T10:00:00Z", 200), session("2026-10-09T15:00:00Z", 60, "manual")];
    const xp = computeXp(src, "UTC", "2026-10-09");
    const by = xpBySource(xp.entries);
    expect(by.focus).toBe(25 + 120 + 30);
    expect(by.active_day).toBe(20);
    // Tope diario de 480.
    src.sessions = Array.from({ length: 6 }, (_, i) => session(`2026-10-09T0${i}:00:00Z`, 100));
    expect(xpBySource(computeXp(src, "UTC", "2026-10-09").entries).focus).toBe(480);
  });

  it("Just Start da bonus (máx. 3 al día)", () => {
    const src = empty();
    src.sessions = Array.from({ length: 5 }, (_, i) => session(`2026-10-09T1${i}:00:00Z`, 2, "just_start"));
    expect(xpBySource(computeXp(src, "UTC", "2026-10-09").entries).just_start).toBe(30);
  });

  it("tareas creadas y cerradas al instante no dan XP", () => {
    expect(taskEligible(task("2026-10-09T10:00:00Z", "2026-10-09T10:00:30Z"))).toBe(false);
    expect(taskEligible(task("2026-10-09T10:00:00Z", "2026-10-09T10:00:30Z", { actual_seconds: 600 }))).toBe(true);
    expect(taskEligible(task("2026-10-08T10:00:00Z", "2026-10-09T10:00:00Z"))).toBe(true);
    const src = empty();
    src.tasks = [
      ...Array.from({ length: 30 }, () => task("2026-10-09T10:00:00Z", "2026-10-09T10:00:05Z")),
      task("2026-10-01T10:00:00Z", "2026-10-09T12:00:00Z"),
      task("2026-10-01T10:00:00Z", "2026-10-09T12:00:00Z", { parent_id: "x" }),
    ];
    expect(xpBySource(computeXp(src, "UTC", "2026-10-09").entries).tasks).toBe(13);
  });

  it("semana constante: 4 días activos, los descansos reducen lo exigido", () => {
    const src = empty();
    src.habitLogs = ["2026-09-28", "2026-09-29", "2026-09-30"].map((d) => ({ log_date: d, habit_id: "h" }));
    expect(xpBySource(computeXp(src, "UTC", "2026-10-09").entries).consistency).toBe(0);
    src.restDays = ["2026-10-01"];
    const xp = computeXp(src, "UTC", "2026-10-09");
    expect(xpBySource(xp.entries).consistency).toBe(50);
    expect(xp.entries.find((e) => e.source === "consistency")?.day).toBe("2026-10-04");
    expect(xpBySource(xp.entries).habits).toBe(45);
  });

  it("objetivos semanales alcanzados cada semana; los manuales y triviales no cuentan", () => {
    const src = empty();
    src.goals = [
      { id: "g1", title: "2 h por semana", metric: "focus_minutes", period: "weekly", start_date: null, end_date: null, target_value: 120, category_id: null, created_at: "2026-09-21T09:00:00Z" },
      { id: "g2", title: "Trivial", metric: "tasks_completed", period: "weekly", start_date: null, end_date: null, target_value: 1, category_id: null, created_at: "2026-09-21T09:00:00Z" },
      { id: "g3", title: "Manual", metric: "manual", period: "weekly", start_date: null, end_date: null, target_value: 1, category_id: null, created_at: "2026-09-21T09:00:00Z" },
    ];
    src.sessions = [
      session("2026-09-22T09:00:00Z", 60),
      session("2026-09-23T09:00:00Z", 60), // semana 1: 120 → logrado el 23
      session("2026-09-30T09:00:00Z", 60), // semana 2: 60 → no
      session("2026-10-06T09:00:00Z", 120), // semana 3 (en curso): logrado el 6
    ];
    const xp = computeXp(src, "UTC", "2026-10-09");
    expect(xp.goals.map((g) => g.day)).toEqual(["2026-09-23", "2026-10-06"]);
    expect(xpBySource(xp.entries).goals).toBe(100);
  });

  it("desafío de 7 días con categoría", () => {
    const src = empty();
    src.goals = [{ id: "c", title: "Estudio", metric: "focus_minutes", period: "custom", start_date: "2026-10-03", end_date: "2026-10-09", target_value: 60, category_id: "est", created_at: "2026-10-03T08:00:00Z" }];
    src.sessions = [session("2026-10-04T09:00:00Z", 40, "pomodoro", "est"), session("2026-10-05T09:00:00Z", 40, "pomodoro", "otra"), session("2026-10-06T09:00:00Z", 25, "pomodoro", "est")];
    const xp = computeXp(src, "UTC", "2026-10-09");
    expect(xp.goals).toEqual([{ goalId: "c", title: "Estudio", from: "2026-10-03", to: "2026-10-09", day: "2026-10-06", xp: 70 }]);
  });

  it("suma por rango", () => {
    const src = empty();
    src.sessions = [session("2026-10-08T09:00:00Z", 10), session("2026-10-09T09:00:00Z", 30)];
    const xp = computeXp(src, "UTC", "2026-10-09");
    expect(sumXp(xp.byDay, "2026-10-09", "2026-10-09")).toBe(50);
    expect(xp.total).toBe(80);
  });
});

describe("niveles", () => {
  it("curva creciente y progreso dentro del nivel", () => {
    expect(xpToReach(1)).toBe(0);
    expect(xpToReach(2)).toBe(150);
    expect(xpToReach(3)).toBe(375);
    const l = levelInfo(400);
    expect(l.level).toBe(3);
    expect(l.into).toBe(25);
    expect(l.needed).toBe(300);
    expect(l.title).toBe("En marcha");
    expect(l.nextTitle).toEqual({ level: 5, title: "Constante" });
    expect(levelInfo(0).level).toBe(1);
  });
});

describe("logros", () => {
  it("se desbloquean el día en que se alcanza la meta", () => {
    const src = empty();
    src.sessions = [session("2026-10-01T06:30:00Z", 55), session("2026-10-02T09:00:00Z", 2, "just_start")];
    src.habitLogs = ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-12", "2026-10-13"].map((d) => ({ log_date: d, habit_id: "h" }));
    const today = "2026-10-13";
    const xp = computeXp(src, "UTC", today);
    const a = Object.fromEntries(achievements(src, xp, "UTC", today).map((x) => [x.id, x]));
    expect(a["first-session"].unlockedAt).toBe("2026-10-01");
    expect(a["deep-1"].unlockedAt).toBe("2026-10-01");
    expect(a["just-start-1"].unlockedAt).toBe("2026-10-02");
    expect(a["streak-3"].unlockedAt).toBe("2026-10-03");
    expect(a["streak-7"].unlockedAt).toBeNull();
    expect(a["streak-7"].current).toBe(3);
    expect(a["comeback"].unlockedAt).toBe("2026-10-12");
    expect(a["early-5"].current).toBe(1);
    expect(a["hours-10"].current).toBe(0.9);
  });
});

describe("desafíos sugeridos", () => {
  it("parten de tu media, un poco por encima", () => {
    const src = empty();
    // 4 semanas con 200 min/semana y 4 tareas/semana.
    src.sessions = Array.from({ length: 8 }, (_, i) => session(`${addDays("2026-09-12", i * 3)}T09:00:00Z`, 100));
    src.tasks = Array.from({ length: 16 }, () => task("2026-09-01T00:00:00Z", "2026-09-20T10:00:00Z"));
    const xp = computeXp(src, "UTC", "2026-10-09");
    const s = suggestChallenges(xp.facts, "2026-10-09", false);
    expect(s.map((c) => [c.metric, c.target])).toEqual([
      ["focus_minutes", 225],
      ["tasks_completed", 4],
    ]);
    expect(suggestChallenges(new Map(), "2026-10-09", true)[0].title).toBe("Primera hora de foco");
  });
});
