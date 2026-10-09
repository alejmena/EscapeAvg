import { addDays, diffDays, type ISODate } from "./dates";
import { type DailyStat, formatDuration, isActiveDay } from "./stats";

/**
 * Tu nivel frente a referencias publicadas de tiempo de concentración diario.
 *
 * No es un ranking de personas (no tenemos esa población): compara tu media real medida con el
 * temporizador con cifras de estudios conocidos y explica siempre el porqué con tus números.
 */

export type StandingTier = "calibrating" | "base" | "above" | "high" | "elite";

export type Reference = { minutes: number; who: string; source: string };

export const REFERENCES: Record<"average" | "high" | "elite", Reference> = {
  average: {
    minutes: 168,
    who: "un trabajador del conocimiento medio",
    source: "RescueTime: unas 2 h 48 min de tiempo productivo al día",
  },
  high: {
    minutes: 210,
    who: "los mejores estudiantes de violín de una academia de élite",
    source: "Ericsson, Krampe y Tesch-Römer (1993): unas 3,5 h diarias de práctica deliberada",
  },
  elite: {
    minutes: 240,
    who: "el máximo sostenible observado en expertos de élite",
    source: "Ericsson (1993) y Cal Newport (Deep Work): unas 4 h al día de trabajo profundo",
  },
};

export const TIER_LABEL: Record<StandingTier, string> = {
  calibrating: "Calibrando",
  base: "Construyendo tu base",
  above: "Por encima de la media",
  high: "Alto rendimiento",
  elite: "Nivel élite",
};

/** Días mínimos de historial para dar un nivel con sentido. */
export const MIN_DAYS = 7;
const WINDOW = 28;
/** Para "élite" no basta un pico: hay que mantenerlo la mayoría de los días. */
const ELITE_CONSISTENCY = 0.7;

export type Yesterday =
  | { kind: "ratio"; pct: number; seconds: number; baselineSeconds: number }
  | { kind: "rest" }
  | { kind: "no-baseline"; seconds: number };

export type Standing = {
  tier: StandingTier;
  label: string;
  headline: string;
  /** Media diaria de concentración en la ventana (incluye días de descanso). */
  avgMinutes: number;
  days: number;
  activeDays: number;
  reasons: string[];
  next: { label: string; missingMinutes: number } | null;
  /** 0–1: posición dentro de la escala hasta el nivel élite. */
  scale: number;
  yesterday: Yesterday | null;
};

function tierFor(avg: number): Exclude<StandingTier, "calibrating"> {
  if (avg >= REFERENCES.elite.minutes) return "elite";
  if (avg >= REFERENCES.high.minutes) return "high";
  if (avg >= REFERENCES.average.minutes) return "above";
  return "base";
}

const NEXT: Record<Exclude<StandingTier, "calibrating">, { tier: StandingTier; ref: Reference } | null> = {
  base: { tier: "above", ref: REFERENCES.average },
  above: { tier: "high", ref: REFERENCES.high },
  high: { tier: "elite", ref: REFERENCES.elite },
  elite: null,
};

/** Ayer frente a tu media de días activos (sin contar ayer). Necesita al menos 3 días activos de base. */
export function yesterdayVsAverage(window: DailyStat[], yesterday: ISODate): Yesterday | null {
  const y = window.find((d) => d.day === yesterday);
  const base = window.filter((d) => d.day !== yesterday && d.focus_seconds >= 60);
  const ySeconds = Number(y?.focus_seconds ?? 0);
  if (ySeconds < 60) return y || base.length ? { kind: "rest" } : null;
  if (base.length < 3) return { kind: "no-baseline", seconds: ySeconds };
  const baselineSeconds = base.reduce((a, d) => a + Number(d.focus_seconds), 0) / base.length;
  if (baselineSeconds < 600) return { kind: "no-baseline", seconds: ySeconds };
  return { kind: "ratio", pct: Math.round((ySeconds / baselineSeconds) * 100), seconds: ySeconds, baselineSeconds };
}

/**
 * Calcula tu nivel con los últimos 28 días completos (sin hoy, que aún está en curso), nunca antes
 * de que existiera tu cuenta.
 */
export function standing(daily: DailyStat[], today: ISODate, accountStart: ISODate | null): Standing {
  const last = addDays(today, -1);
  let from = addDays(today, -WINDOW);
  if (accountStart && accountStart > from) from = accountStart;
  const days = Math.max(0, diffDays(last, from) + 1);
  const window = daily.filter((d) => d.day >= from && d.day <= last);
  const totalSeconds = window.reduce((a, d) => a + Number(d.focus_seconds), 0);
  const activeDays = window.filter(isActiveDay).length;
  const avgMinutes = days > 0 ? Math.round(totalSeconds / 60 / days) : 0;
  const yesterday = yesterdayVsAverage(window, last);
  const avgText = formatDuration(avgMinutes * 60);

  if (days < MIN_DAYS) {
    return {
      tier: "calibrating",
      label: TIER_LABEL.calibrating,
      headline: `Necesito ${MIN_DAYS} días de datos para darte un nivel fiable; llevas ${days}.`,
      avgMinutes,
      days,
      activeDays,
      reasons: [
        "El nivel se calcula solo con el tiempo que mides con el temporizador o registras a mano.",
        `Las referencias van de ${formatDuration(REFERENCES.average.minutes * 60)} a ${formatDuration(REFERENCES.elite.minutes * 60)} de concentración al día.`,
      ],
      next: null,
      scale: Math.min(1, avgMinutes / REFERENCES.elite.minutes),
      yesterday,
    };
  }

  let tier = tierFor(avgMinutes);
  const consistency = activeDays / days;
  const reasons = [`Te concentras de media ${avgText} al día en los últimos ${days} días (medido, no estimado).`];
  if (tier === "elite" && consistency < ELITE_CONSISTENCY) {
    tier = "high";
    reasons.push(
      `Tu media llega al nivel élite, pero solo tuviste actividad ${activeDays} de ${days} días: el nivel élite pide constancia (al menos el ${Math.round(ELITE_CONSISTENCY * 100)} % de los días).`,
    );
  }

  const passed = [REFERENCES.elite, REFERENCES.high, REFERENCES.average].find((r) => avgMinutes >= r.minutes);
  if (passed) {
    reasons.push(`Superas la referencia de ${passed.who} (${formatDuration(passed.minutes * 60)}). Fuente: ${passed.source}.`);
  } else {
    reasons.push(
      `La referencia de ${REFERENCES.average.who} es ${formatDuration(REFERENCES.average.minutes * 60)}. Fuente: ${REFERENCES.average.source}.`,
    );
  }
  reasons.push(`Tuviste actividad ${activeDays} de ${days} días.`);

  const nextStep = NEXT[tier];
  const next = nextStep
    ? { label: TIER_LABEL[nextStep.tier], missingMinutes: Math.max(1, nextStep.ref.minutes - avgMinutes) }
    : null;

  const headline =
    tier === "elite"
      ? `Rindes al nivel de ${REFERENCES.elite.who}.`
      : tier === "high"
        ? `Rindes como ${REFERENCES.high.who}.`
        : tier === "above"
          ? `Rindes por encima de ${REFERENCES.average.who}.`
          : `Te faltan ${formatDuration(next!.missingMinutes * 60)} al día para superar a ${REFERENCES.average.who}.`;

  return {
    tier,
    label: TIER_LABEL[tier],
    headline,
    avgMinutes,
    days,
    activeDays,
    reasons,
    next,
    scale: Math.min(1, avgMinutes / REFERENCES.elite.minutes),
    yesterday,
  };
}

/** Frase corta sobre ayer para el saludo del inicio. */
export function describeYesterday(y: Yesterday | null): string | null {
  if (!y) return null;
  if (y.kind === "rest") return "Ayer descansaste. El descanso también forma parte del rendimiento.";
  if (y.kind === "no-baseline") return `Ayer te concentraste ${formatDuration(y.seconds)}.`;
  if (y.pct >= 100) return `Ayer rendiste al ${y.pct} % de tu media.`;
  return `Ayer rendiste al ${y.pct} % de tu media: un día más tranquilo.`;
}
