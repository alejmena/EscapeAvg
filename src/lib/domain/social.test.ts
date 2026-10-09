import { describe, expect, it } from "vitest";
import { challengeState, challengeSummary, challengeValue, goalPct, improvementPct, rank, suggestUsername, type SocialStat } from "./social";

const s = (user_id: string, focusMin: number, active_days: number, goal = 600, tasks = 0): SocialStat => ({
  user_id,
  focus_seconds: focusMin * 60,
  tasks_completed: tasks,
  habits_done: 0,
  active_days,
  weekly_focus_goal_minutes: goal,
});

describe("comparaciones justas", () => {
  it("% del objetivo propio, prorrateado por días", () => {
    expect(goalPct(s("a", 300, 3, 600))).toBe(50);
    expect(goalPct(s("a", 300, 3, 600), 3.5)).toBe(100);
    expect(goalPct(s("a", 300, 3, 0))).toBeNull();
  });

  it("la mejora necesita una base mínima", () => {
    expect(improvementPct(s("a", 120, 1), s("a", 100, 1))).toBe(20);
    expect(improvementPct(s("a", 120, 1), s("a", 10, 1))).toBeNull();
    expect(improvementPct(s("a", 120, 1), undefined)).toBeNull();
  });

  it("por defecto premia la constancia, no las horas", () => {
    // B hace muchas horas en 2 días; A hace poco pero 5 días; C igual que A pero más cerca de su objetivo.
    const rows = rank([s("b", 900, 2), s("a", 100, 5, 600), s("c", 100, 5, 120)], [], "consistency");
    expect(rows.map((r) => [r.stat.user_id, r.rank])).toEqual([
      ["c", 1],
      ["a", 2],
      ["b", 3],
    ]);
  });

  it("empates comparten posición y sin valor van al final sin posición", () => {
    const rows = rank([s("a", 60, 1), s("b", 60, 1), s("c", 30, 1, 0)], [], "goal");
    expect(rows.map((r) => [r.stat.user_id, r.rank])).toEqual([
      ["a", 1],
      ["b", 1],
      ["c", 0],
    ]);
    const imp = rank([s("a", 200, 2), s("b", 50, 1)], [s("a", 100, 1)], "improvement");
    expect(imp.map((r) => [r.stat.user_id, r.rank, r.value])).toEqual([
      ["a", 1, 100],
      ["b", 0, null],
    ]);
  });
});

describe("desafíos compartidos", () => {
  it("valor por métrica, estado y resumen", () => {
    const x = s("a", 125.5, 3, 600, 4);
    expect(challengeValue("focus_minutes", x)).toBe(125);
    expect(challengeValue("tasks_completed", x)).toBe(4);
    expect(challengeValue("active_days", undefined)).toBe(0);
    expect(challengeState("2026-10-05", "2026-10-11", "2026-10-04")).toBe("upcoming");
    expect(challengeState("2026-10-05", "2026-10-11", "2026-10-11")).toBe("active");
    expect(challengeState("2026-10-05", "2026-10-11", "2026-10-12")).toBe("finished");
    expect(challengeSummary([10, 20, 30], 20)).toBe("2 de 3 ya alcanzaron la meta.");
    expect(challengeSummary([30, 40], 20)).toBe("¡Todos alcanzaron la meta!");
  });
});

describe("nombre de usuario", () => {
  it("sugiere uno válido", () => {
    expect(suggestUsername("José Pérez", "x@y.z")).toBe("jose_perez");
    expect(suggestUsername(null, "ana.m@correo.com")).toBe("ana_m");
    expect(suggestUsername("Al", "al@x.com")).toMatch(/^al_[a-z0-9]{1,4}$/);
  });
});
