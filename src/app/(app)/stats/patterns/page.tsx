import type { Metadata } from "next";
import Link from "next/link";
import { CalendarHeart, CalendarRange, CheckCheck, Clock, Gauge, Grid3x3, Hourglass, Sunrise, Target, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, zonedDayStart } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/stats";
import { bestBlock, bestWeekday, completionByBlock, estimateAccuracyByCategory, lastDays, weekdayAverages, weekdayHourMatrix } from "@/lib/domain/analytics";
import { getDaily } from "@/lib/data/stats";
import { getAccountStart, getSessionPoints } from "@/lib/data/analytics";
import { formatShortDate, WEEKDAY_NAME } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Card, CardTitle } from "@/components/ui/card";
import { BarChart, HBar } from "@/components/charts/bar-chart";
import { HourHeatmap, type HourMatrixOption } from "@/components/charts/hour-heatmap";
import { FeatureShade } from "@/components/stats/feature-shade";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Horarios y patrones" };

const SPANS = [
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
  { id: "365", label: "12 meses" },
];

const NONE = { id: "none", name: "Sin categoría", color: "#94a3b8" };

/** Estado vacío compacto para tarjetas pequeñas. */
function MiniEmpty({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="relative flex items-center gap-3.5 overflow-hidden rounded-2xl border border-dashed border-border-strong bg-surface/30 p-4 text-sm text-muted">
      <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_90%_at_0%_50%,#000,transparent)]" aria-hidden />
      <span className="tone-chip-soft relative h-10 w-10 rounded-2xl [&_svg]:h-[18px] [&_svg]:w-[18px]" aria-hidden>
        {icon}
      </span>
      <p className="relative">{children}</p>
    </div>
  );
}

/** Cifra de la tarjeta destacada. */
function Fact({ icon, label, value, sub }: { icon: React.ReactNode; label: string; value: string; sub: string }) {
  return (
    <div className="min-w-0 rounded-[20px] border border-border bg-surface p-4 transition-colors duration-300 hover:bg-surface-3">
      <p className="flex items-center gap-2 text-xs font-semibold text-muted">
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-surface-3 text-text [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
          {icon}
        </span>
        <span className="leading-tight">{label}</span>
      </p>
      <p className="num-xl mt-3 truncate text-[26px] sm:text-[30px]">{value}</p>
      <p className="mt-1.5 text-xs leading-snug text-muted">{sub}</p>
    </div>
  );
}

export default async function PatternsPage({ searchParams }: { searchParams: Promise<{ days?: string }> }) {
  const sp = await searchParams;
  const span = SPANS.some((s) => s.id === sp.days) ? Number(sp.days) : 90;
  const { supabase, profile, today } = await requireUser();
  const tz = profile.timezone;
  const accountStart = await getAccountStart(supabase, tz);
  const range = lastDays(today, span, accountStart);

  const [sessions, days, catsRes, estRes] = await Promise.all([
    getSessionPoints(supabase, range.from, range.to, tz),
    getDaily(supabase, range.from, range.to),
    supabase.from("categories").select("*").order("position"),
    supabase
      .from("tasks")
      .select("category_id, estimated_minutes, actual_seconds")
      .eq("status", "done")
      .not("estimated_minutes", "is", null)
      .gte("completed_at", zonedDayStart(range.from, tz))
      .lt("completed_at", zonedDayStart(addDays(range.to, 1), tz))
      .limit(1000),
  ]);
  const categories = (catsRes.data ?? []) as Category[];
  const catOf = (id: string | null) => (id ? (categories.find((c) => c.id === id) ?? { ...NONE, id, name: "Categoría eliminada" }) : NONE);

  // Mapa de calor: todas + cada categoría con sesiones.
  const usedCats = [...new Set(sessions.filter((s) => s.status === "completed").map((s) => s.category_id ?? "none"))];
  const all = weekdayHourMatrix(sessions, tz);
  const options: HourMatrixOption[] = [
    { key: "all", label: "Todas las categorías", color: "var(--tone)", seconds: all.seconds, sessions: all.sessions },
    ...usedCats.map((id) => {
      const c = id === "none" ? NONE : catOf(id);
      const m = weekdayHourMatrix(sessions, tz, (s) => (s.category_id ?? "none") === id);
      return { key: id, label: c.name, color: c.color, seconds: m.seconds, sessions: m.sessions };
    }),
  ];

  const blocksByCat = usedCats
    .map((id) => {
      const c = id === "none" ? NONE : catOf(id);
      const own = sessions.filter((s) => (s.category_id ?? "none") === id);
      return { id, name: c.name, color: c.color, block: bestBlock(own, tz), total: own.filter((s) => s.status === "completed").length };
    })
    .sort((a, b) => b.total - a.total);

  const avgs = weekdayAverages(days);
  const order = Array.from({ length: 7 }, (_, i) => (profile.week_starts_on + i) % 7);
  const bestDay = bestWeekday(days);
  const completion = completionByBlock(sessions, tz).filter((b) => b.completed + b.abandoned >= 3);
  const accuracy = estimateAccuracyByCategory((estRes.data ?? []) as { category_id: string | null; estimated_minutes: number | null; actual_seconds: number }[]);
  const completedCount = all.total;

  // Resumen para la tarjeta destacada.
  const byHour = Array.from({ length: 24 }, (_, h) => ({
    h,
    seconds: all.seconds.reduce((a, row) => a + row[h], 0),
    sessions: all.sessions.reduce((a, row) => a + row[h], 0),
  }));
  const peakHour = byHour.reduce<(typeof byHour)[number] | null>((a, x) => (x.seconds > (a?.seconds ?? 0) ? x : a), null);
  const block = bestBlock(sessions, tz);
  const finished = sessions.filter((s) => s.status === "completed").length;
  const strongest = [...avgs].filter((a) => a.days > 0 && a.avgFocusSeconds > 0).sort((a, b) => b.avgFocusSeconds - a.avgFocusSeconds)[0];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex min-w-0 items-center gap-2.5 text-sm text-muted">
          <span className="tone-chip-soft h-9 w-9 rounded-xl" aria-hidden>
            <CalendarRange size={16} />
          </span>
          <span className="min-w-0">
            {formatShortDate(range.from)} – {formatShortDate(range.to)} · {completedCount} {completedCount === 1 ? "sesión completada" : "sesiones completadas"}
          </span>
        </p>
        <nav className="seg" aria-label="Período">
          {SPANS.map((s) => (
            <Link key={s.id} href={`/stats/patterns?days=${s.id}`} aria-current={Number(s.id) === span ? "page" : undefined} className="press aria-[current=page]:text-tone-ink">
              {s.label}
            </Link>
          ))}
        </nav>
      </div>

      {/* Protagonista: tu ritmo en cuatro cifras. */}
      <Card variant="feature" className="p-6 sm:p-7">
        <FeatureShade />
        <div className="relative mb-5 flex items-center gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" aria-hidden>
            <Sunrise size={20} />
          </span>
          <div className="min-w-0">
            <p className="eyebrow">Tu ritmo</p>
            <h2 className="font-display text-xl font-semibold leading-tight">Cuándo rindes mejor</h2>
          </div>
        </div>
        <div className="relative grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Fact
            icon={<Zap />}
            label="Hora pico"
            value={peakHour ? `${peakHour.h}:00` : "—"}
            sub={peakHour ? `${formatDuration(peakHour.seconds)} en ${peakHour.sessions} ${peakHour.sessions === 1 ? "sesión" : "sesiones"}` : "Aún sin sesiones"}
          />
          <Fact
            icon={<Clock />}
            label="Mejor franja"
            value={block ? `${block.start}–${block.start + 3} h` : "—"}
            sub={block ? `${formatDuration(block.seconds)} en ${block.sessions} sesiones` : "Con 3 sesiones en una franja de 3 horas"}
          />
          <Fact
            icon={<CalendarHeart />}
            label="Día más fuerte"
            value={strongest ? WEEKDAY_NAME[strongest.weekday] : "—"}
            sub={strongest ? `${formatDuration(strongest.avgFocusSeconds)} de media` : "Aún sin datos"}
          />
          <Fact
            icon={<CheckCheck />}
            label="Terminadas"
            value={sessions.length ? `${Math.round((finished / sessions.length) * 100)} %` : "—"}
            sub={sessions.length ? `${finished} de ${sessions.length} sesiones sin descartar` : "Aún sin sesiones"}
          />
        </div>
      </Card>

      <Card data-reveal>
        <CardTitle icon={<Grid3x3 />} subtitle="Día de la semana × hora de inicio">
          Cuándo te concentras
        </CardTitle>
        <HourHeatmap options={options} weekStartsOn={profile.week_starts_on} />
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card data-reveal>
          <CardTitle icon={<CalendarRange />} subtitle="Media diaria de concentración">
            Por día de la semana
          </CardTitle>
          {bestDay ? (
            <p className="-mt-1 mb-4 rounded-2xl bg-tone-soft px-3.5 py-2.5 text-sm text-tone-ink">
              Los <strong>{WEEKDAY_NAME[bestDay.weekday].toLowerCase()}</strong> son tu mejor día: {formatDuration(bestDay.avgFocusSeconds)} de media, frente a{" "}
              {formatDuration(bestDay.overallAvg)} un día cualquiera.
            </p>
          ) : (
            <p className="-mt-1 mb-4 text-xs text-muted">Con al menos 4 semanas de datos se destaca tu mejor día si sobresale.</p>
          )}
          <BarChart
            height={140}
            unit="minutes"
            bars={order.map((w) => {
              const a = avgs[w];
              return {
                key: String(w),
                label: WEEKDAY_NAME[w].slice(0, 3),
                value: Math.round(a.avgFocusSeconds / 60),
                tooltip: `${WEEKDAY_NAME[w]}: ${formatDuration(a.avgFocusSeconds)} de media · ${a.avgTasks.toFixed(1).replace(".", ",")} tareas · activo el ${Math.round(a.activeRate * 100)} % (${a.days} días)`,
                highlight: bestDay?.weekday === w,
              };
            })}
          />
        </Card>

        <Card data-reveal>
          <CardTitle icon={<Clock />} subtitle="La franja de 3 horas con más concentración">
            Mejor franja por categoría
          </CardTitle>
          {blocksByCat.every((b) => !b.block) ? (
            <MiniEmpty icon={<Clock />}>Con al menos 3 sesiones en una misma franja de 3 horas verás aquí tu mejor horario para cada tipo de trabajo.</MiniEmpty>
          ) : (
            <ul className="space-y-1.5">
              {blocksByCat
                .filter((b) => b.block)
                .map((b) => (
                  <li key={b.id} className="-mx-2.5 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-surface-2/60">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2.5 font-medium">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: b.color, boxShadow: `0 0 0 3px color-mix(in srgb, ${b.color} 22%, transparent)` }} aria-hidden />
                        <span className="truncate">{b.name}</span>
                      </span>
                      <span className="shrink-0 rounded-full bg-surface-2 px-2 py-0.5 text-xs font-semibold tabular">
                        {b.block!.start}:00–{b.block!.start + 3}:00
                      </span>
                    </div>
                    {/* Línea del día (0–24 h) con la franja marcada. */}
                    <div className="relative mt-2.5 h-2 rounded-full bg-surface-2" aria-hidden>
                      {[6, 12, 18].map((h) => (
                        <span key={h} className="absolute top-0 h-2 w-px bg-border-strong" style={{ left: `${(h / 24) * 100}%` }} />
                      ))}
                      <span
                        className="absolute top-0 h-2 rounded-full"
                        style={{ left: `${(b.block!.start / 24) * 100}%`, width: `${(3 / 24) * 100}%`, background: b.color, boxShadow: `0 0 10px -1px ${b.color}` }}
                      />
                    </div>
                    <p className="mt-1.5 text-xs text-muted tabular">
                      {formatDuration(b.block!.seconds)} en {b.block!.sessions} sesiones
                    </p>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card data-reveal>
          <CardTitle icon={<Target />} subtitle="Terminadas frente a descartadas">
            Sesiones terminadas por franja
          </CardTitle>
          {completion.length === 0 ? (
            <MiniEmpty icon={<Target />}>Aún no hay suficientes sesiones (3 por franja) para comparar.</MiniEmpty>
          ) : (
            <>
              <div className="space-y-1">
                {completion.map((b) => (
                  <HBar
                    key={b.start}
                    label={`${b.start}:00–${b.start + 3}:00`}
                    value={b.rate ?? 0}
                    max={1}
                    color={(b.rate ?? 0) >= 0.7 ? "var(--success)" : "var(--warning)"}
                    right={`${Math.round((b.rate ?? 0) * 100)} % · ${b.completed}/${b.completed + b.abandoned}`}
                  />
                ))}
              </div>
              <p className="mt-3 text-xs text-muted">Porcentaje de sesiones que terminaste en vez de descartarlas. Una franja baja puede indicar cansancio o más distracciones a esa hora.</p>
            </>
          )}
        </Card>

        <Card data-reveal>
          <CardTitle icon={<Gauge />} subtitle="Cuánto tardas frente a lo que estimas">
            Estimado vs. real por categoría
          </CardTitle>
          {accuracy.length === 0 ? (
            <MiniEmpty icon={<Hourglass />}>Estima el tiempo de tus tareas y regístralo con el temporizador. Con 3 tareas por categoría verás aquí tu precisión.</MiniEmpty>
          ) : (
            <ul className="space-y-1.5">
              {accuracy.map((a) => {
                const c = catOf(a.category_id);
                const tone = a.ratio > 1.3 ? "var(--warning)" : a.ratio < 0.7 ? "var(--tone)" : "var(--success)";
                return (
                  <li key={a.category_id ?? "none"} className="-mx-2.5 rounded-2xl px-2.5 py-2.5 transition-colors hover:bg-surface-2/60">
                    <div className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex min-w-0 items-center gap-2.5 font-medium">
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: c.color }} aria-hidden />
                        <span className="truncate">{c.name}</span>
                      </span>
                      <span className="shrink-0 text-right text-xs text-muted tabular">
                        <span className={cn("font-display text-sm font-semibold", a.ratio > 1.3 ? "text-warning" : a.ratio < 0.7 ? "text-tone-ink" : "text-success")}>{a.ratio.toFixed(2).replace(".", ",")}×</span> ·{" "}
                        {a.ratio > 1.1 ? "tardas más de lo previsto" : a.ratio < 0.9 ? "tardas menos de lo previsto" : "estimas bien"} ({a.sample} tareas)
                      </span>
                    </div>
                    {/* Escala de 0× a 2×: el centro (1×) es estimar justo. */}
                    <div className="relative mt-2.5 h-2 rounded-full bg-gradient-to-r from-tone-soft via-success-soft to-warning-soft" aria-hidden>
                      <span className="absolute left-1/2 top-[-3px] h-3.5 w-px bg-border-strong" />
                      <span
                        className="absolute top-1/2 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-surface"
                        style={{ left: `${Math.min(100, (a.ratio / 2) * 100)}%`, background: tone, boxShadow: `0 0 0 3px color-mix(in srgb, ${tone} 25%, transparent)` }}
                      />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Card>
      </div>
    </div>
  );
}
