import type { Metadata } from "next";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  Flame,
  LineChart as LineIcon,
  ListChecks,
  Sparkles,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, addMonths, diffDays, localDate, startOfWeek, startOfYear } from "@/lib/domain/dates";
import { type Comparison, formatDuration } from "@/lib/domain/stats";
import {
  bucketize,
  comparisonSentences,
  consistencyTrend,
  lastMonths,
  periodComparisons,
  personalRecords,
  rollingAverage,
  type PeriodComparison,
} from "@/lib/domain/analytics";
import { getDaily } from "@/lib/data/stats";
import { getAccountStart, getLongestSession, getRestDays } from "@/lib/data/analytics";
import { formatShortDate } from "@/lib/format";
import type { Tone } from "@/lib/sections";
import { Card, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { LineChart } from "@/components/charts/line-chart";
import { Units } from "@/components/stats/units";
import { FeatureShade } from "@/components/stats/feature-shade";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Tendencias" };

const PERIOD_TITLE = { week: "Esta semana", month: "Este mes", year: "Este año" } as const;
const PERIOD_ICON = { week: CalendarDays, month: CalendarRange, year: Sparkles } as const;
const monthFmt = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });
const monthYearFmt = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" });

/** Chip de variación: verde si sube, rojo si baja. Sobre la tarjeta destacada, en blanco translúcido. */
function DeltaChip({ c, onFeature }: { c: Comparison; onFeature?: boolean }) {
  if (c.pct === null || c.previous <= 0) return null;
  const Icon = c.trend === "up" ? ArrowUpRight : c.trend === "down" ? ArrowDownRight : ArrowRight;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 whitespace-nowrap rounded-full px-1.5 py-0.5 text-[11px] font-semibold",
        onFeature ? "bg-surface-3" : c.trend === "up" ? "bg-success-soft text-success" : c.trend === "down" ? "bg-danger-soft text-danger" : "bg-surface-2 text-muted",
      )}
    >
      <Icon size={11} aria-hidden />
      {Math.abs(Math.round(c.pct * 100))} %
    </span>
  );
}

function DeltaCell({ c, format, onFeature }: { c: Comparison; format: (v: number) => string; onFeature?: boolean }) {
  return (
    <td className="py-2 pl-2 text-right tabular">
      {/* Cada pieza se mantiene entera: si no cabe, salta de línea completa. */}
      <span className="inline-flex flex-wrap items-baseline justify-end gap-x-1.5 gap-y-1">
        <span className="whitespace-nowrap font-display text-[15px] font-semibold">{format(c.current)}</span>
        <span className="whitespace-nowrap text-xs text-muted">vs {format(c.previous)}</span>
        <DeltaChip c={c} onFeature={onFeature} />
      </span>
    </td>
  );
}

const ROWS: { key: "focus" | "tasks" | "habits" | "activeDays"; label: string; icon: typeof Timer; tone: Tone }[] = [
  { key: "focus", label: "Concentración", icon: Timer, tone: "cyan" },
  { key: "tasks", label: "Tareas", icon: CheckCircle2, tone: "blue" },
  { key: "habits", label: "Hábitos", icon: Flame, tone: "orange" },
  { key: "activeDays", label: "Días activos", icon: Activity, tone: "green" },
];

/** Comparativa de un período. La semana en curso es la tarjeta destacada de la página. */
function ComparisonCard({ c, featured }: { c: PeriodComparison; featured?: boolean }) {
  const sentences = comparisonSentences(c);
  const count = (v: number) => String(v);
  const Icon = PERIOD_ICON[c.kind];
  return (
    <Card variant={featured ? "feature" : "glass"} className="flex flex-col">
      {featured && <FeatureShade />}
      <div className="relative mb-4 flex items-center gap-3">
        <span className={cn("grid h-10 w-10 shrink-0 place-items-center rounded-2xl", featured ? "bg-surface-3" : "tone-chip")} aria-hidden>
          <Icon size={18} />
        </span>
        <div className="min-w-0">
          <h2 className="font-display text-[19px] font-semibold leading-tight">{PERIOD_TITLE[c.kind]}</h2>
          <p className="mt-0.5 text-xs text-muted">
            {formatShortDate(c.current.from)}–{formatShortDate(c.current.to)} frente a {formatShortDate(c.previous.from)}–{formatShortDate(c.previous.to)}
          </p>
        </div>
      </div>
      <table className="relative w-full text-sm">
        <tbody>
          {ROWS.map((r) => (
            <tr key={r.key} className={featured ? "border-b border-border last:border-0" : "border-b border-border/60 last:border-0"}>
              <th scope="row" className="py-2 text-left font-normal text-muted">
                <span className="inline-flex items-center gap-2">
                  <span data-tone={featured ? undefined : r.tone} className={cn("grid h-6 w-6 place-items-center rounded-lg", featured ? "bg-surface-2" : "tone-chip-soft")} aria-hidden>
                    <r.icon size={12} />
                  </span>
                  {r.label}
                </span>
              </th>
              <DeltaCell c={c[r.key]} format={r.key === "focus" ? formatDuration : count} onFeature={featured} />
            </tr>
          ))}
        </tbody>
      </table>
      {sentences.length > 0 && (
        <ul className={cn("relative mt-4 space-y-2 rounded-2xl p-3.5 text-sm leading-snug", featured ? "bg-surface" : "bg-surface-2/60")}>
          {sentences.map((s) => (
            <li key={s} className="flex gap-2">
              <span className={cn("mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full", featured ? "bg-text" : "bg-tone")} aria-hidden />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
      {c.previousBeforeAccount && <p className="relative mt-auto pt-3 text-xs text-muted">Tu cuenta es más reciente que el período anterior: la comparación es parcial.</p>}
    </Card>
  );
}

export default async function TrendsPage() {
  const { supabase, profile, today } = await requireUser();
  const ws = profile.week_starts_on;
  // Una sola consulta cubre el año anterior completo (comparativa anual) y las últimas 53 semanas (calendario).
  const windowFrom = [startOfYear(addMonths(today, -12)), addDays(today, -370)].sort()[0];
  const [days, accountStart, restDays, longest] = await Promise.all([
    getDaily(supabase, windowFrom, today),
    getAccountStart(supabase, profile.timezone),
    getRestDays(supabase, windowFrom),
    getLongestSession(supabase),
  ]);

  const comparisons = periodComparisons(days, today, ws, accountStart);

  // Calendario: al menos 26 semanas; más si la cuenta es más antigua (máx. 53).
  const minFrom = addDays(today, -181);
  const heatFrom = accountStart && accountStart < minFrom ? (accountStart < addDays(today, -364) ? addDays(today, -364) : accountStart) : minFrom;

  const weekBuckets = bucketize(
    days.filter((d) => d.day >= addDays(startOfWeek(today, ws), -7 * 11)),
    "week",
    ws,
  );
  const monthKeys = lastMonths(today, 12);
  const monthBuckets = new Map(bucketize(days.filter((d) => d.day >= monthKeys[0]), "month").map((b) => [b.key, b]));

  const last90 = days.filter((d) => d.day > addDays(today, -90));
  const focusAvg = rollingAverage(last90.map((d) => d.focus_seconds / 60), 7);
  const tasksAvg = rollingAverage(last90.map((d) => d.tasks_completed), 7);
  const trend = consistencyTrend(days, today, restDays, accountStart);
  const records = personalRecords(days, ws, restDays);
  const sinceLabel = formatShortDate(accountStart && accountStart > windowFrom ? accountStart : windowFrom);

  return (
    <div className="space-y-6">
      <div>
        <section className="grid gap-4 lg:grid-cols-3">
          {comparisons.map((c, i) => (
            <ComparisonCard key={c.kind} c={c} featured={i === 0} />
          ))}
        </section>
        <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
          <ArrowRight size={12} className="shrink-0 text-tone" aria-hidden />
          Cada período en curso se compara con el mismo número de días del período anterior, para que la comparación sea justa.
        </p>
      </div>

      <Card data-reveal>
        <CardTitle icon={<CalendarDays />} subtitle="Cada casilla es un día. Toca uno para abrir sus estadísticas.">
          Calendario de actividad
        </CardTitle>
        <CalendarHeatmap days={days} from={heatFrom} to={today} weekStartsOn={ws} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2" data-reveal>
        <Card>
          <CardTitle icon={<BarChart3 />} subtitle="Minutos de concentración por semana">
            Últimas 12 semanas
          </CardTitle>
          <BarChart
            unit="minutes"
            average
            height={170}
            bars={weekBuckets.map((b) => ({
              key: b.key,
              label: formatShortDate(b.key),
              value: Math.round(b.totals.focus_seconds / 60),
              tooltip: `Semana del ${formatShortDate(b.key)}: ${formatDuration(b.totals.focus_seconds)} · ${b.totals.tasks_completed} tareas · ${b.totals.active_days} días activos`,
              highlight: b.to === today,
            }))}
          />
          <p className="mt-2 text-xs text-muted">Toca una barra para ver tareas y días activos.</p>
        </Card>
        <Card tone="green">
          <CardTitle icon={<ListChecks />} subtitle="Tareas completadas por mes">
            Últimos 12 meses
          </CardTitle>
          <BarChart
            unit="count"
            average
            height={170}
            bars={monthKeys.map((k) => {
              const b = monthBuckets.get(k);
              return {
                key: k,
                label: monthFmt.format(new Date(`${k}T00:00:00Z`)),
                value: b?.totals.tasks_completed ?? 0,
                tooltip: `${monthYearFmt.format(new Date(`${k}T00:00:00Z`))}: ${b?.totals.tasks_completed ?? 0} tareas · ${formatDuration(b?.totals.focus_seconds ?? 0)} · ${b?.totals.active_days ?? 0} días activos`,
                highlight: k === monthKeys[monthKeys.length - 1],
              };
            })}
          />
          <p className="mt-2 text-xs text-muted">Toca una barra para ver concentración y días activos.</p>
        </Card>
      </div>

      <Card data-reveal>
        <CardTitle icon={<LineIcon />} subtitle="Media móvil de 7 días">
          Tendencia de 90 días
        </CardTitle>
        {trend ? (
          <p
            className={cn(
              "-mt-1 mb-5 inline-flex items-center gap-2 rounded-2xl px-3 py-2 text-sm font-medium",
              trend.trend === "up" ? "bg-success-soft text-success" : trend.trend === "down" ? "bg-warning-soft text-warning" : "bg-surface-2 text-text",
            )}
          >
            <TrendingUp size={15} className={cn("shrink-0", trend.trend === "down" && "rotate-180")} aria-hidden />
            {trend.sentence}
          </p>
        ) : (
          <p className="-mt-1 mb-5 inline-flex items-center gap-2 rounded-2xl bg-surface-2/70 px-3 py-2 text-sm text-muted">
            <Sparkles size={15} className="shrink-0 text-tone" aria-hidden />
            Con unas semanas más de registros verás aquí si tu constancia mejora.
          </p>
        )}
        <LineChart
          labels={last90.map((d) => formatShortDate(d.day))}
          independent
          height={190}
          series={[
            { label: "Concentración (media 7 días)", color: "var(--tone)", values: focusAvg, unit: "minutes", area: true },
            { label: "Tareas por día (media 7 días)", color: "var(--tone-2)", values: tasksAvg, unit: "count", dashed: true },
          ]}
        />
        <p className="mt-3 text-xs text-muted">Cada línea usa su propia escala. La media móvil suaviza los días sueltos para que se vea la tendencia real.</p>
      </Card>

      <Card tone="gold" data-reveal>
        <CardTitle icon={<Trophy />} subtitle={`Desde el ${sinceLabel}.`}>
          Récords personales
        </CardTitle>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Record
            tone="cyan"
            icon={<Timer />}
            label="Mejor día de concentración"
            value={records.bestFocusDay ? formatDuration(records.bestFocusDay.seconds) : null}
            detail={records.bestFocusDay && formatShortDate(records.bestFocusDay.day)}
          />
          <Record
            tone="blue"
            icon={<Award />}
            label="Más tareas en un día"
            value={records.bestTasksDay ? String(records.bestTasksDay.tasks) : null}
            detail={records.bestTasksDay && formatShortDate(records.bestTasksDay.day)}
          />
          <Record
            tone="indigo"
            icon={<CalendarDays />}
            label="Mejor semana"
            value={records.bestWeek ? formatDuration(records.bestWeek.seconds) : null}
            detail={records.bestWeek && `Semana del ${formatShortDate(records.bestWeek.from)}`}
          />
          <Record
            tone="violet"
            icon={<CalendarRange />}
            label="Mejor mes"
            value={records.bestMonth ? formatDuration(records.bestMonth.seconds) : null}
            detail={records.bestMonth && monthYearFmt.format(new Date(`${records.bestMonth.month}T00:00:00Z`))}
          />
          <Record
            tone="orange"
            icon={<Flame />}
            label="Racha más larga"
            value={records.longestActiveRun ? `${records.longestActiveRun.days} días` : null}
            detail={
              records.longestActiveRun &&
              `${formatShortDate(records.longestActiveRun.from)}–${formatShortDate(records.longestActiveRun.to)}${diffDays(records.longestActiveRun.to, records.longestActiveRun.from) + 1 > records.longestActiveRun.days ? " (con descansos)" : ""}`
            }
          />
          <Record
            tone="coral"
            icon={<Timer />}
            label="Sesión más larga"
            value={longest ? formatDuration(longest.focus_seconds) : null}
            detail={longest && `${formatShortDate(localDate(new Date(longest.started_at), profile.timezone))} · de toda tu historia`}
          />
        </ul>
      </Card>
      <p className="text-xs text-muted">Todo se calcula con lo que registras: sesiones, tareas y hábitos. Nada es estimado ni inventado.</p>
    </div>
  );
}

/** Récord con ficha de color. La etiqueta y la cifra comparten contenedor (las pruebas leen la cifra desde la etiqueta). */
function Record({ icon, label, value, detail, tone }: { icon: React.ReactNode; label: string; value: string | null; detail?: string | null; tone: Tone }) {
  return (
    <li
      data-tone={tone}
      className="group relative flex items-start gap-3 overflow-hidden rounded-[20px] border border-border/70 bg-surface/50 p-4 transition-[transform,border-color,box-shadow] duration-300 hover:-translate-y-0.5 hover:border-[color:color-mix(in_srgb,var(--tone)_35%,var(--border))] hover:shadow-[0_14px_30px_-18px_var(--tone)]"
    >
      <div className="pointer-events-none absolute -right-8 -top-10 h-24 w-24 rounded-full bg-tone opacity-[0.1] blur-2xl transition-opacity duration-300 group-hover:opacity-25" aria-hidden />
      <span className={cn("h-10 w-10 rounded-2xl transition-transform duration-300 group-hover:-rotate-6 [&_svg]:h-[18px] [&_svg]:w-[18px]", value ? "tone-chip" : "tone-chip-soft")} aria-hidden>
        {icon}
      </span>
      <div className="relative min-w-0">
        <p className="text-xs font-medium text-muted">{label}</p>
        <p className={cn("num-xl mt-1.5 text-[24px]", !value && "text-faint")}>{value ? <Units text={value} /> : "—"}</p>
        <p className="mt-1 text-xs text-muted">{value ? detail : "Aún sin datos"}</p>
      </div>
    </li>
  );
}
