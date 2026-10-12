import type { Metadata } from "next";
import {
  BellOff,
  CalendarCheck,
  CalendarRange,
  CheckCircle2,
  Clock,
  Clock3,
  Download,
  Flame,
  Gauge,
  Lightbulb,
  Medal,
  Moon,
  PieChart,
  Sun,
  Sunrise,
  Sunset,
  Timer,
  Trophy,
  Zap,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, addMonths, diffDays, isISODate, startOfMonth, type ISODate, weekday, zonedDayStart } from "@/lib/domain/dates";
import { compare, describeChange, estimateAccuracy, formatDuration, periodRanges, previousRange, totals, type Comparison, type DailyStat } from "@/lib/domain/stats";
import { formatShortDate, WEEKDAY_NAME } from "@/lib/format";
import { getByCategory, getDaily, getHabitCompliance, getHourly, getRecommendations } from "@/lib/data/stats";
import type { Tone } from "@/lib/sections";
import { Card, CardTitle, EmptyState, ProgressBar, StatTile } from "@/components/ui/card";
import { BarChart, HBar, type Bar } from "@/components/charts/bar-chart";
import { Sparkline } from "@/components/charts/line-chart";
import { RangePicker } from "@/components/stats/range-picker";
import { CategoryDonut } from "@/components/stats/category-donut";
import { Units } from "@/components/stats/units";
import { FeatureShade } from "@/components/stats/feature-shade";
import { RecommendationList } from "@/components/dashboard/recommendations";

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

/**
 * Comparación para una StatTile: el porcentaje va en el chip (verde si sube, rojo si baja) y el valor
 * anterior en la nota. Sin datos del período anterior no se inventa porcentaje.
 */
function delta(c: Comparison | undefined, prevLabel: string, format: (v: number) => string = String) {
  if (!c) return {};
  if (c.pct === null) return { footnote: describeChange(c, prevLabel).replace("Sin datos el ", "Sin datos del ") };
  const pct = Math.round(c.pct * 100);
  return {
    delta: c.trend === "flat" || pct === 0 ? "Igual" : `${pct > 0 ? "+" : "−"}${Math.abs(pct)} %`,
    trend: pct === 0 ? ("flat" as const) : c.trend,
    footnote: `Antes: ${format(c.previous)}`,
  };
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

/** Medallas del podio de mejores días. */
const MEDAL: Tone[] = ["gold", "slate", "orange"];

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
  const multiDay = days.length > 1;
  const avgDaily = t.days ? t.focus_seconds / t.days : 0;
  const rangeText = `${formatShortDate(current.from)}${current.from !== current.to ? ` – ${formatShortDate(current.to)}` : ""}`;

  const span = (b: (typeof buckets)[number]) =>
    b.days.length > 1 ? `${formatShortDate(b.days[0].day)}–${formatShortDate(b.days[b.days.length - 1].day)}` : formatShortDate(b.key);
  const focusBars: Bar[] = buckets.map((b) => {
    const secs = b.days.reduce((a, d) => a + d.focus_seconds, 0);
    return { key: b.key, label: b.label, value: Math.round(secs / 60), tooltip: `${span(b)}: ${formatDuration(secs)}`, highlight: b.days.some((d) => d.day === today) };
  });
  const taskBars: Bar[] = buckets.map((b) => {
    const n = b.days.reduce((a, d) => a + d.tasks_completed, 0);
    return { key: b.key, label: b.label, value: n, tooltip: `${span(b)}: ${n} tareas`, highlight: b.days.some((d) => d.day === today) };
  });
  const hourBars: Bar[] = Array.from({ length: 24 }, (_, h) => {
    const r = hourly.find((x) => x.hour === h);
    return {
      key: String(h),
      label: h % 6 === 0 ? `${h}h` : "",
      value: Math.round((r?.focus_seconds ?? 0) / 60),
      tooltip: `${h}:00–${h + 1}:00 · ${formatDuration(r?.focus_seconds ?? 0)} en ${r?.focus_sessions ?? 0} sesiones`,
    };
  });
  const dayParts = [
    { label: "Madrugada", from: 0, icon: Moon },
    { label: "Mañana", from: 6, icon: Sunrise },
    { label: "Tarde", from: 12, icon: Sun },
    { label: "Noche", from: 18, icon: Sunset },
  ].map((d) => ({ ...d, seconds: hourly.filter((r) => r.hour >= d.from && r.hour < d.from + 6).reduce((a, r) => a + r.focus_seconds, 0) }));
  const dayTotal = dayParts.reduce((a, d) => a + d.seconds, 0);
  const peak = hourly.reduce<(typeof hourly)[number] | null>((a, r) => (r.focus_seconds > (a?.focus_seconds ?? 0) ? r : a), null);

  const focusC = compare(t.focus_seconds, p.focus_seconds);
  const tasksC = compare(t.tasks_completed, p.tasks_completed);
  const habitsC = habitsNow.rate !== null && habitsPrev.rate !== null ? compare(Math.round(habitsNow.rate * 100), Math.round(habitsPrev.rate * 100)) : undefined;
  const activeC = multiDay ? compare(t.active_days, p.active_days) : undefined;
  const fd = delta(focusC, label, formatDuration);
  const td = delta(tasksC, label);
  const hd = delta(habitsC, label, (v) => `${v} %`);
  const ad = delta(activeC, label);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2.5 text-sm text-muted">
          <span className="tone-chip-soft h-9 w-9 rounded-xl" aria-hidden>
            <CalendarRange size={16} />
          </span>
          <span className="min-w-0">
            <span className="font-semibold text-text">{rangeText}</span> · comparado con {label}
          </span>
        </p>
        <RangePicker current={kind} from={current.from} to={current.to} />
      </div>

      {/* Protagonista: la concentración del período (o hora a hora si es un solo día). */}
      <Card variant="feature" className="p-6 sm:p-8">
        <FeatureShade />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,16rem)_minmax(0,1fr)] lg:gap-10">
          <div className="flex min-w-0 flex-col">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" aria-hidden>
                {multiDay ? <Timer size={20} /> : <Sun size={20} />}
              </span>
              <div className="min-w-0">
                <p className="eyebrow">{multiDay ? "Tu concentración" : "Tu día, hora a hora"}</p>
                <h2 className="font-display text-lg font-semibold leading-tight">{multiDay ? "Concentración (minutos)" : "Horas del día con más concentración"}</h2>
              </div>
            </div>
            {multiDay ? (
              <>
                <p className="num-xl mt-7 text-[50px] sm:text-[58px]">
                  <Units text={formatDuration(avgDaily)} />
                </p>
                <p className="mt-2 text-sm text-muted">de media al día en {t.days} días</p>
              </>
            ) : (
              <>
                <p className="num-xl mt-7 text-[50px] sm:text-[58px]">{peak ? `${peak.hour}:00` : "—"}</p>
                <p className="mt-2 text-sm text-muted">{peak ? `tu hora más productiva · ${formatDuration(peak.focus_seconds)}` : "Sin sesiones en este período"}</p>
              </>
            )}
            <div className="mt-5 flex flex-wrap gap-2 lg:mt-auto lg:pt-6">
              {best[0] && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 text-xs font-semibold">
                  <Trophy size={13} aria-hidden /> Mejor día: {formatShortDate(best[0].day)} · {formatDuration(best[0].focus_seconds)}
                </span>
              )}
              {t.focus_sessions > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 text-xs font-semibold">
                  <Zap size={13} aria-hidden /> {formatDuration(avgSession)} por sesión
                </span>
              )}
            </div>
          </div>
          <div className="min-w-0 self-end">
            <BarChart
              color="rgb(255 255 255 / 0.95)"
              color2="rgb(255 255 255 / 0.55)"
              unit="minutes"
              average={multiDay}
              height={196}
              bars={multiDay ? focusBars : hourBars}
              emptyText={multiDay ? "Sin datos en este período" : "Sin sesiones en este día"}
            />
          </div>
        </div>
      </Card>

      <section className="stagger grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4" aria-label="Cifras del período">
        <StatTile tone="cyan" icon={<Timer />} label="Horas de concentración" value={<Units text={formatDuration(t.focus_seconds)} />} delta={fd.delta} trend={fd.trend} footnote={fd.footnote}>
          {multiDay && <Sparkline fluid values={days.map((d) => d.focus_seconds)} height={30} label="Concentración por día" className="mt-3" />}
        </StatTile>
        <StatTile tone="blue" icon={<CheckCircle2 />} label="Tareas completadas" value={String(t.tasks_completed)} delta={td.delta} trend={td.trend} footnote={td.footnote}>
          {multiDay && <Sparkline fluid values={days.map((d) => d.tasks_completed)} height={30} label="Tareas por día" className="mt-3" />}
        </StatTile>
        <StatTile
          tone="orange"
          icon={<Flame />}
          label="Hábitos cumplidos"
          value={<Units text={habitsNow.rate === null ? String(t.habits_done) : `${Math.round(habitsNow.rate * 100)} %`} />}
          delta={hd.delta}
          trend={hd.trend}
          footnote={`${t.habits_done} ${t.habits_done === 1 ? "registro" : "registros"} · descansos excluidos`}
        />
        <StatTile tone="green" icon={<CalendarCheck />} label="Días activos" value={<Units text={`${t.active_days}/${t.days}`} />} delta={ad.delta} trend={ad.trend} footnote={ad.footnote}>
          <ProgressBar value={t.days ? t.active_days / t.days : 0} size="sm" className="mt-3" label="Días activos en el período" />
        </StatTile>
        <StatTile
          tone="indigo"
          icon={<Gauge />}
          label="Cumplimiento de fechas"
          value={<Units text={due.length ? `${Math.round((dueDone / due.length) * 100)} %` : "—"} />}
          footnote={due.length ? `${dueDone} de ${due.length} tareas con fecha en el período` : "Sin tareas con fecha en el período"}
        >
          {due.length > 0 && <ProgressBar value={dueDone / due.length} size="sm" className="mt-3" label="Cumplimiento de fechas" />}
        </StatTile>
        <StatTile tone="coral" icon={<Zap />} label="Sesiones" value={String(t.focus_sessions)} footnote={t.focus_sessions ? `Media: ${formatDuration(avgSession)} por sesión` : undefined} />
        <StatTile
          tone="amber"
          icon={<Clock />}
          label="Estimado vs. real"
          value={<Units text={acc ? `${acc.ratio.toFixed(2)}×` : "—"} />}
          footnote={acc ? `${acc.sample} tareas · ${acc.ratio > 1 ? "llevan más de lo previsto" : "llevan menos de lo previsto"}` : "Estima tareas y registra tiempo para verlo"}
        />
        <StatTile
          tone="pink"
          icon={<BellOff />}
          label="Interrupciones"
          value={String(t.interruptions)}
          footnote={t.focus_sessions ? `${(t.interruptions / t.focus_sessions).toFixed(1)} por sesión` : undefined}
        />
      </section>

      {multiDay ? (
        <div className="grid gap-5 lg:grid-cols-5">
          <div className="flex flex-col gap-5 lg:col-span-3">
            <Card tone="green" data-reveal>
              <CardTitle icon={<CheckCircle2 />} subtitle={`${t.tasks_completed} en total · ${days.length <= 31 ? "por día" : days.length <= 120 ? "por semana" : "por mes"}`}>
                Tareas completadas
              </CardTitle>
              <BarChart unit="count" average height={230} bars={taskBars} />
            </Card>
            <Card data-reveal className="flex flex-col lg:flex-1">
              <CardTitle
                icon={<Clock3 />}
                subtitle="Según la hora de inicio de cada sesión."
                action={
                  peak ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-tone-soft px-2.5 py-1 text-[11px] font-semibold text-tone-ink">
                      <Zap size={12} aria-hidden /> Pico: {peak.hour}:00
                    </span>
                  ) : undefined
                }
              >
                Horas del día con más concentración
              </CardTitle>
              <BarChart height={200} unit="minutes" bars={hourBars} />
              {/* Reparto por momentos del día. */}
              <ul className="mt-auto grid grid-cols-2 gap-2 pt-5 sm:grid-cols-4" aria-label="Concentración por momento del día">
                {dayParts.map((d) => (
                  <li key={d.label} className="rounded-2xl bg-surface-2/60 px-3 py-2.5 transition-colors hover:bg-surface-2">
                    <p className="flex items-center gap-1.5 text-xs text-muted">
                      <d.icon size={13} className="text-tone-ink" aria-hidden /> {d.label}
                    </p>
                    <p className="mt-1 font-display text-[15px] font-semibold tabular">{formatDuration(d.seconds)}</p>
                    <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-surface-3">
                      <div className="h-full rounded-full bg-gradient-to-r from-tone to-tone-2" style={{ width: `${dayTotal ? (d.seconds / dayTotal) * 100 : 0}%` }} />
                    </div>
                  </li>
                ))}
              </ul>
            </Card>
          </div>
          <div className="flex flex-col gap-5 lg:col-span-2">
            <CategoryCard cats={cats} />
            <BestDays best={best} />
          </div>
        </div>
      ) : (
        <CategoryCard cats={cats} wide />
      )}

      <Card data-reveal>
        <CardTitle icon={<Lightbulb />} subtitle="Lo que dicen tus datos de las últimas semanas">
          Patrones y sugerencias
        </CardTitle>
        <RecommendationList items={recs} />
      </Card>

      <div className="flex flex-col gap-3 rounded-[22px] border border-dashed border-border-strong bg-surface/40 p-4 text-xs text-muted sm:flex-row sm:items-center" data-reveal>
        <a
          href={`/stats/export?from=${current.from}&to=${current.to}`}
          className="press inline-flex shrink-0 items-center gap-2 self-start rounded-full bg-tone-soft px-3.5 py-2 text-[13px] font-semibold text-tone-ink hover:brightness-95"
          download
        >
          <Download size={14} aria-hidden />
          Descargar estos datos (CSV)
        </a>
        <p className="leading-relaxed">
          Todas las cifras se calculan a partir de lo que registras (sesiones, tareas y hábitos). Pasar más horas no siempre significa ser más productivo: mira también la
          constancia, el cumplimiento y la precisión de tus estimaciones. Sin datos en el período anterior no se muestra porcentaje.
        </p>
      </div>
    </div>
  );
}

type CategoryRow = { category_id: string | null; name: string; color: string; focus_seconds: number; tasks_completed: number };

/** Reparto por categoría: anillo + barras. Más de 6 categorías se agrupan en "Otras" para que se lea bien. */
function CategoryCard({ cats, wide = false }: { cats: CategoryRow[]; wide?: boolean }) {
  const TOP = 5;
  const rest = cats.length > TOP + 1 ? cats.slice(TOP) : [];
  const rows: (CategoryRow & { key: string })[] = [
    ...(rest.length ? cats.slice(0, TOP) : cats).map((c) => ({ ...c, key: c.category_id ?? "none" })),
    ...(rest.length
      ? [
          {
            key: "others",
            category_id: null,
            name: `Otras (${rest.length})`,
            color: "var(--faint)",
            focus_seconds: rest.reduce((a, c) => a + c.focus_seconds, 0),
            tasks_completed: rest.reduce((a, c) => a + c.tasks_completed, 0),
          },
        ]
      : []),
  ];
  const total = cats.reduce((a, c) => a + c.focus_seconds, 0);
  const max = Math.max(0, ...rows.map((c) => c.focus_seconds));
  const top = [...cats].sort((a, b) => b.focus_seconds - a.focus_seconds)[0];
  return (
    <Card data-reveal>
      <CardTitle icon={<PieChart />} subtitle="Concentración por tipo de trabajo">
        Por categoría
      </CardTitle>
      {cats.length === 0 ? (
        <EmptyState icon={<PieChart />} title="Sin datos en este período.">
          Asigna una categoría a tus tareas para ver en qué se va tu tiempo.
        </EmptyState>
      ) : (
        <div className={wide ? "grid gap-6 lg:grid-cols-[minmax(0,15rem)_minmax(0,1fr)] lg:items-center lg:gap-10" : ""}>
          <div className={wide ? "flex items-center gap-4 lg:flex-col lg:items-start" : "mb-4 flex items-center gap-4"}>
            <CategoryDonut
              size={wide ? 132 : 112}
              stroke={wide ? 16 : 14}
              label={rows.map((c) => `${c.name}: ${formatDuration(c.focus_seconds)}`).join(", ")}
              items={rows.map((c) => ({ key: c.key, value: c.focus_seconds, color: c.color }))}
            >
              <div>
                <p className="font-display text-xl font-bold leading-none tabular">{(total / 3600).toLocaleString("es", { maximumFractionDigits: 1 })}</p>
                <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted">horas</p>
              </div>
            </CategoryDonut>
            <div className="min-w-0 text-sm">
              <p className="text-xs font-medium text-muted">Donde más tiempo pasas</p>
              <p className="mt-0.5 truncate font-display text-lg font-semibold">{top.name}</p>
              <p className="text-xs text-muted">{total ? Math.round((top.focus_seconds / total) * 100) : 0} % de tu concentración</p>
            </div>
          </div>
          <div className="space-y-1">
            {rows.map((c) => (
              <HBar key={c.key} label={c.name} value={c.focus_seconds} max={max} color={c.color} right={`${formatDuration(c.focus_seconds)} · ${c.tasks_completed} tareas`} />
            ))}
          </div>
        </div>
      )}
    </Card>
  );
}

/** Podio con los tres días de más concentración. */
function BestDays({ best }: { best: DailyStat[] }) {
  const top = best[0]?.focus_seconds ?? 0;
  return (
    <Card tone="gold" data-reveal className="lg:flex-1">
      <CardTitle icon={<Medal />} subtitle="Tus tres días con más concentración">
        Mejores días
      </CardTitle>
      {best.length === 0 ? (
        <EmptyState icon={<Trophy />} title="Sin sesiones en este período.">
          Tu primera sesión de concentración abrirá el podio.
        </EmptyState>
      ) : (
        <ol className="space-y-1.5">
          {best.map((d, i) => (
            <li key={d.day} className="group -mx-2 flex items-center gap-3 rounded-2xl px-2 py-2.5 transition-colors hover:bg-surface-2/60">
              <span
                data-tone={MEDAL[i]}
                className="tone-chip h-10 w-10 rounded-2xl font-display text-[15px] font-bold transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
              >
                {i + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-semibold">
                    {formatShortDate(d.day)} <span className="font-normal text-muted">· {WEEKDAY_NAME[weekday(d.day)].toLowerCase()}</span>
                  </p>
                  <p className="shrink-0 font-display text-sm font-semibold tabular">{formatDuration(d.focus_seconds)}</p>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-2">
                    <div data-tone={MEDAL[i]} className="bar-in h-full rounded-full bg-gradient-to-r from-tone to-tone-2" style={{ width: `${top ? (d.focus_seconds / top) * 100 : 0}%` }} />
                  </div>
                  <span className="shrink-0 text-[11px] text-muted tabular">{d.tasks_completed} tareas</span>
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
