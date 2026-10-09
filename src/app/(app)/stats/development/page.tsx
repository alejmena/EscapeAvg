import type { Metadata } from "next";
import Link from "next/link";
import { Award, CalendarDays, Crown, Flame, Sparkles, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import { getDiscipline } from "@/lib/data/discipline";
import { developmentReport, records, series, type Granularity } from "@/lib/domain/development";
import { goalLabel, hoursText, rankLabel, RANKS } from "@/lib/domain/discipline";
import { formatShortDate } from "@/lib/format";
import { Card, CardTitle } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Desarrollo" };

const GRAN: { id: Granularity; label: string; title: string }[] = [
  { id: "day", label: "Días", title: "Últimos 30 días" },
  { id: "week", label: "Semanas", title: "Últimas 12 semanas" },
  { id: "month", label: "Meses", title: "Últimos 12 meses" },
  { id: "year", label: "Años", title: "Por año" },
];
const monthFmt = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });
const monthYearFmt = new Intl.DateTimeFormat("es", { month: "long", year: "numeric", timeZone: "UTC" });
const h1 = (s: number) => (s / 3600).toLocaleString("es", { maximumFractionDigits: 1 });

export default async function DevelopmentPage({ searchParams }: { searchParams: Promise<{ g?: string }> }) {
  const { g } = await searchParams;
  const gran = GRAN.find((x) => x.id === g) ?? GRAN[0];
  const { supabase, profile, today } = await requireUser();
  const data = await getDiscipline(supabase, profile, addDays(today, -1100), today);
  const report = developmentReport(data.days, today, data.categories);
  const rec = records(data.days, data.goalMinutes, profile.week_starts_on, data.restDays);
  const firstDay = [...data.days.keys()].sort()[0];
  const points = series(data.days, today, gran.id, profile.week_starts_on, firstDay);
  const maxCat = Math.max(1, ...report.current.map((c) => c.seconds));

  return (
    <div className="space-y-6">
      <section className="card-glass relative overflow-hidden rounded-[28px] p-6 sm:p-8" data-testid="development">
        <div className="animate-glow pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-gradient-to-br from-accent/35 via-accent-2/20 to-transparent blur-3xl" aria-hidden />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_1.1fr]">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">Tu desarrollo en los últimos 30 días</p>
            <p className="mt-3 flex items-baseline gap-2">
              <span className="num-xl text-gradient text-[56px] sm:text-[72px]">{h1(report.totalSeconds)}</span>
              <span className="text-lg font-medium text-muted">horas de desarrollo personal</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              Media de {hoursText(report.avgDaily)} al día · solo horas productivas, sin solapes ni descansos.
            </p>
            {report.insights.length > 0 && (
              <ul className="mt-5 space-y-2" data-testid="insights">
                {report.insights.map((t) => (
                  <li key={t} className="flex gap-2 text-[15px] font-medium leading-snug">
                    <Sparkles size={16} className="mt-0.5 shrink-0 text-accent" />
                    {t}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div>
            {report.current.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border p-6 text-center text-sm text-muted">
                Aún no hay actividades en estos 30 días. Registra la primera desde{" "}
                <Link href="/focus" className="text-accent hover:underline">
                  Concentración
                </Link>
                .
              </p>
            ) : (
              <ul className="space-y-3" aria-label="Horas por categoría">
                {report.current.map((c) => (
                  <li key={c.id ?? "none"}>
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex items-center gap-2 font-medium">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: c.color }} aria-hidden />
                        {c.name}
                      </span>
                      <span className="tabular">
                        <span className="font-semibold">{h1(c.seconds)} h</span>
                        <span className="text-xs text-muted"> · {c.activeDays} días</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="bar-in h-full rounded-full" style={{ width: `${(c.seconds / maxCat) * 100}%`, background: c.color }} />
                    </div>
                  </li>
                ))}
                <li className="flex justify-between border-t border-border pt-3 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular">{h1(report.totalSeconds)} horas</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      </section>

      <Card>
        <CardTitle
          action={
            <nav className="flex rounded-xl border border-border p-0.5 text-xs" aria-label="Agrupar por">
              {GRAN.map((x) => (
                <Link
                  key={x.id}
                  href={`/stats/development?g=${x.id}`}
                  scroll={false}
                  aria-current={x.id === gran.id ? "page" : undefined}
                  className={cn("rounded-lg px-2.5 py-1", x.id === gran.id ? "bg-accent-soft font-medium text-accent" : "text-muted")}
                >
                  {x.label}
                </Link>
              ))}
            </nav>
          }
        >
          {gran.title}
        </CardTitle>
        <BarChart
          height={160}
          bars={points.map((p) => ({
            key: p.key,
            label:
              gran.id === "day"
                ? String(Number(p.from.slice(8)))
                : gran.id === "week"
                  ? formatShortDate(p.from)
                  : gran.id === "month"
                    ? monthFmt.format(new Date(`${p.from}T00:00:00Z`))
                    : p.from.slice(0, 4),
            value: Math.round(p.seconds / 60),
            tooltip: `${gran.id === "month" ? monthYearFmt.format(new Date(`${p.from}T00:00:00Z`)) : gran.id === "year" ? p.from.slice(0, 4) : p.from === p.to ? formatShortDate(p.from) : `${formatShortDate(p.from)}–${formatShortDate(p.to)}`}: ${hoursText(p.seconds)}`,
            highlight: p.from <= today && today <= p.to,
          }))}
          emptyText="Sin horas de desarrollo en este período"
        />
      </Card>

      <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="Récords históricos">
        {[
          { icon: <Trophy size={18} />, label: "Mejor día", value: rec.bestDay ? hoursText(rec.bestDay.seconds) : "—", sub: rec.bestDay ? formatShortDate(rec.bestDay.day) : "Sin datos" },
          { icon: <CalendarDays size={18} />, label: "Mejor semana", value: rec.bestWeek ? hoursText(rec.bestWeek.seconds) : "—", sub: rec.bestWeek ? `desde ${formatShortDate(rec.bestWeek.from)}` : "Sin datos" },
          { icon: <Award size={18} />, label: "Mejor mes", value: rec.bestMonth ? hoursText(rec.bestMonth.seconds) : "—", sub: rec.bestMonth ? monthYearFmt.format(new Date(`${rec.bestMonth.from}T00:00:00Z`)) : "Sin datos" },
          { icon: <Flame size={18} />, label: "Racha de objetivos", value: `${rec.longestGoalStreak} ${rec.longestGoalStreak === 1 ? "día" : "días"}`, sub: `${rec.goalDays} días cumplidos en total` },
        ].map((t) => (
          <Card key={t.label} className="p-4 sm:p-5">
            <div className="flex items-center gap-2.5">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-2)] text-white shadow-float">{t.icon}</span>
              <p className="text-xs font-medium leading-tight text-muted">{t.label}</p>
            </div>
            <p className="num-xl mt-3 text-[20px] sm:text-[24px]">{t.value}</p>
            <p className="mt-1 text-xs text-muted">{t.sub}</p>
          </Card>
        ))}
      </section>

      <Card>
        <CardTitle icon={<Crown size={15} />}>Días por rango alcanzado</CardTitle>
        <p className="-mt-2 mb-4 text-xs text-muted">
          Total histórico: {h1(rec.totalSeconds)} horas de desarrollo. Objetivo actual: {goalLabel(data.goalMinutes)}.
        </p>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {rec.rankDays.map((r) => {
            const rank = RANKS.find((x) => x.id === r.id)!;
            return (
              <li key={r.id} className={cn("flex items-center justify-between rounded-xl px-3 py-2 text-sm", r.days ? "bg-surface-2" : "bg-surface-2/40 text-muted")}>
                <span className="truncate">{rankLabel(rank)}</span>
                <span className="font-semibold tabular">{r.days}</span>
              </li>
            );
          })}
        </ul>
        <p className="mt-3 text-xs text-muted">Los porcentajes son rangos simbólicos internos, no estadísticas de población.</p>
      </Card>
    </div>
  );
}
