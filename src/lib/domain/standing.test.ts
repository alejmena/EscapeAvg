import { describe, expect, it } from "vitest";
import { addDays } from "./dates";
import type { DailyStat } from "./stats";
import { describeYesterday, standing, yesterdayVsAverage } from "./standing";

const TODAY = "2026-10-09";
const day = (offset: number, focusMin: number): DailyStat => ({
  day: addDays(TODAY, offset),
  focus_seconds: focusMin * 60,
  focus_sessions: focusMin ? 1 : 0,
  interruptions: 0,
  tasks_completed: 0,
  habits_done: 0,
});
/** 28 días completos (de -28 a -1) con la misma concentración diaria. */
const month = (focusMin: number, restEvery = 0) =>
  Array.from({ length: 28 }, (_, i) => day(-28 + i, restEvery && i % restEvery === 0 ? 0 : focusMin));

describe("nivel frente a referencias", () => {
  it("calibra hasta tener 7 días y no inventa un nivel", () => {
    const s = standing([day(-2, 300), day(-1, 300)], TODAY, addDays(TODAY, -2));
    expect(s.tier).toBe("calibrating");
    expect(s.headline).toContain("llevas 2");
  });

  it("asigna el nivel según la media diaria medida y explica la fuente", () => {
    expect(standing(month(60), TODAY, null).tier).toBe("base");
    expect(standing(month(180), TODAY, null).tier).toBe("above");
    expect(standing(month(220), TODAY, null).tier).toBe("high");
    const elite = standing(month(250), TODAY, null);
    expect(elite.tier).toBe("elite");
    expect(elite.reasons.join(" ")).toContain("Newport");
    expect(elite.next).toBeNull();
  });

  it("los días de descanso cuentan en la media y el élite exige constancia", () => {
    // 600 min cada 2 días: media alta pero actividad solo la mitad de los días.
    const bursts = Array.from({ length: 28 }, (_, i) => day(-28 + i, i % 2 ? 600 : 0));
    const s = standing(bursts, TODAY, null);
    expect(s.avgMinutes).toBe(300);
    expect(s.tier).toBe("high");
    expect(s.reasons.join(" ")).toContain("constancia");
  });

  it("no usa días anteriores a la cuenta", () => {
    const s = standing(month(250), TODAY, addDays(TODAY, -10));
    expect(s.days).toBe(10);
  });

  it("dice cuánto falta para el siguiente nivel", () => {
    const s = standing(month(150), TODAY, null);
    expect(s.next).toEqual({ label: "Por encima de la media", missingMinutes: 18 });
  });
});

describe("ayer frente a tu media", () => {
  it("porcentaje sobre tu media de días activos", () => {
    const w = [day(-5, 60), day(-4, 60), day(-3, 60), day(-1, 234)];
    const y = yesterdayVsAverage(w, addDays(TODAY, -1));
    expect(y).toMatchObject({ kind: "ratio", pct: 390 });
    expect(describeYesterday(y)).toBe("Ayer rendiste al 390 % de tu media.");
  });

  it("sin base suficiente no da porcentaje; el descanso no se castiga", () => {
    expect(yesterdayVsAverage([day(-1, 50)], addDays(TODAY, -1))).toMatchObject({ kind: "no-baseline" });
    expect(describeYesterday(yesterdayVsAverage([day(-3, 50), day(-1, 0)], addDays(TODAY, -1)))).toContain("descansaste");
  });
});
