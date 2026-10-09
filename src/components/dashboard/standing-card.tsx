import { ChevronDown, Crown, Info } from "lucide-react";
import { formatDuration } from "@/lib/domain/stats";
import { REFERENCES, type Standing } from "@/lib/domain/standing";
import { cn } from "@/lib/cn";

/** Escala por tramos (0 → 5 h al día) para que las tres referencias queden bien separadas. */
const STOPS: [number, number][] = [
  [0, 0],
  [REFERENCES.average.minutes, 40],
  [REFERENCES.high.minutes, 62],
  [REFERENCES.elite.minutes, 82],
  [300, 100],
];
function scalePos(min: number): number {
  for (let i = 1; i < STOPS.length; i++) {
    const [m0, p0] = STOPS[i - 1];
    const [m1, p1] = STOPS[i];
    if (min <= m1) return p0 + ((Math.max(0, min) - m0) / (m1 - m0)) * (p1 - p0);
  }
  return 100;
}
const short = (min: number) => `${Math.floor(min / 60)}h${min % 60 ? String(min % 60).padStart(2, "0") : ""}`;
const MARKS = [
  { ref: REFERENCES.average, label: "Media" },
  { ref: REFERENCES.high, label: "Alto" },
  { ref: REFERENCES.elite, label: "Élite" },
];

const TIER_STYLE: Record<Standing["tier"], string> = {
  calibrating: "bg-surface-2 text-muted",
  base: "bg-surface-2 text-text",
  above: "bg-success-soft text-success",
  high: "bg-accent-soft text-accent",
  elite: "bg-gradient-to-r from-accent to-accent-2 text-accent-fg",
};

export function StandingCard({ s }: { s: Standing }) {
  const pos = scalePos(s.avgMinutes);
  return (
    <section
      className="relative overflow-hidden rounded-[22px] border border-border/70 bg-surface p-5 shadow-soft"
      aria-labelledby="standing-title"
      data-testid="standing"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p id="standing-title" className="text-xs font-semibold uppercase tracking-wider text-muted">
            Tu nivel
          </p>
          <p className="mt-1 text-[15px] font-medium leading-snug" data-testid="standing-headline">
            {s.headline}
          </p>
        </div>
        <span className={cn("inline-flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold", TIER_STYLE[s.tier])}>
          {s.tier === "elite" && <Crown size={13} />}
          {s.label}
        </span>
      </div>

      <div className="mt-5">
        <div className="relative h-2 rounded-full bg-surface-2">
          <div className="bar-in absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-accent/70 to-accent-2" style={{ width: `${pos}%` }} />
          {MARKS.map((m) => (
            <span
              key={m.label}
              className="absolute top-1/2 h-3.5 w-px -translate-y-1/2 bg-muted/50"
              style={{ left: `${scalePos(m.ref.minutes)}%` }}
              aria-hidden
            />
          ))}
          <span
            className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface bg-accent shadow-float transition-[left] duration-700"
            style={{ left: `${pos}%` }}
            aria-hidden
          />
        </div>
        <div className="relative mt-2 h-8 text-[10px] text-muted" aria-hidden>
          {MARKS.map((m) => (
            <span key={m.label} className="absolute -translate-x-1/2 text-center leading-tight" style={{ left: `${scalePos(m.ref.minutes)}%` }}>
              {m.label}
              <br />
              <span className="tabular">{short(m.ref.minutes)}</span>
            </span>
          ))}
        </div>
        <p className="text-sm">
          Tu media: <span className="font-semibold tabular">{formatDuration(s.avgMinutes * 60)}</span>
          <span className="text-muted"> al día · {s.days} días</span>
          {s.next && (
            <span className="text-muted">
              {" "}
              · {formatDuration(s.next.missingMinutes * 60)} más para «{s.next.label}»
            </span>
          )}
        </p>
      </div>

      <details className="group mt-3 border-t border-border/70 pt-3">
        <summary className="flex cursor-pointer list-none items-center gap-1 text-sm font-medium text-accent [&::-webkit-details-marker]:hidden">
          ¿Por qué?
          <ChevronDown size={15} className="transition-transform duration-300 group-open:rotate-180" />
        </summary>
        <ul className="animate-in mt-2 space-y-1.5 text-sm text-muted">
          {s.reasons.map((r) => (
            <li key={r} className="flex gap-2">
              <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
              {r}
            </li>
          ))}
        </ul>
        <p className="mt-3 flex gap-1.5 text-xs text-muted/90">
          <Info size={13} className="mt-0.5 shrink-0" />
          Es una estimación frente a estudios publicados, no un ranking de personas: solo cuenta el tiempo de concentración que mides.
        </p>
      </details>
    </section>
  );
}
