import type { Metadata } from "next";
import Link from "next/link";
import { CalendarRange, Clock, Gauge, Grid3x3, Target } from "lucide-react";
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
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Horarios y patrones" };

const SPANS = [
  { id: "30", label: "30 días" },
  { id: "90", label: "90 días" },
  { id: "365", label: "12 meses" },
];

const NONE = { id: "none", name: "Sin categoría", color: "#94a3b8" };

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
    { key: "all", label: "Todas las categorías", color: "var(--accent)", seconds: all.seconds, sessions: all.sessions },
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

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-muted">
          {formatShortDate(range.from)} – {formatShortDate(range.to)} · {completedCount} {completedCount === 1 ? "sesión completada" : "sesiones completadas"}
        </p>
        <div className="flex rounded-xl border border-border bg-surface p-1">
          {SPANS.map((s) => (
            <Link
              key={s.id}
              href={`/stats/patterns?days=${s.id}`}
              className={cn("rounded-lg px-3 py-1.5 text-sm", Number(s.id) === span ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text")}
            >
              {s.label}
            </Link>
          ))}
        </div>
      </div>

      <Card>
        <CardTitle icon={<Grid3x3 size={16} />}>Cuándo te concentras</CardTitle>
        <HourHeatmap options={options} weekStartsOn={profile.week_starts_on} />
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardTitle icon={<CalendarRange size={16} />}>Por día de la semana</CardTitle>
          {bestDay ? (
            <p className="-mt-2 mb-3 text-sm">
              Los <strong>{WEEKDAY_NAME[bestDay.weekday].toLowerCase()}</strong> son tu mejor día: {formatDuration(bestDay.avgFocusSeconds)} de media, frente a{" "}
              {formatDuration(bestDay.overallAvg)} un día cualquiera.
            </p>
          ) : (
            <p className="-mt-2 mb-3 text-xs text-muted">Media diaria de concentración. Con al menos 4 semanas de datos se destaca tu mejor día si sobresale.</p>
          )}
          <BarChart
            height={120}
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

        <Card>
          <CardTitle icon={<Clock size={16} />}>Mejor franja por categoría</CardTitle>
          {blocksByCat.every((b) => !b.block) ? (
            <p className="text-sm text-muted">Con al menos 3 sesiones en una misma franja de 3 horas verás aquí tu mejor horario para cada tipo de trabajo.</p>
          ) : (
            <ul className="space-y-2.5">
              {blocksByCat
                .filter((b) => b.block)
                .map((b) => (
                  <li key={b.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: b.color }} />
                      {b.name}
                    </span>
                    <span className="tabular text-muted">
                      {b.block!.start}:00–{b.block!.start + 3}:00 · {formatDuration(b.block!.seconds)} en {b.block!.sessions} sesiones
                    </span>
                  </li>
                ))}
            </ul>
          )}
        </Card>

        <Card>
          <CardTitle icon={<Target size={16} />}>Sesiones terminadas por franja</CardTitle>
          {completion.length === 0 ? (
            <p className="text-sm text-muted">Aún no hay suficientes sesiones (3 por franja) para comparar.</p>
          ) : (
            <>
              <div className="space-y-3">
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

        <Card>
          <CardTitle icon={<Gauge size={16} />}>Estimado vs. real por categoría</CardTitle>
          {accuracy.length === 0 ? (
            <p className="text-sm text-muted">Estima el tiempo de tus tareas y regístralo con el temporizador. Con 3 tareas por categoría verás aquí tu precisión.</p>
          ) : (
            <ul className="space-y-2.5">
              {accuracy.map((a) => {
                const c = catOf(a.category_id);
                return (
                  <li key={a.category_id ?? "none"} className="flex items-center justify-between gap-3 text-sm">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                      {c.name}
                    </span>
                    <span className="tabular text-muted">
                      <span className={cn("font-medium", a.ratio > 1.3 ? "text-warning" : a.ratio < 0.7 ? "text-accent" : "text-success")}>{a.ratio.toFixed(2).replace(".", ",")}×</span> ·{" "}
                      {a.ratio > 1.1 ? "tardas más de lo previsto" : a.ratio < 0.9 ? "tardas menos de lo previsto" : "estimas bien"} ({a.sample} tareas)
                    </span>
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
