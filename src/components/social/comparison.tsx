import Link from "next/link";
import { formatDuration } from "@/lib/domain/stats";
import { RANK_METRICS, rank, type RankMetric, type SocialStat } from "@/lib/domain/social";
import { cn } from "@/lib/cn";

type Person = { name: string; username: string | null };

function signed(n: number) {
  return `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)} %`;
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
  by,
  basePath,
  days,
}: {
  current: SocialStat[];
  previous: SocialStat[];
  people: Map<string, Person>;
  meId: string;
  by: RankMetric;
  basePath: string;
  days: number;
}) {
  const rows = rank(current, previous, by, days);
  const hint = RANK_METRICS.find((m) => m.key === by)?.hint;
  return (
    <div className="space-y-3">
      <nav className="flex flex-wrap gap-1.5" aria-label="Ordenar por">
        {RANK_METRICS.map((m) => (
          <Link
            key={m.key}
            href={`${basePath}?by=${m.key}`}
            scroll={false}
            className={cn(
              "rounded-lg border px-2.5 py-1 text-xs transition-colors",
              m.key === by ? "border-accent bg-accent-soft font-medium text-accent" : "border-border text-muted hover:text-text",
            )}
            aria-current={m.key === by ? "true" : undefined}
          >
            {m.label}
          </Link>
        ))}
      </nav>
      {hint && <p className="text-xs text-muted">{hint}</p>}
      <ol className="divide-y divide-border" aria-label="Comparación">
        {rows.map((r) => {
          const p = people.get(r.stat.user_id);
          const me = r.stat.user_id === meId;
          return (
            <li key={r.stat.user_id} className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 py-3", me && "rounded-lg bg-accent-soft px-2")}>
              <span className="w-7 shrink-0 text-center text-sm font-semibold tabular text-muted" aria-label={r.rank ? `Posición ${r.rank}` : "Sin posición"}>
                {r.rank ? `${r.rank}.º` : "—"}
              </span>
              <span className="min-w-0 flex-1 basis-32">
                <span className="block truncate text-sm font-medium">{me ? "Tú" : (p?.name ?? "Alguien")}</span>
                {p?.username && <span className="block truncate text-xs text-muted">@{p.username}</span>}
              </span>
              <dl className="grid grow grid-cols-3 gap-x-4 gap-y-1 text-xs sm:grow-0 sm:grid-cols-5">
                <Stat label="Días activos" value={`${r.stat.active_days} de ${days}`} strong={by === "consistency"} />
                <Stat label="Concentración" value={formatDuration(r.stat.focus_seconds)} strong={by === "focus"} />
                <Stat label="De su objetivo" value={r.goalPct == null ? "—" : `${r.goalPct} %`} strong={by === "goal"} />
                <Stat label="Tareas" value={String(r.stat.tasks_completed)} strong={by === "tasks"} />
                <Stat
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

function Stat({ label, value, strong, tone }: { label: string; value: string; strong?: boolean; tone?: string }) {
  return (
    <div className="min-w-0">
      <dt className="truncate text-muted">{label}</dt>
      <dd className={cn("tabular", strong && "font-semibold text-text", tone)}>{value}</dd>
    </div>
  );
}

export function parseMetric(v: string | string[] | undefined): RankMetric {
  const s = Array.isArray(v) ? v[0] : v;
  return RANK_METRICS.some((m) => m.key === s) ? (s as RankMetric) : "consistency";
}
