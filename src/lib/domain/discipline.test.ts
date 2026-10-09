import { describe, expect, it } from "vitest";
import {
  type ActivitySession,
  aggregateDays,
  dayMessage,
  dedupe,
  GOAL_DONE_BODY,
  GOAL_DONE_TITLE,
  goalLabel,
  hoursText,
  nextRank,
  rankFor,
  rankLabel,
  RANKS,
  summarize,
  vsYesterday,
} from "./discipline";
import { developmentReport, records, series } from "./development";
import { QUOTES, quoteOfDay } from "./quotes";

const H = 3600;
const s = (start: string, end: string, extra: Partial<ActivitySession> = {}): ActivitySession => ({
  started_at: start,
  ended_at: end,
  focus_seconds: (Date.parse(end) - Date.parse(start)) / 1000,
  kind: "manual",
  status: "completed",
  category_id: null,
  quality: null,
  ...extra,
});

describe("rangos", () => {
  it("clasifica según la tabla configurable", () => {
    expect(rankFor(0).name).toBe("Inicio");
    expect(rankFor(2.9 * H).name).toBe("Inicio");
    expect(rankFor(3 * H).name).toBe("Construyendo disciplina");
    expect(rankFor(4.5 * H).name).toBe("Construyendo disciplina");
    expect(rankFor(5 * H).name).toBe("Constancia");
    expect(rankFor(7 * H + 42 * 60).name).toBe("Alto rendimiento");
    expect(rankFor(9 * H).name).toBe("Disciplina avanzada");
    expect(rankLabel(rankFor(10 * H))).toBe("Élite — Top 5%");
    expect(rankLabel(rankFor(11 * H))).toBe("Élite — Top 1%");
    expect(rankLabel(rankFor(12 * H))).toBe("Extraordinario — Top 0.001%");
    expect(rankLabel(rankFor(13 * H))).toBe("Excepcional — Top 0.00001%");
    expect(rankLabel(rankFor(16 * H))).toBe("Excepcional — Top 0.00001%");
  });

  it("los umbrales están ordenados", () => {
    for (let i = 1; i < RANKS.length; i++) expect(RANKS[i].minHours).toBeGreaterThan(RANKS[i - 1].minHours);
  });

  it("calcula el siguiente rango y lo que falta (ejemplo del panel)", () => {
    const n = nextRank(7 * H + 42 * 60);
    expect(n?.rank.name).toBe("Disciplina avanzada");
    expect(hoursText(n!.missingSeconds)).toBe("1 h 18 min");
    expect(nextRank(13 * H)).toBeNull();
  });

  it("etiqueta de objetivo: rango o personalizado", () => {
    expect(goalLabel(660)).toBe("Élite — Top 1%");
    expect(goalLabel(390)).toBe("Objetivo personal de 6 h 30 min");
  });

  it("texto de horas", () => {
    expect(hoursText(11 * H)).toBe("11 horas");
    expect(hoursText(H)).toBe("1 hora");
    expect(hoursText(45 * 60)).toBe("45 min");
  });
});

describe("mensajes", () => {
  it("al cumplir el objetivo lo reconoce como suficiente y no pide más", () => {
    const m = dayMessage(11 * H, 660, false);
    expect(m.kind).toBe("goal");
    expect(m.title).toBe(GOAL_DONE_TITLE);
    expect(m.body).toBe(GOAL_DONE_BODY);
  });

  it("cambia con el progreso real", () => {
    expect(dayMessage(0, 660, false).body).toBe("Hoy tienes una nueva oportunidad de superar tu promedio.");
    expect(dayMessage(4 * H, 660, false).body).toBe("Has construido una base. La constancia empieza a acumularse.");
    expect(dayMessage(8 * H, 660, false).body).toBe("Alto rendimiento alcanzado. Hoy has dedicado ocho horas a desarrollarte.");
    expect(dayMessage(13 * H, 780, false).body).toMatch(/^EXCEPCIONAL — 0.00001%.*prioriza recuperarte\.$/);
  });

  it("con un objetivo modesto, también se celebra sin exigir más", () => {
    expect(dayMessage(5 * H, 300, false).kind).toBe("goal");
  });

  it("reconoce el descanso", () => {
    expect(dayMessage(0, 660, true).kind).toBe("rest");
  });
});

describe("horas productivas", () => {
  it("no cuenta dos veces el tiempo solapado", () => {
    const out = dedupe([s("2026-10-09T08:00:00Z", "2026-10-09T10:00:00Z"), s("2026-10-09T09:00:00Z", "2026-10-09T11:00:00Z")]);
    expect(out.map((x) => x.seconds)).toEqual([2 * H, H]);
    expect(out[1].overlap).toBe(H);
  });

  it("una actividad contenida en otra no suma nada", () => {
    const out = dedupe([s("2026-10-09T08:00:00Z", "2026-10-09T12:00:00Z"), s("2026-10-09T09:00:00Z", "2026-10-09T10:00:00Z")]);
    expect(out.reduce((a, x) => a + x.seconds, 0)).toBe(4 * H);
  });

  it("respeta las pausas (duración efectiva menor que el tramo)", () => {
    const out = dedupe([{ ...s("2026-10-09T08:00:00Z", "2026-10-09T10:00:00Z"), focus_seconds: 5400 }]);
    expect(out[0].seconds).toBe(5400);
  });

  it("excluye descansos, sesiones descartadas, 'solo ocupado' y categorías de ocio", () => {
    const cats = [
      { id: "study", name: "Estudio", color: "#000000", counts: true },
      { id: "fun", name: "Ocio", color: "#000000", counts: false },
    ];
    const days = aggregateDays(
      [
        s("2026-10-09T08:00:00Z", "2026-10-09T10:00:00Z", { category_id: "study" }),
        s("2026-10-09T10:00:00Z", "2026-10-09T10:30:00Z", { kind: "break" }),
        s("2026-10-09T11:00:00Z", "2026-10-09T12:00:00Z", { quality: 1 }),
        s("2026-10-09T12:00:00Z", "2026-10-09T13:00:00Z", { category_id: "fun" }),
        s("2026-10-09T13:00:00Z", "2026-10-09T14:00:00Z", { status: "abandoned" }),
        s("2026-10-09T14:00:00Z", "2026-10-09T15:00:00Z", { quality: 3 }),
      ],
      "UTC",
      cats,
    );
    const d = days.get("2026-10-09")!;
    expect(d.productive).toBe(3 * H);
    expect(d.busy).toBe(H);
    expect(d.excluded).toBe(H);
    expect(d.byCategory.get("study")).toBe(2 * H);
    expect(d.byCategory.get(null)).toBe(H);
  });

  it("asigna cada actividad al día local en que empezó", () => {
    const days = aggregateDays([s("2026-10-09T23:30:00Z", "2026-10-10T00:30:00Z")], "Europe/Madrid", []);
    expect(days.get("2026-10-10")?.productive).toBe(H);
  });
});

describe("resumen del día", () => {
  const today = "2026-10-09";
  const day = (d: string, hours: number) => s(`${d}T06:00:00Z`, new Date(Date.parse(`${d}T06:00:00Z`) + hours * H * 1000).toISOString());
  const days = aggregateDays([day("2026-10-08", 11), day("2026-10-07", 11.5), day("2026-10-06", 4), day(today, 9)], "UTC", []);

  it("ayer, hoy y la semana frente a ti mismo", () => {
    const r = summarize({ days, today, weekStart: "2026-10-05", goalMinutes: 660, restDays: new Set(["2026-10-05"]) });
    expect(r.yesterday.text).toBe("Alcanzaste Élite — Top 1%. Completaste 11 horas productivas.");
    expect(r.todayVsYesterday).toBe("Estás a 2 horas de repetir tu nivel de ayer.");
    expect(r.week.text).toBe("2 de 5 días alcanzaste tu objetivo, y un día de descanso.");
    expect(r.best).toEqual({ day: "2026-10-07", seconds: 11.5 * H });
    expect(r.goalStreak).toBe(2);
    expect(r.goalReached).toBe(false);
  });

  it("la actividad en curso se suma en vivo", () => {
    const r = summarize({ days, today, weekStart: "2026-10-05", goalMinutes: 660, restDays: new Set(), liveSeconds: 2 * H });
    expect(r.goalReached).toBe(true);
    expect(r.message.title).toBe(GOAL_DONE_TITLE);
    expect(r.goalStreak).toBe(3);
  });

  it("compara con ayer", () => {
    expect(vsYesterday(11 * H, 11 * H)).toBe("Ya igualaste tu nivel de ayer: Élite — Top 1%.");
    expect(vsYesterday(H, 0)).toBe("Hoy puedes empezar a construir tu nivel.");
  });
});

describe("desarrollo acumulado", () => {
  const cats = [
    { id: "study", name: "Estudio", color: "#111111", counts: true },
    { id: "lang", name: "Idiomas", color: "#222222", counts: true },
  ];
  const sessions: ActivitySession[] = [];
  for (let i = 0; i < 30; i++) {
    const d = new Date(Date.UTC(2026, 8, 10 + i));
    const iso = d.toISOString().slice(0, 10);
    sessions.push(s(`${iso}T08:00:00Z`, `${iso}T10:00:00Z`, { category_id: "study" }));
    if (i % 5 === 0) sessions.push(s(`${iso}T11:00:00Z`, `${iso}T12:00:00Z`, { category_id: "lang" }));
    // Mes anterior: solo 1 h al día.
    const p = new Date(Date.UTC(2026, 8, 10 + i - 30)).toISOString().slice(0, 10);
    sessions.push(s(`${p}T08:00:00Z`, `${p}T09:00:00Z`, { category_id: "study" }));
  }
  const days = aggregateDays(sessions, "UTC", cats);
  const today = "2026-10-09";

  it("totales por categoría y comparativas honestas", () => {
    const r = developmentReport(days, today, cats);
    expect(r.current.map((c) => [c.name, c.seconds / H])).toEqual([
      ["Estudio", 60],
      ["Idiomas", 6],
    ]);
    expect(r.totalSeconds).toBe(66 * H);
    expect(r.insights).toContain("Has dedicado 36 horas más a tu desarrollo que en los 30 días anteriores.");
    expect(r.insights).toContain("Tu promedio diario aumentó de 1 a 2,2 horas.");
    expect(r.insights).toContain("Tu mayor fortaleza es la constancia en estudio (30 días de 30).");
    expect(r.insights).toContain("Tu actividad menos constante es idiomas (6 días de 30).");
  });

  it("récords y series", () => {
    const rec = records(days, 120);
    expect(rec.bestDay?.seconds).toBe(3 * H);
    expect(rec.longestGoalStreak).toBe(30);
    expect(series(days, today, "day")).toHaveLength(30);
    expect(series(days, today, "month")).toHaveLength(12);
    expect(series(days, today, "year", 1, "2026-08-11").map((p) => p.from)).toEqual(["2026-01-01"]);
  });
});

describe("frases", () => {
  it("ids únicos y válidos, con traducción y procedencia", () => {
    const ids = new Set(QUOTES.map((q) => q.id));
    expect(ids.size).toBe(QUOTES.length);
    for (const q of QUOTES) {
      expect(q.id).toMatch(/^[a-z0-9-]{1,40}$/);
      expect(q.translation.length).toBeGreaterThan(5);
      expect(q.source.length).toBeGreaterThan(5);
    }
    expect(QUOTES.filter((q) => q.origin === "china").length).toBeGreaterThanOrEqual(15);
    expect(QUOTES.filter((q) => q.origin === "rusia").length).toBeGreaterThanOrEqual(15);
  });

  it("rota cada día y es estable dentro del mismo día", () => {
    expect(quoteOfDay("2026-10-09").id).toBe(quoteOfDay("2026-10-09").id);
    expect(quoteOfDay("2026-10-09").id).not.toBe(quoteOfDay("2026-10-10").id);
    expect(quoteOfDay("2026-10-09", "suficiencia").themes).toContain("suficiencia");
  });
});
