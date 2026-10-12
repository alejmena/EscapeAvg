import Link from "next/link";
import { CalendarCheck, CheckSquare, Info, Percent, Timer, TrendingUp } from "lucide-react";
import { formatDuration } from "@/lib/domain/stats";
import { RANK_METRICS, rank, type RankedRow, type RankMetric, type SocialStat } from "@/lib/domain/social";
import type { Tone } from "@/lib/sections";
import { Avatar } from "@/components/social/avatar";
import { cn } from "@/lib/cn";

type Person = { name: string; username: string | null };

const METRIC_ICON: Record<RankMetric, typeof Timer> = {
  consistency: CalendarCheck,
  goal: Percent,
  improvement: TrendingUp,
  focus: Timer,
  tasks: CheckSquare,
};

// Medallas de las tres primeras posiciones.
const PODIUM: Record<number, Tone> = { 1: "gold", 2: "slate", 3: "orange" };

function signed(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} %`;
}

/** Cifra grande de la fila según la métrica elegida. */
function headline(r: RankedRow, by: RankMetric, days: number): { value: string; label: string } {
  switch (by) {
    case "consistency":
      return { value: `${r.stat.active_days}/${days}`, label: "días" };
    case "goal":
      return { value: r.goalPct == null ? "—" : `${r.goalPct} %`, label: "objetivo" };
    case "improvement":
      return { value: r.improvement == null ? "—" : signed(r.improvement), label: "mejora" };
    case "focus":
      return { value: formatDuration(r.stat.focus_seconds), label: "foco" };
    case "tasks":
      return { value: String(r.stat.tasks_completed), label: "tareas" };
  }
}

/**
 * Tabla de comparación dentro de un círculo elegido (amigos o un grupo).
 * Solo posiciones dentro del círculo, nunca percentiles.
 */
export function Comparison({
  current,
  previous,
  people,
  meId,
  meName = "Tú",
  by,
  basePath,
  days,
}: {
  current: SocialStat[];
  previous: SocialStat[];
  people: Map<string, Person>;
  meId: string;
  /** Nombre para tu avatar (en la fila siempre pone «Tú»). */
  meName?: string;
  by: RankMetric;
  basePath: string;
  days: number;
}) {
  const rows = rank(current, previous, by, days);
  const hint = RANK_METRICS.find((m) => m.key === by)?.hint;
  // Escala de las barras: el mejor valor del círculo llena la barra.
  const top = Math.max(1, ...rows.map((r) => Math.abs(r.value ?? 0)));
  return (
    <div className="space-y-4">
      <div className="-mx-1 overflow-x-auto px-1 pb-1 [scrollbar-width:none] max-sm:[mask-image:linear-gradient(90deg,#000_85%,transparent)] [&::-webkit-scrollbar]:hidden">
        <nav className="seg" aria-label="Ordenar por">
          {RANK_METRICS.map((m) => {
            const Icon = METRIC_ICON[m.key];
            return (
              <Link key={m.key} href={`${basePath}?by=${m.key}`} scroll={false} aria-current={m.key === by ? "true" : undefined}>
                <Icon size={14} className={m.key === by ? "text-tone" : undefined} aria-hidden />
                {m.label}
              </Link>
            );
          })}
        </nav>
      </div>
      {hint && (
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <Info size={13} className="shrink-0 text-tone" aria-hidden />
          {hint}
        </p>
      )}
      <ol className="stagger space-y-2" aria-label="Comparación">
        {rows.map((r) => {
          const p = people.get(r.stat.user_id);
          const me = r.stat.user_id === meId;
          const name = me ? "Tú" : (p?.name ?? "Alguien");
          const big = headline(r, by, days);
          const negative = (r.value ?? 0) < 0;
          const ratio = r.value == null ? 0 : Math.abs(r.value) / top;
          return (
            <li
              key={r.stat.user_id}
              className={cn(
                "relative overflow-hidden rounded-[20px] border p-3 transition-colors sm:p-4",
                me ? "border-[color-mix(in_srgb,var(--tone)_35%,transparent)] bg-tone-soft/70" : "border-border/80 bg-surface/50 hover:bg-surface-2/60",
              )}
            >
              <div className="flex items-center gap-3">
                <span
                  data-tone={r.rank ? PODIUM[r.rank] : undefined}
                  className={cn(
                    "grid h-9 w-9 shrink-0 place-items-center rounded-full text-[12px] font-bold tabular",
                    r.rank && PODIUM[r.rank] ? "tone-chip" : "bg-surface-2 text-muted",
                  )}
                  aria-label={r.rank ? `Posición ${r.rank}` : "Sin posición"}
                >
                  {r.rank ? `${r.rank}.º` : "—"}
                </span>
                <Avatar name={me ? meName : name} seed={r.stat.user_id} me={me} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{name}</span>
                  {p?.username && <span className="block truncate text-xs text-muted">@{p.username}</span>}
                </span>
                <span className="shrink-0 text-right">
                  <span
                    className={cn(
                      "num-xl block text-[22px] sm:text-[26px]",
                      by === "improvement" && r.improvement != null && (negative ? "text-warning" : "text-success"),
                    )}
                  >
                    {big.value}
                  </span>
                  <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted">{big.label}</span>
                </span>
              </div>
              <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                <div
                  className={cn(
                    "bar-in h-full rounded-full",
                    by === "improvement" && negative ? "bg-warning" : "bg-gradient-to-r from-tone to-tone-2 shadow-[0_0_10px_-2px_var(--tone)]",
                  )}
                  style={{ width: `${Math.max(r.value == null ? 0 : 3, ratio * 100)}%` }}
                />
              </div>
              <dl className="mt-3 flex flex-wrap gap-1.5 text-xs sm:grid sm:grid-cols-5">
                <Stat icon={CalendarCheck} label="Días activos" value={`${r.stat.active_days} de ${days}`} strong={by === "consistency"} />
                <Stat icon={Timer} label="Concentración" value={formatDuration(r.stat.focus_seconds)} strong={by === "focus"} />
                <Stat icon={Percent} label="De su objetivo" value={r.goalPct == null ? "—" : `${r.goalPct} %`} strong={by === "goal"} />
                <Stat icon={CheckSquare} label="Tareas" value={String(r.stat.tasks_completed)} strong={by === "tasks"} />
                <Stat
                  icon={TrendingUp}
                  label="Mejora"
                  value={r.improvement == null ? "—" : signed(r.improvement)}
                  strong={by === "improvement"}
                  tone={r.improvement == null ? undefined : r.improvement >= 0 ? "text-success" : "text-warning"}
                />
              </dl>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function Stat({ icon: Icon, label, value, strong, tone }: { icon: typeof Timer; label: string; value: string; strong?: boolean; tone?: string }) {
  // En móvil, ficha compacta (icono + cifra; la etiqueta queda para lectores de pantalla); desde sm, etiqueta visible.
  return (
    <div
      className={cn(
        "flex min-w-0 items-center gap-1.5 rounded-full px-2.5 py-1 sm:block sm:rounded-xl sm:px-2 sm:py-1.5",
        strong ? "bg-surface shadow-[0_0_0_1px_var(--card-edge)]" : "bg-surface-2/50",
      )}
    >
      <dt className="flex min-w-0 items-center text-muted sm:text-[10.5px]">
        <Icon size={12} className={cn("shrink-0 sm:hidden", strong && "text-tone")} aria-hidden />
        <span className="sr-only sm:not-sr-only sm:truncate">{label}</span>
      </dt>
      <dd className={cn("truncate font-semibold tabular", strong ? "text-text" : "text-text/80", tone)}>{value}</dd>
    </div>
  );
}

export function parseMetric(v: string | string[] | undefined): RankMetric {
  const s = Array.isArray(v) ? v[0] : v;
  return RANK_METRICS.some((m) => m.key === s) ? (s as RankMetric) : "consistency";
}
