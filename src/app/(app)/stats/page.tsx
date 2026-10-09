import type { Metadata } from "next";
import { CalendarCheck, CheckCircle2, Clock, Flame, Gauge, Timer, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, addMonths, diffDays, isISODate, startOfMonth, type ISODate, zonedDayStart } from "@/lib/domain/dates";
import { compare, describeChange, estimateAccuracy, formatDuration, periodRanges, previousRange, totals, type Comparison, type DailyStat } from "@/lib/domain/stats";
import { formatShortDate } from "@/lib/format";
import { getByCategory, getDaily, getHabitCompliance, getHourly, getRecommendations } from "@/lib/data/stats";
import { Card, CardTitle } from "@/components/ui/card";
import { BarChart, HBar } from "@/components/charts/bar-chart";
import { RangePicker } from "@/components/stats/range-picker";
import { RecommendationList } from "@/components/dashboard/recommendations";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Estadísticas" };

type Range = { from: ISODate; to: ISODate };

function resolveRange(kind: string, today: ISODate, weekStartsOn: number, from?: string, to?: string) {
  if (kind === "day" || kind === "week" || kind === "month" || kind === "ytd") {
    const r = periodRanges(kind === "ytd" ? "year" : kind, today, weekStartsOn);
    const label = { day: "ayer", week: "los mismos días de la semana anterior", month: "los mismos días del mes anterior", ytd: "los mismos días del año anterior" }[kind];
    return { ...r, label };
  }
  let current: Range;
  if (kind === "90d") current = { from: addDays(today, -89), to: today };
  else if (kind === "year") current = { from: startOfMonth(addMonths(today, -11)), to: today };
  else if (kind === "custom" && from && to && isISODate(from) && isISODate(to) && from <= to) {
    current = { from, to: to > today ? today : to };
    if (diffDays(current.to, current.from) > 730) current.from = addDays(current.to, -730);
  } else current = { from: addDays(today, -29), to: today };
  return { current, previous: previousRange(current), label: "el período anterior de igual duración" };
}

function Stat({ icon, label, value, c, prevLabel, hint }: { icon: React.ReactNode; label: string; value: string; c?: Comparison; prevLabel?: string; hint?: string }) {
  return (
    <Card className="p-4">
      <p className="flex items-center gap-1.5 text-xs text-muted">
        {icon} {label}
      </p>
      <p className="mt-2 text-2xl font-semibold tabular">{value}</p>
      {c && prevLabel && <p className={cn("mt-1 text-xs", c.trend === "up" && c.pct !== null ? "text-success" : "text-muted")}>{describeChange(c, prevLabel)}</p>}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </Card>
  );
}

/** Agrupa días en semanas o meses cuando el rango es largo, para que el gráfico sea legible. */
function bucket(days: DailyStat[]): { key: string; label: string; days: DailyStat[] }[] {
  if (days.length <= 31) return days.map((d) => ({ key: d.day, label: String(Number(d.day.slice(8))), days: [d] }));
  if (days.length <= 120) {
    const out: { key: string; label: string; days: DailyStat[] }[] = [];
    for (let i = 0; i < days.length; i += 7) {
      const chunk = days.slice(i, i + 7);
      out.push({ key: chunk[0].day, label: formatShortDate(chunk[0].day), days: chunk });
    }
    return out;
  }
  const months = new Map<string, DailyStat[]>();
  for (const d of days) months.set(d.day.slice(0, 7), [...(months.get(d.day.slice(0, 7)) ?? []), d]);
  const fmt = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });
  return [...months].map(([k, ds]) => ({ key: k, label: fmt.format(new Date(`${k}-01T00:00:00Z`)), days: ds }));
}

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ range?: string; from?: string; to?: string }> }) {
  const sp = await searchParams;
  const kind = sp.range ?? "week";
  const { supabase, profile, today } = await requireUser();
  const { current, previous, label } = resolveRange(kind, today, profile.week_starts_on, sp.from, sp.to);

  const [days, prevDays, cats, hourly, habitsNow, habitsPrev, dueTasks, estimated, recs] = await Promise.all([
    getDaily(supabase, current.from, current.to),
    getDaily(supabase, previous.from, previous.to),
    getByCategory(supabase, current.from, current.to),
    getHourly(supabase, current.from, current.to),
    getHabitCompliance(supabase, current.from, current.to, today, profile.week_starts_on),
    getHabitCompliance(supabase, previous.from, previous.to, today, profile.week_starts_on),
    supabase.from("tasks").select("status").is("parent_id", null).neq("status", "archived").gte("due_date", current.from).lte("due_date", current.to),
    supabase
      .from("tasks")
      .select("estimated_minutes, actual_seconds, completed_at")
      .eq("status", "done")
      .not("estimated_minutes", "is", null)
      .gte("completed_at", zonedDayStart(current.from, profile.timezone))
      .lt("completed_at", zonedDayStart(addDays(current.to, 1), profile.timezone)),
    getRecommendations(supabase, today, profile.timezone, profile.week_starts_on),
  ]);

  const t = totals(days);
  const p = totals(prevDays);
  const due = (dueTasks.data ?? []) as { status: string }[];
  const dueDone = due.filter((x) => x.status === "done").length;
  const acc = estimateAccuracy((estimated.data ?? []) as { estimated_minutes: number | null; actual_seconds: number }[]);
  const avgSession = t.focus_sessions ? t.focus_seconds / t.focus_sessions : 0;
  const best = days.filter((d) => d.focus_seconds > 0).sort((a, b) => b.focus_seconds - a.focus_seconds).slice(0, 3);
  const buckets = bucket(days);
  const maxCat = Math.max(0, ...cats.map((c) => c.focus_seconds));
  const multiDay = days.length > 1;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-muted">
          {formatShortDate(current.from)}
          {current.from !== current.to && ` – ${formatShortDate(current.to)}`} · comparado con {label}
        </p>
        <RangePicker current={kind} from={current.from} to={current.to} />
      </div>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat icon={<Timer size={14} />} label="Horas de concentración" value={formatDuration(t.focus_seconds)} c={compare(t.focus_seconds, p.focus_seconds)} prevLabel={label} />
        <Stat icon={<CheckCircle2 size={14} />} label="Tareas completadas" value={String(t.tasks_completed)} c={compare(t.tasks_completed, p.tasks_completed)} prevLabel={label} />
        <Stat
          icon={<Flame size={14} />}
          label="Hábitos cumplidos"
          value={habitsNow.rate === null ? String(t.habits_done) : `${Math.round(habitsNow.rate * 100)} %`}
          c={habitsNow.rate !== null && habitsPrev.rate !== null ? compare(Math.round(habitsNow.rate * 100), Math.round(habitsPrev.rate * 100)) : undefined}
          prevLabel={label}
          hint={`${t.habits_done} ${t.habits_done === 1 ? "registro" : "registros"} · descansos excluidos`}
        />
        <Stat icon={<CalendarCheck size={14} />} label="Días activos" value={`${t.active_days}/${t.days}`} c={multiDay ? compare(t.active_days, p.active_days) : undefined} prevLabel={label} />
        <Stat
          icon={<Gauge size={14} />}
          label="Cumplimiento de fechas"
          value={due.length ? `${Math.round((dueDone / due.length) * 100)} %` : "—"}
          hint={due.length ? `${dueDone} de ${due.length} tareas con fecha en el período` : "Sin tareas con fecha en el período"}
        />
        <Stat icon={<Zap size={14} />} label="Sesiones" value={String(t.focus_sessions)} hint={t.focus_sessions ? `Media: ${formatDuration(avgSession)} por sesión` : undefined} />
        <Stat
          icon={<Clock size={14} />}
          label="Estimado vs. real"
          value={acc ? `${acc.ratio.toFixed(2)}×` : "—"}
          hint={acc ? `${acc.sample} tareas · ${acc.ratio > 1 ? "llevan más de lo previsto" : "llevan menos de lo previsto"}` : "Estima tareas y registra tiempo para verlo"}
        />
        <Stat
          icon={<Timer size={14} />}
          label="Interrupciones"
          value={String(t.interruptions)}
          hint={t.focus_sessions ? `${(t.interruptions / t.focus_sessions).toFixed(1)} por sesión` : undefined}
        />
      </section>

      {multiDay && (
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardTitle>Concentración (minutos)</CardTitle>
            <BarChart
              bars={buckets.map((b) => {
                const secs = b.days.reduce((a, d) => a + d.focus_seconds, 0);
                return {
                  key: b.key,
                  label: b.label,
                  value: Math.round(secs / 60),
                  tooltip: `${b.days.length > 1 ? `${formatShortDate(b.days[0].day)}–${formatShortDate(b.days[b.days.length - 1].day)}` : formatShortDate(b.key)}: ${formatDuration(secs)}`,
                  highlight: b.days.some((d) => d.day === today),
                };
              })}
            />
          </Card>
          <Card>
            <CardTitle>Tareas completadas</CardTitle>
            <BarChart
              color="var(--success)"
              bars={buckets.map((b) => {
                const n = b.days.reduce((a, d) => a + d.tasks_completed, 0);
                return {
                  key: b.key,
                  label: b.label,
                  value: n,
                  tooltip: `${b.days.length > 1 ? `${formatShortDate(b.days[0].day)}–${formatShortDate(b.days[b.days.length - 1].day)}` : formatShortDate(b.key)}: ${n} tareas`,
                  highlight: b.days.some((d) => d.day === today),
                };
              })}
            />
          </Card>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardTitle>Por categoría</CardTitle>
          {cats.length === 0 ? (
            <p className="text-sm text-muted">Sin datos en este período.</p>
          ) : (
            <div className="space-y-3">
              {cats.map((c) => (
                <HBar
                  key={c.category_id ?? "none"}
                  label={c.name}
                  value={c.focus_seconds}
                  max={maxCat}
                  color={c.color}
                  right={`${formatDuration(c.focus_seconds)} · ${c.tasks_completed} tareas`}
                />
              ))}
            </div>
          )}
        </Card>
        <Card>
          <CardTitle>Horas del día con más concentración</CardTitle>
          <BarChart
            height={110}
            bars={Array.from({ length: 24 }, (_, h) => {
              const r = hourly.find((x) => x.hour === h);
              return {
                key: String(h),
                label: h % 6 === 0 ? `${h}h` : "",
                value: Math.round((r?.focus_seconds ?? 0) / 60),
                tooltip: `${h}:00–${h + 1}:00 · ${formatDuration(r?.focus_seconds ?? 0)} en ${r?.focus_sessions ?? 0} sesiones`,
              };
            })}
          />
          <p className="mt-2 text-xs text-muted">Según la hora de inicio de cada sesión.</p>
        </Card>
        <Card>
          <CardTitle>Mejores días</CardTitle>
          {best.length === 0 ? (
            <p className="text-sm text-muted">Sin sesiones en este período.</p>
          ) : (
            <ol className="space-y-2">
              {best.map((d, i) => (
                <li key={d.day} className="flex items-center justify-between text-sm">
                  <span>
                    <span className="mr-2 text-muted">{i + 1}.</span>
                    {formatShortDate(d.day)}
                  </span>
                  <span className="tabular text-muted">
                    {formatDuration(d.focus_seconds)} · {d.tasks_completed} tareas
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>

      <Card>
        <CardTitle>Patrones y sugerencias</CardTitle>
        <RecommendationList items={recs} />
      </Card>

      <p className="text-xs text-muted">
        <a href={`/stats/export?from=${current.from}&to=${current.to}`} className="font-medium text-accent hover:underline" download>
          Descargar estos datos (CSV)
        </a>{" "}
        · Todas las cifras se calculan a partir de lo que registras (sesiones, tareas y hábitos). Pasar más horas no siempre significa ser más productivo:
        mira también la constancia, el cumplimiento y la precisión de tus estimaciones. Sin datos en el período anterior no se muestra porcentaje.
      </p>
    </div>
  );
}
