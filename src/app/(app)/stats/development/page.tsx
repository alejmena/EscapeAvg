import type { Metadata } from "next";
import Link from "next/link";
import { Award, BarChart3, CalendarDays, Crown, Flame, GraduationCap, Sparkles, Sprout, Star, Trophy } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays } from "@/lib/domain/dates";
import { getDiscipline } from "@/lib/data/discipline";
import { developmentReport, etaText, mastery, MASTERY_HOURS, MASTERY_LEVELS, records, series, type Granularity } from "@/lib/domain/development";
import { goalLabel, hoursText, rankLabel, RANKS } from "@/lib/domain/discipline";
import { formatShortDate } from "@/lib/format";
import { buttonClass } from "@/components/ui/button";
import { Badge, Card, CardTitle, EmptyState, ProgressRing, StatTile } from "@/components/ui/card";
import { BarChart } from "@/components/charts/bar-chart";
import { Units } from "@/components/stats/units";
import { FeatureShade } from "@/components/stats/feature-shade";
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
  const data = await getDiscipline(supabase, profile, addDays(today, -3650), today);
  const report = developmentReport(data.days, today, data.categories);
  const rec = records(data.days, data.goalMinutes, profile.week_starts_on, data.restDays);
  const firstDay = [...data.days.keys()].sort()[0];
  const points = series(data.days, today, gran.id, profile.week_starts_on, firstDay);
  const maxCat = Math.max(1, ...report.current.map((c) => c.seconds));
  const skills = mastery(data.days, today, data.categories);
  const maxRankDays = Math.max(1, ...rec.rankDays.map((r) => r.days));

  return (
    <div className="space-y-6">
      {/* Protagonista: horas de desarrollo de los últimos 30 días. */}
      <section className="card-feature relative overflow-hidden rounded-[28px] p-6 sm:p-8" data-testid="development">
        <FeatureShade />
        <div className="relative grid gap-8 lg:grid-cols-[1fr_1.1fr] lg:gap-10">
          <div className="min-w-0">
            <p className="eyebrow flex items-center gap-2">
              <Sprout size={14} aria-hidden /> Tu desarrollo en los últimos 30 días
            </p>
            <p className="mt-4 flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="num-xl text-[64px] drop-shadow-[0_8px_24px_rgb(0_0_0/0.15)] sm:text-[84px]">{h1(report.totalSeconds)}</span>
              <span className="text-lg font-medium text-muted">horas de desarrollo personal</span>
            </p>
            <p className="mt-2 text-sm text-muted">
              Media de {hoursText(report.avgDaily)} al día · solo horas productivas, sin solapes ni descansos.
            </p>
            {report.insights.length > 0 && (
              <ul className="mt-6 space-y-2.5" data-testid="insights">
                {report.insights.map((t) => (
                  <li key={t} className="flex gap-3 text-[15px] font-medium leading-snug">
                    <span className="grid h-7 w-7 shrink-0 place-items-center rounded-xl bg-surface-3" aria-hidden>
                      <Sparkles size={14} />
                    </span>
                    <span className="pt-0.5">{t}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="min-w-0 rounded-[22px] border border-border bg-surface p-4 backdrop-blur-sm sm:p-5">
            {report.current.length === 0 ? (
              <div className="grid h-full place-items-center gap-3 p-4 text-center text-sm text-muted">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-surface-3 text-text" aria-hidden>
                  <Sprout size={22} />
                </span>
                <p>
                  Aún no hay actividades en estos 30 días. Registra la primera desde{" "}
                  <Link href="/focus" className="font-semibold text-text underline underline-offset-2">
                    Concentración
                  </Link>
                  .
                </p>
              </div>
            ) : (
              <ul className="space-y-1" aria-label="Horas por categoría">
                {report.current.map((c) => (
                  <li key={c.id ?? "none"} className="-mx-2 rounded-2xl px-2 py-2 transition-colors hover:bg-surface-2">
                    <div className="flex items-baseline justify-between gap-2 text-sm">
                      <span className="flex min-w-0 items-center gap-2.5 font-medium">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-border-strong" style={{ background: c.color }} aria-hidden />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="shrink-0 tabular">
                        <span className="font-semibold">{h1(c.seconds)} h</span>
                        <span className="text-xs text-muted"> · {c.activeDays} días</span>
                      </span>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-surface-2">
                      <div className="bar-in h-full rounded-full bg-text shadow-[0_0_12px_rgb(255_255_255/0.5)]" style={{ width: `${Math.max(2, (c.seconds / maxCat) * 100)}%` }} />
                    </div>
                  </li>
                ))}
                <li className="mt-2 flex justify-between border-t border-border pt-3 text-sm font-semibold">
                  <span>Total</span>
                  <span className="tabular">{h1(report.totalSeconds)} horas</span>
                </li>
              </ul>
            )}
          </div>
        </div>
      </section>

      <section className="card-glass relative overflow-hidden rounded-[28px] p-6 sm:p-8" aria-labelledby="mastery-title" data-testid="mastery">
        <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-tone opacity-[0.1] blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-start justify-between gap-4">
          <div className="flex min-w-0 items-start gap-3.5">
            <span className="tone-chip h-11 w-11 rounded-2xl" aria-hidden>
              <GraduationCap size={20} />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Práctica acumulada</p>
              <h2 id="mastery-title" className="font-display text-xl font-semibold leading-tight">
                Maestría por habilidad
              </h2>
              <p className="mt-1 max-w-xl text-sm text-muted">
                Cada hora productiva suma a su habilidad, sea cual sea el tema. Meta de maestría: {MASTERY_HOURS.toLocaleString("es")} h.
              </p>
            </div>
          </div>
        </div>
        {/* Escalera de niveles. */}
        <ol className="relative mt-5 flex flex-wrap items-center gap-1.5" aria-label="Niveles de maestría">
          {MASTERY_LEVELS.map((l, i) => (
            <li key={l.name} className="flex items-center gap-1.5">
              <span className={cn("rounded-full px-2.5 py-1 text-[11px] font-semibold", i === MASTERY_LEVELS.length - 1 ? "bg-gradient-to-r from-tone to-tone-2 text-white" : "bg-surface-2 text-muted")}>
                {l.name} <span className="font-normal opacity-75">{l.minHours.toLocaleString("es")} h</span>
              </span>
              {i < MASTERY_LEVELS.length - 1 && <span className="h-px w-2.5 bg-border-strong" aria-hidden />}
            </li>
          ))}
        </ol>
        {skills.length === 0 ? (
          <div className="relative mt-5">
            <EmptyState icon={<GraduationCap />} title="Aún no hay habilidades medidas">
              Asigna una categoría a tus actividades para empezar a medir tu maestría.
            </EmptyState>
          </div>
        ) : (
          <ul className="relative mt-5 grid gap-3 md:grid-cols-2">
            {skills.map((m) => {
              const hours = m.seconds / 3600;
              const toNext = m.next ? (hours - m.level.minHours) / (m.next.minHours - m.level.minHours) : 1;
              return (
                <li key={m.id} className="group relative overflow-hidden rounded-[22px] border border-border bg-surface/60 p-4 transition-[border-color,box-shadow] duration-300 hover:border-border-strong hover:shadow-float sm:p-5">
                  <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full opacity-20 blur-2xl transition-opacity duration-300 group-hover:opacity-35" style={{ background: m.color }} aria-hidden />
                  <div className="relative flex items-center gap-4">
                    <ProgressRing value={toNext} size={58} stroke={6} color={m.color}>
                      <span className="font-display text-[13px] font-bold tabular">{Math.round(hours).toLocaleString("es")} h</span>
                    </ProgressRing>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="flex min-w-0 items-center gap-2 font-display text-[17px] font-semibold">
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: m.color }} aria-hidden />
                          <span className="truncate">{m.name}</span>
                        </span>
                        <Badge color={m.color}>{m.level.name}</Badge>
                      </div>
                      <p className="mt-1 text-sm">
                        Llevas <span className="font-semibold tabular">{Math.round(m.seconds / 3600).toLocaleString("es")} h</span>: por encima del{" "}
                        <span className="font-semibold">{m.percentile} %</span> de las personas <span className="text-muted">(simbólico)</span>.
                      </p>
                    </div>
                  </div>
                  {/* Un tramo por nivel: se ve el avance aunque la meta de maestría quede lejos. */}
                  <div className="relative mt-4 flex gap-1" aria-hidden>
                    {MASTERY_LEVELS.slice(0, -1).map((l, i) => {
                      const hi = MASTERY_LEVELS[i + 1].minHours;
                      const fill = Math.max(0, Math.min(1, (hours - l.minHours) / (hi - l.minHours)));
                      return (
                        <div key={l.name} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-2" title={`${l.name} → ${MASTERY_LEVELS[i + 1].name}`}>
                          <div className="bar-in h-full rounded-full" style={{ width: `${fill * 100}%`, minWidth: fill > 0 ? 4 : 0, background: m.color, boxShadow: `0 0 10px -2px ${m.color}` }} />
                        </div>
                      );
                    })}
                  </div>
                  <p className="relative mt-2 text-xs leading-relaxed text-muted">
                    {(m.progress * 100).toLocaleString("es", { maximumFractionDigits: 1 })} % hacia la maestría
                    {m.next && ` · ${Math.ceil(m.next.minHours - m.seconds / 3600)} h para «${m.next.name}»`}
                    {m.etaDays !== null && ` · a tu ritmo actual (${hoursText(m.recentDaily * 3600)}/día), maestría en ${etaText(m.etaDays)}`}
                  </p>
                </li>
              );
            })}
          </ul>
        )}
        <p className="relative mt-5 text-xs leading-relaxed text-muted">
          El porcentaje de personas es una escala simbólica interna, no una estadística real. La meta de {MASTERY_HOURS.toLocaleString("es")} h es orientativa: la
          investigación sobre práctica deliberada muestra que las horas necesarias varían mucho según la habilidad.
        </p>
      </section>

      <Card data-reveal>
        <CardTitle
          icon={<BarChart3 />}
          subtitle="Horas de desarrollo personal"
          className="flex-wrap"
          action={
            <nav className="seg" aria-label="Agrupar por">
              {GRAN.map((x) => (
                <Link key={x.id} href={`/stats/development?g=${x.id}`} scroll={false} aria-current={x.id === gran.id ? "page" : undefined} className="press h-7 px-2.5 text-xs">
                  {x.label}
                </Link>
              ))}
            </nav>
          }
        >
          {gran.title}
        </CardTitle>
        <BarChart
          height={180}
          unit="minutes"
          average
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

      <div data-reveal>
        <p className="eyebrow mb-3 flex items-center gap-2">
          <Trophy size={13} aria-hidden /> Récords históricos
        </p>
        <section className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Récords históricos">
          <StatTile tone="gold" icon={<Trophy />} label="Mejor día" value={<Units text={rec.bestDay ? hoursText(rec.bestDay.seconds) : "—"} />} footnote={rec.bestDay ? formatShortDate(rec.bestDay.day) : "Sin datos"} />
          <StatTile
            tone="amber"
            icon={<CalendarDays />}
            label="Mejor semana"
            value={<Units text={rec.bestWeek ? hoursText(rec.bestWeek.seconds) : "—"} />}
            footnote={rec.bestWeek ? `desde ${formatShortDate(rec.bestWeek.from)}` : "Sin datos"}
          />
          <StatTile
            tone="orange"
            icon={<Award />}
            label="Mejor mes"
            value={<Units text={rec.bestMonth ? hoursText(rec.bestMonth.seconds) : "—"} />}
            footnote={rec.bestMonth ? monthYearFmt.format(new Date(`${rec.bestMonth.from}T00:00:00Z`)) : "Sin datos"}
          />
          <StatTile
            tone="coral"
            icon={<Flame />}
            label="Racha de objetivos"
            value={<Units text={`${rec.longestGoalStreak} ${rec.longestGoalStreak === 1 ? "día" : "días"}`} />}
            footnote={`${rec.goalDays} días cumplidos en total`}
          />
        </section>
      </div>

      <Card data-reveal>
        <CardTitle icon={<Crown />} subtitle={`Total histórico: ${h1(rec.totalSeconds)} horas de desarrollo. Objetivo actual: ${goalLabel(data.goalMinutes)}.`}>
          Días por rango alcanzado
        </CardTitle>
        <ul className="grid grid-cols-2 gap-2.5 lg:grid-cols-4">
          {rec.rankDays.map((r) => {
            const rank = RANKS.find((x) => x.id === r.id)!;
            return (
              <li
                key={r.id}
                data-tone={rank.milestone ? "gold" : undefined}
                className={cn(
                  "group relative overflow-hidden rounded-2xl border p-3.5 transition-[transform,border-color] duration-300 hover:-translate-y-0.5",
                  r.days ? "border-[color:color-mix(in_srgb,var(--tone)_25%,var(--border))] bg-tone-soft/50" : "border-border bg-surface-2/40",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className={cn("min-w-0 text-[13px] font-semibold leading-snug", !r.days && "text-muted")}>
                    {rank.milestone && <Star size={11} className="mr-1 inline -translate-y-px text-tone" aria-hidden />}
                    {rankLabel(rank)}
                  </span>
                  <span className={cn("font-display text-xl font-bold leading-none tabular", r.days ? "text-tone-ink" : "text-faint")}>{r.days}</span>
                </div>
                <div className="mt-3 flex items-center gap-2 text-[11px] text-muted">
                  <span className="shrink-0 tabular">≥ {rank.minHours} h</span>
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div className="bar-in h-full rounded-full bg-gradient-to-r from-tone to-tone-2" style={{ width: `${(r.days / maxRankDays) * 100}%` }} />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
        <p className="mt-4 text-xs text-muted">Los porcentajes son rangos simbólicos internos, no estadísticas de población.</p>
        {rec.totalSeconds === 0 && (
          <Link href="/focus" className={buttonClass("tone", "sm", "mt-4")}>
            Registrar mi primera sesión
          </Link>
        )}
      </Card>
    </div>
  );
}
