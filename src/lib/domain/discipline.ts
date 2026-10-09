import { addDays, type ISODate, zonedParts } from "./dates";

/**
 * Escape AVG — sistema de rangos de disciplina.
 *
 * Toda la configuración de rangos vive en esta tabla: cambiar umbrales, nombres o porcentajes
 * simbólicos se hace aquí y nada más. Los porcentajes NO son estadísticas de población: son
 * rangos simbólicos internos de la app, y la interfaz lo dice siempre que los muestra.
 */

export type RankId =
  | "inicio"
  | "construyendo"
  | "constancia"
  | "alto"
  | "avanzada"
  | "elite5"
  | "elite1"
  | "extraordinario"
  | "excepcional";

export type Rank = {
  id: RankId;
  /** Horas productivas mínimas del día para alcanzarlo. */
  minHours: number;
  name: string;
  /** Porcentaje simbólico (no estadístico). */
  symbolic: string | null;
  /** Rango "importante": su llegada se celebra. */
  milestone: boolean;
};

export const RANKS: readonly Rank[] = [
  { id: "inicio", minHours: 0, name: "Inicio", symbolic: null, milestone: false },
  { id: "construyendo", minHours: 3, name: "Construyendo disciplina", symbolic: null, milestone: false },
  { id: "constancia", minHours: 5, name: "Constancia", symbolic: null, milestone: false },
  { id: "alto", minHours: 7, name: "Alto rendimiento", symbolic: null, milestone: true },
  { id: "avanzada", minHours: 9, name: "Disciplina avanzada", symbolic: null, milestone: true },
  { id: "elite5", minHours: 10, name: "Élite", symbolic: "Top 5%", milestone: true },
  { id: "elite1", minHours: 11, name: "Élite", symbolic: "Top 1%", milestone: true },
  { id: "extraordinario", minHours: 12, name: "Extraordinario", symbolic: "Top 0.001%", milestone: true },
  { id: "excepcional", minHours: 13, name: "Excepcional", symbolic: "Top 0.00001%", milestone: true },
];

export const SYMBOLIC_NOTE =
  "Los porcentajes son rangos simbólicos internos de Escape AVG, no estadísticas verificadas de la población mundial.";

/** Objetivo diario por defecto: Élite — Top 1 % (11 h). Una meta extraordinaria, no cotidiana. */
export const DEFAULT_GOAL_MINUTES = 660;
export const MIN_GOAL_MINUTES = 60;
export const MAX_GOAL_MINUTES = 960;
/** A partir de aquí la app recuerda que no es una meta para todos los días. */
export const HEAVY_GOAL_MINUTES = 720;

export function rankLabel(r: Rank): string {
  return r.symbolic ? `${r.name} — ${r.symbolic}` : r.name;
}

export function rankIndex(seconds: number): number {
  const h = Math.max(0, seconds) / 3600;
  let i = 0;
  for (let k = 0; k < RANKS.length; k++) if (h >= RANKS[k].minHours) i = k;
  return i;
}

export function rankFor(seconds: number): Rank {
  return RANKS[rankIndex(seconds)];
}

export function nextRank(seconds: number): { rank: Rank; missingSeconds: number } | null {
  const i = rankIndex(seconds);
  const next = RANKS[i + 1];
  if (!next) return null;
  return { rank: next, missingSeconds: Math.max(1, Math.ceil(next.minHours * 3600 - seconds)) };
}

/** Rango cuyo umbral coincide con el objetivo, o null si es un objetivo personalizado. */
export function goalRank(goalMinutes: number): Rank | null {
  return RANKS.find((r) => r.minHours > 0 && r.minHours * 60 === goalMinutes) ?? null;
}

export function goalLabel(goalMinutes: number): string {
  const r = goalRank(goalMinutes);
  return r ? rankLabel(r) : `Objetivo personal de ${hoursText(goalMinutes * 60)}`;
}

export function normalizeGoal(minutes: unknown): number {
  const n = Number(minutes);
  if (!Number.isFinite(n)) return DEFAULT_GOAL_MINUTES;
  return Math.min(MAX_GOAL_MINUTES, Math.max(MIN_GOAL_MINUTES, Math.round(n)));
}

// ---------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------

const WORDS = ["cero", "una", "dos", "tres", "cuatro", "cinco", "seis", "siete", "ocho", "nueve", "diez", "once", "doce", "trece", "catorce", "quince", "dieciséis"];

/** "11 horas", "1 hora", "7 h 42 min", "45 min". */
export function hoursText(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (h === 0) return s > 0 && m === 0 ? "menos de 1 min" : `${m} min`;
  if (m === 0) return `${h} ${h === 1 ? "hora" : "horas"}`;
  return `${h} h ${m} min`;
}

function wordHours(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  return h < WORDS.length ? `${WORDS[h]} ${h === 1 ? "hora" : "horas"}` : `${h} horas`;
}

export const GOAL_DONE_TITLE = "LO CONSEGUISTE.";
export const GOAL_DONE_BODY = "HOY HICISTE LO SUFICIENTE. ALCANZASTE TU OBJETIVO DE DISCIPLINA.";

export type DayMessage = {
  kind: "start" | "rest" | "progress" | "goal" | "max";
  title: string | null;
  body: string;
};

/** Mensaje de un rango alcanzado. Solo habla de lo que realmente se hizo. */
export function rankMessage(seconds: number): string {
  const r = rankFor(seconds);
  switch (r.id) {
    case "inicio":
      return seconds < 60
        ? "Hoy tienes una nueva oportunidad de superar tu promedio."
        : `Ya empezaste: ${hoursText(seconds)} invertidos en ti. La primera hora es la que más cuesta.`;
    case "construyendo":
      return "Has construido una base. La constancia empieza a acumularse.";
    case "constancia":
      return `Constancia. Hoy llevas ${wordHours(seconds)} de trabajo real en tu desarrollo.`;
    case "alto":
      return `Alto rendimiento alcanzado. Hoy has dedicado ${wordHours(seconds)} a desarrollarte.`;
    case "avanzada":
      return `Disciplina avanzada. ${capitalize(wordHours(seconds))} de desarrollo personal en un solo día.`;
    case "elite5":
      return "ÉLITE — 5%. Diez horas dedicadas a convertirte en alguien mejor preparado.";
    case "elite1":
      return "ÉLITE — 1%. Objetivo extraordinario cumplido. Lo que hiciste hoy es suficiente.";
    case "extraordinario":
      return "EXTRAORDINARIO — 0.001%. Has hecho mucho más que suficiente. A partir de aquí, lo que más suma es recuperarte.";
    case "excepcional":
      return "EXCEPCIONAL — 0.00001%. Has alcanzado el máximo rango simbólico de disciplina. Reconoce tu esfuerzo y prioriza recuperarte.";
  }
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Mensaje principal del día. Al cumplir el objetivo, la meta no se mueve: el mensaje lo reconoce
 * como un logro completo y no empuja a seguir.
 */
export function dayMessage(seconds: number, goalMinutes: number, restDay: boolean): DayMessage {
  const r = rankFor(seconds);
  if (r.id === "excepcional") return { kind: "max", title: GOAL_DONE_TITLE, body: rankMessage(seconds) };
  if (seconds >= goalMinutes * 60) return { kind: "goal", title: GOAL_DONE_TITLE, body: GOAL_DONE_BODY };
  if (seconds < 60 && restDay) {
    return { kind: "rest", title: null, body: "Hoy es tu día de descanso. Recuperarte también es parte del progreso sostenible." };
  }
  if (seconds < 60) return { kind: "start", title: null, body: rankMessage(0) };
  return { kind: "progress", title: null, body: rankMessage(seconds) };
}

// ---------------------------------------------------------------------------
// Horas productivas: sin solapes, sin descansos y sin tiempo "solo ocupado".
// ---------------------------------------------------------------------------

export type Quality = 1 | 2 | 3;
export const QUALITY_LABEL: Record<Quality, string> = { 1: "Solo ocupado", 2: "Productiva", 3: "Profunda" };
export const QUALITY_HINT: Record<Quality, string> = {
  1: "Estuve ocupado pero no avancé de verdad. No suma horas de desarrollo.",
  2: "Trabajo real con avances.",
  3: "Concentración total y progreso claro.",
};

export type ActivitySession = {
  started_at: string;
  ended_at: string | null;
  focus_seconds: number | null;
  kind: string;
  status: string;
  category_id: string | null;
  quality: number | null;
};

export type CategoryInfo = { id: string; name: string; color: string; counts: boolean };

export type DayTotals = {
  /** Horas de desarrollo que cuentan para el rango. */
  productive: number;
  /** Tiempo marcado como "solo ocupado". */
  busy: number;
  /** Tiempo en categorías que no cuentan como desarrollo (ocio, etc.). */
  excluded: number;
  /** Tiempo descartado por solaparse con otra actividad. */
  overlap: number;
  byCategory: Map<string | null, number>;
};

export function emptyDay(): DayTotals {
  return { productive: 0, busy: 0, excluded: 0, overlap: 0, byCategory: new Map() };
}

/**
 * Tiempo efectivo de cada actividad sin contar dos veces el mismo tramo del reloj.
 * Se ordenan por inicio y cada una solo aporta la parte que no cubrió una anterior
 * (y nunca más que su duración efectiva, que ya descuenta pausas).
 */
export function dedupe<T extends Pick<ActivitySession, "started_at" | "ended_at" | "focus_seconds">>(
  sessions: T[],
): { session: T; seconds: number; overlap: number }[] {
  const sorted = [...sessions].sort((a, b) => Date.parse(a.started_at) - Date.parse(b.started_at));
  let coveredUntil = -Infinity;
  return sorted.map((s) => {
    const start = Date.parse(s.started_at);
    const effective = Math.max(0, Number(s.focus_seconds ?? 0));
    const end = s.ended_at ? Date.parse(s.ended_at) : start + effective * 1000;
    const free = Math.max(0, (end - Math.max(start, coveredUntil)) / 1000);
    const seconds = Math.round(Math.min(effective, free));
    coveredUntil = Math.max(coveredUntil, end);
    return { session: s, seconds, overlap: effective - seconds };
  });
}

/**
 * Totales por día local (el día en que empezó la actividad, como el resto de estadísticas).
 * Solo cuentan actividades completadas que no son descansos.
 */
export function aggregateDays(sessions: ActivitySession[], timezone: string, categories: CategoryInfo[]): Map<ISODate, DayTotals> {
  const counts = new Map(categories.map((c) => [c.id, c.counts]));
  const valid = sessions.filter((s) => s.status === "completed" && s.kind !== "break");
  const out = new Map<ISODate, DayTotals>();
  for (const { session: s, seconds, overlap } of dedupe(valid)) {
    const day = zonedParts(new Date(s.started_at), timezone).date;
    let d = out.get(day);
    if (!d) out.set(day, (d = emptyDay()));
    d.overlap += overlap;
    if (seconds === 0) continue;
    const cat = s.category_id && counts.has(s.category_id) ? s.category_id : null;
    if (cat && counts.get(cat) === false) d.excluded += seconds;
    else if (s.quality === 1) d.busy += seconds;
    else {
      d.productive += seconds;
      d.byCategory.set(cat, (d.byCategory.get(cat) ?? 0) + seconds);
    }
  }
  return out;
}

export function productiveOn(days: Map<ISODate, DayTotals>, day: ISODate): number {
  return days.get(day)?.productive ?? 0;
}

// ---------------------------------------------------------------------------
// Resumen del día: tú contra ti mismo.
// ---------------------------------------------------------------------------

/** Hoy frente al rango que alcanzaste ayer. */
export function vsYesterday(todaySeconds: number, yesterdaySeconds: number): string {
  const yRank = rankFor(yesterdaySeconds);
  if (yRank.id === "inicio") {
    return yesterdaySeconds >= 60 && todaySeconds > yesterdaySeconds
      ? "Ya superaste lo que hiciste ayer."
      : yesterdaySeconds >= 60
        ? `Estás a ${hoursText(yesterdaySeconds - todaySeconds)} de igualar lo que hiciste ayer.`
        : "Hoy puedes empezar a construir tu nivel.";
  }
  const missing = yRank.minHours * 3600 - todaySeconds;
  return missing <= 0 ? `Ya igualaste tu nivel de ayer: ${rankLabel(yRank)}.` : `Estás a ${hoursText(missing)} de repetir tu nivel de ayer.`;
}

export type DisciplineSummary = {
  todaySeconds: number;
  goalMinutes: number;
  rank: Rank;
  next: { rank: Rank; missingSeconds: number } | null;
  goalReached: boolean;
  message: DayMessage;
  yesterday: { seconds: number; rank: Rank; rest: boolean; text: string };
  todayVsYesterday: string;
  week: { hit: number; days: number; rest: number; text: string };
  best: { day: ISODate; seconds: number } | null;
  avg30: number;
  /** Días seguidos (hasta ayer, o hoy si ya lo lograste) cumpliendo el objetivo. Los descansos no la rompen. */
  goalStreak: number;
};

export function summarize(opts: {
  days: Map<ISODate, DayTotals>;
  today: ISODate;
  weekStart: ISODate;
  goalMinutes: number;
  restDays: Set<ISODate>;
  /** Segundos de la actividad en curso (aún sin guardar), para el cálculo en vivo. */
  liveSeconds?: number;
}): DisciplineSummary {
  const { days, today, weekStart, goalMinutes, restDays } = opts;
  const goal = goalMinutes * 60;
  const todaySeconds = productiveOn(days, today) + Math.max(0, opts.liveSeconds ?? 0);
  const rank = rankFor(todaySeconds);
  const goalReached = todaySeconds >= goal;

  const yDay = addDays(today, -1);
  const ySeconds = productiveOn(days, yDay);
  const yRank = rankFor(ySeconds);
  const yRest = restDays.has(yDay);
  const yText =
    ySeconds < 60
      ? yRest
        ? "Descansaste. El descanso también forma parte del progreso."
        : "No registraste horas de desarrollo."
      : yRank.id === "inicio"
        ? `Completaste ${hoursText(ySeconds)} de desarrollo.`
        : `Alcanzaste ${rankLabel(yRank)}. Completaste ${hoursText(ySeconds)} productivas.`;

  const todayVsYesterday = vsYesterday(todaySeconds, ySeconds);

  let hit = 0;
  let rest = 0;
  let n = 0;
  for (let d = weekStart; d <= today; d = addDays(d, 1)) {
    n++;
    const s = d === today ? todaySeconds : productiveOn(days, d);
    if (s >= goal) hit++;
    else if (restDays.has(d)) rest++;
  }
  const weekText =
    `${hit} de ${n} ${n === 1 ? "día" : "días"} alcanzaste tu objetivo` +
    (rest ? `, y ${rest === 1 ? "un día" : `${rest} días`} de descanso.` : ".");

  let best: { day: ISODate; seconds: number } | null = null;
  for (const [day, t] of days) {
    const s = day === today ? todaySeconds : t.productive;
    if (s >= 60 && (!best || s > best.seconds)) best = { day, seconds: s };
  }
  if (todaySeconds >= 60 && (!best || todaySeconds > best.seconds)) best = { day: today, seconds: todaySeconds };

  let sum30 = 0;
  for (let i = 1; i <= 30; i++) sum30 += productiveOn(days, addDays(today, -i));

  let streak = goalReached ? 1 : 0;
  for (let d = yDay, guard = 0; guard < 400; d = addDays(d, -1), guard++) {
    if (productiveOn(days, d) >= goal) streak++;
    else if (!restDays.has(d)) break;
  }

  return {
    todaySeconds,
    goalMinutes,
    rank,
    next: nextRank(todaySeconds),
    goalReached,
    message: dayMessage(todaySeconds, goalMinutes, restDays.has(today)),
    yesterday: { seconds: ySeconds, rank: yRank, rest: yRest, text: yText },
    todayVsYesterday,
    week: { hit, days: n, rest, text: weekText },
    best,
    avg30: Math.round(sum30 / 30),
    goalStreak: streak,
  };
}
