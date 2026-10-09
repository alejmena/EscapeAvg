import type { Metadata } from "next";
import { ArrowDownRight, ArrowRight, ArrowUpRight, Award, CalendarDays, Flame, LineChart as LineIcon, Timer, Trophy } from "lucide-react";
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
import { Card, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { CalendarHeatmap } from "@/components/charts/calendar-heatmap";
import { LineChart } from "@/components/charts/line-chart";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Tendencias" };

const PERIOD_TITLE = { week: "Esta semana", month: "Este mes", year: "Este año" } as const;
const monthFmt = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });
const monthYearFmt = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" });

function DeltaCell({ c, format }: { c: Comparison; format: (v: number) => string }) {
  const Icon = c.trend === "up" ? ArrowUpRight : c.trend === "down" ? ArrowDownRight : ArrowRight;
  return (
    <td className="py-1.5 text-right tabular">
      <span className="font-medium">{format(c.current)}</span>
      <span className="ml-1 text-xs text-muted">vs {format(c.previous)}</span>
      {c.pct !== null && c.previous > 0 && (
        <span className={cn("ml-1.5 inline-flex items-center text-xs", c.trend === "up" ? "text-success" : "text-muted")}>
          <Icon size={11} />
          {Math.abs(Math.round(c.pct * 100))} %
        </span>
      )}
    </td>
  );
}

function ComparisonCard({ c }: { c: PeriodComparison }) {
  const sentences = comparisonSentences(c);
  const count = (v: number) => String(v);
  return (
    <Card>
      <CardTitle>{PERIOD_TITLE[c.kind]}</CardTitle>
      <p className="-mt-3 mb-3 text-xs text-muted">
        {formatShortDate(c.current.from)}–{formatShortDate(c.current.to)} frente a {formatShortDate(c.previous.from)}–{formatShortDate(c.previous.to)}
      </p>
      <table className="w-full text-sm">
        <tbody>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal text-muted">Concentración</th>
            <DeltaCell c={c.focus} format={formatDuration} />
          </tr>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal text-muted">Tareas</th>
            <DeltaCell c={c.tasks} format={count} />
          </tr>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal text-muted">Hábitos</th>
            <DeltaCell c={c.habits} format={count} />
          </tr>
          <tr>
            <th scope="row" className="py-1.5 text-left font-normal text-muted">Días activos</th>
            <DeltaCell c={c.activeDays} format={count} />
          </tr>
        </tbody>
      </table>
      {sentences.length > 0 && (
        <ul className="mt-3 space-y-1 border-t border-border pt-3 text-sm">
          {sentences.map((s) => (
            <li key={s}>{s}</li>
          ))}
        </ul>
      )}
      {c.previousBeforeAccount && <p className="mt-2 text-xs text-muted">Tu cuenta es más reciente que el período anterior: la comparación es parcial.</p>}
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
      <section className="grid gap-4 lg:grid-cols-3">
        {comparisons.map((c) => (
          <ComparisonCard key={c.kind} c={c} />
        ))}
      </section>
      <p className="-mt-3 text-xs text-muted">
        Cada período en curso se compara con el mismo número de días del período anterior, para que la comparación sea justa.
      </p>

      <Card>
        <CardTitle icon={<CalendarDays size={16} />}>Calendario de actividad</CardTitle>
        <CalendarHeatmap days={days} from={heatFrom} to={today} weekStartsOn={ws} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle>Últimas 12 semanas</CardTitle>
          <BarChart
            bars={weekBuckets.map((b) => ({
              key: b.key,
              label: formatShortDate(b.key),
              value: Math.round(b.totals.focus_seconds / 60),
              tooltip: `Semana del ${formatShortDate(b.key)}: ${formatDuration(b.totals.focus_seconds)} · ${b.totals.tasks_completed} tareas · ${b.totals.active_days} días activos`,
              highlight: b.to === today,
            }))}
          />
          <p className="mt-2 text-xs text-muted">Minutos de concentración por semana. Toca una barra para ver tareas y días activos.</p>
        </Card>
        <Card>
          <CardTitle>Últimos 12 meses</CardTitle>
          <BarChart
            color="var(--success)"
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
          <p className="mt-2 text-xs text-muted">Tareas completadas por mes. Toca una barra para ver concentración y días activos.</p>
        </Card>
      </div>

      <Card>
        <CardTitle icon={<LineIcon size={16} />}>Tendencia de 90 días</CardTitle>
        {trend ? (
          <p className={cn("-mt-2 mb-4 text-sm", trend.trend === "up" && "text-success")}>{trend.sentence}</p>
        ) : (
          <p className="-mt-2 mb-4 text-sm text-muted">Con unas semanas más de registros verás aquí si tu constancia mejora.</p>
        )}
        <LineChart
          labels={last90.map((d) => formatShortDate(d.day))}
          independent
          series={[
            { label: "Concentración (media 7 días)", color: "var(--accent)", values: focusAvg, unit: "minutes", area: true },
            { label: "Tareas por día (media 7 días)", color: "var(--success)", values: tasksAvg, unit: "count", dashed: true },
          ]}
        />
        <p className="mt-1 text-xs text-muted">Cada línea usa su propia escala. La media móvil suaviza los días sueltos para que se vea la tendencia real.</p>
      </Card>

      <Card>
        <CardTitle icon={<Trophy size={16} />}>Récords personales</CardTitle>
        <p className="-mt-3 mb-3 text-xs text-muted">Desde el {sinceLabel}.</p>
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <Record icon={<Timer size={15} />} label="Mejor día de concentración" value={records.bestFocusDay ? formatDuration(records.bestFocusDay.seconds) : null} detail={records.bestFocusDay && formatShortDate(records.bestFocusDay.day)} />
          <Record icon={<Award size={15} />} label="Más tareas en un día" value={records.bestTasksDay ? String(records.bestTasksDay.tasks) : null} detail={records.bestTasksDay && formatShortDate(records.bestTasksDay.day)} />
          <Record icon={<CalendarDays size={15} />} label="Mejor semana" value={records.bestWeek ? formatDuration(records.bestWeek.seconds) : null} detail={records.bestWeek && `Semana del ${formatShortDate(records.bestWeek.from)}`} />
          <Record icon={<CalendarDays size={15} />} label="Mejor mes" value={records.bestMonth ? formatDuration(records.bestMonth.seconds) : null} detail={records.bestMonth && monthYearFmt.format(new Date(`${records.bestMonth.month}T00:00:00Z`))} />
          <Record
            icon={<Flame size={15} />}
            label="Racha más larga"
            value={records.longestActiveRun ? `${records.longestActiveRun.days} días` : null}
            detail={records.longestActiveRun && `${formatShortDate(records.longestActiveRun.from)}–${formatShortDate(records.longestActiveRun.to)}${diffDays(records.longestActiveRun.to, records.longestActiveRun.from) + 1 > records.longestActiveRun.days ? " (con descansos)" : ""}`}
          />
          <Record icon={<Timer size={15} />} label="Sesión más larga" value={longest ? formatDuration(longest.focus_seconds) : null} detail={longest && `${formatShortDate(localDate(new Date(longest.started_at), profile.timezone))} · de toda tu historia`} />
        </ul>
      </Card>
      <p className="text-xs text-muted">Todo se calcula con lo que registras: sesiones, tareas y hábitos. Nada es estimado ni inventado.</p>
    </div>
  );
}

function Record({ icon, label, value, detail }: { icon: React.ReactNode; label: string; value: string | null; detail?: string | null }) {
  return (
    <li className="rounded-xl bg-surface-2 p-3">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon}
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular">{value ?? "—"}</p>
      <p className="text-xs text-muted">{value ? detail : "Aún sin datos"}</p>
    </li>
  );
}
