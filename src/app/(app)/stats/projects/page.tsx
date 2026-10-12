import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, ArrowRight, CalendarCheck, CheckCircle2, Clock, FolderKanban, Gauge, History, PartyPopper, Timer, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, localDate, startOfWeek } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/stats";
import { projectStats, stalledProjects } from "@/lib/domain/analytics";
import { getProjectData, getSessionPoints } from "@/lib/data/analytics";
import { formatShortDate } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Badge, Card, CardTitle, EmptyState, ProgressBar, ProgressRing } from "@/components/ui/card";
import { HBar } from "@/components/charts/bar-chart";
import { Sparkline } from "@/components/charts/line-chart";
import { Units } from "@/components/stats/units";
import { FeatureShade } from "@/components/stats/feature-shade";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Proyectos" };

const WEEKS = 12;
const STATUS_LABEL: Record<string, string> = { active: "Activo", paused: "En pausa", done: "Terminado" };
const STATUS_VARIANT = { active: "success", paused: "warning", done: "tone" } as const;

export default async function ProjectsStatsPage() {
  const { supabase, profile, today } = await requireUser();
  const tz = profile.timezone;
  const from = addDays(startOfWeek(today, profile.week_starts_on), -7 * (WEEKS - 1));
  const [{ projects, tasks }, sessions, catsRes] = await Promise.all([
    getProjectData(supabase),
    getSessionPoints(supabase, from, today, tz),
    supabase.from("categories").select("id, name, color"),
  ]);
  const cats = new Map(((catsRes.data ?? []) as Pick<Category, "id" | "name" | "color">[]).map((c) => [c.id, c]));

  if (projects.length === 0) {
    return (
      <EmptyState
        icon={<FolderKanban />}
        title="Aún no tienes proyectos"
        action={
          <Link href="/tasks?view=all" className={buttonClass("tone", "md")}>
            Ir a tareas <ArrowRight size={15} aria-hidden />
          </Link>
        }
      >
        <p>Crea un proyecto en Tareas y asígnale tareas: aquí verás el tiempo que le dedicas, su avance y a qué ritmo vas.</p>
      </EmptyState>
    );
  }

  const stats = projectStats(projects, tasks, sessions, today, tz, profile.week_starts_on, WEEKS).sort(
    (a, b) => Number(a.status !== "active") - Number(b.status !== "active") || b.focusInRange - a.focusInRange,
  );
  const stalled = new Set(stalledProjects(stats, today, tz).map((p) => p.id));
  const totalFocus = sessions.filter((s) => s.status === "completed").reduce((a, s) => a + s.focus_seconds, 0);
  const projectFocus = stats.reduce((a, p) => a + p.focusInRange, 0);
  const maxFocus = Math.max(0, ...stats.map((p) => p.focusInRange));
  const share = totalFocus > 0 ? projectFocus / totalFocus : 0;
  const activeCount = stats.filter((p) => p.status === "active").length;
  const doneTasks = stats.reduce((a, p) => a + p.tasksDone, 0);
  const allTasks = stats.reduce((a, p) => a + p.tasksTotal, 0);
  const colorOf = (id: string | null) => (id && cats.get(id)?.color) || "var(--accent)";

  return (
    <div className="space-y-6">
      {/* Protagonista: cuánto de tu concentración va a tus proyectos. */}
      <Card variant="feature" className="p-6 sm:p-8">
        <FeatureShade />
        <div className="relative grid gap-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:gap-10">
          <div className="min-w-0">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-surface-3 shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" aria-hidden>
                <FolderKanban size={20} />
              </span>
              <div className="min-w-0">
                <p className="eyebrow">Tus proyectos</p>
                <h2 className="font-display text-xl font-semibold leading-tight">Tiempo invertido</h2>
              </div>
            </div>
            <p className="num-xl mt-6 text-[52px] sm:text-[64px]">
              <Units text={formatDuration(projectFocus)} />
            </p>
            <p className="mt-2 text-sm text-muted">
              Últimas {WEEKS} semanas ({formatShortDate(from)} – {formatShortDate(today)})
              {totalFocus > 0 && ` · ${Math.round((projectFocus / totalFocus) * 100)} % de tu concentración fue a proyectos`}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 text-xs font-semibold">
                <TrendingUp size={13} aria-hidden /> {activeCount} {activeCount === 1 ? "proyecto activo" : "proyectos activos"}
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 text-xs font-semibold">
                <CheckCircle2 size={13} aria-hidden /> {doneTasks}/{allTasks} tareas cerradas
              </span>
              {stalled.size > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-3 px-3 py-1.5 text-xs font-semibold">
                  <AlertTriangle size={13} aria-hidden /> {stalled.size} sin actividad reciente
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-4 lg:flex-col lg:gap-2">
            <ProgressRing value={share} size={132} stroke={11} color="var(--text)">
              <span className="text-center">
                <span className="num-xl block text-[30px]">{Math.round(share * 100)}%</span>
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted">del total</span>
              </span>
            </ProgressRing>
            <p className="max-w-[12rem] text-xs text-muted lg:text-center">Parte de tu concentración que fue a tareas de proyectos.</p>
          </div>
        </div>
      </Card>

      <Card data-reveal>
        <CardTitle icon={<Timer />} subtitle={`Concentración en las últimas ${WEEKS} semanas`}>
          Tiempo dedicado a cada proyecto
        </CardTitle>
        {maxFocus === 0 ? (
          <div className="flex items-center gap-3.5 rounded-2xl border border-dashed border-border-strong bg-surface/30 p-4 text-sm text-muted">
            <span className="tone-chip-soft h-10 w-10 rounded-2xl" aria-hidden>
              <Timer size={18} />
            </span>
            <p>Aún no hay sesiones en tareas de proyectos. Empieza una sesión desde una tarea del proyecto para medir el tiempo.</p>
          </div>
        ) : (
          <div className="space-y-1">
            {stats
              .filter((p) => p.focusInRange > 0)
              .map((p) => (
                <HBar key={p.id} label={p.name} value={p.focusInRange} max={maxFocus} color={colorOf(p.category_id)} right={formatDuration(p.focusInRange)} />
              ))}
          </div>
        )}
      </Card>

      <div className="grid gap-5 md:grid-cols-2">
        {stats.map((p, i) => {
          const cat = p.category_id ? cats.get(p.category_id) : undefined;
          const color = cat?.color ?? "var(--tone)";
          const pct = Math.round((p.progress ?? 0) * 100);
          const done = p.tasksTotal > 0 && p.tasksDone === p.tasksTotal;
          return (
            <Card key={p.id} className="group flex flex-col gap-4 overflow-hidden" data-reveal={i > 1 ? String((i % 2) * 80) : undefined}>
              <div
                className="pointer-events-none absolute -right-12 -top-16 h-40 w-40 rounded-full opacity-[0.16] blur-3xl transition-opacity duration-500 group-hover:opacity-30"
                style={{ background: color }}
                aria-hidden
              />
              <div className="relative flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <span
                    className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105"
                    style={{ background: `linear-gradient(140deg, ${color}, color-mix(in srgb, ${color} 65%, var(--tone-2)))`, boxShadow: `0 8px 18px -8px ${color}` }}
                    aria-hidden
                  >
                    <FolderKanban size={19} />
                  </span>
                  <div className="min-w-0">
                    <h2 className="truncate font-display text-[17px] font-semibold leading-tight">{p.name}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge variant={STATUS_VARIANT[p.status as keyof typeof STATUS_VARIANT] ?? "neutral"}>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                      {cat && <Badge color={cat.color}>{cat.name}</Badge>}
                      {stalled.has(p.id) && (
                        <Badge variant="warning">
                          <AlertTriangle size={11} aria-hidden />
                          Sin actividad en 14 días
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
                <div className="shrink-0 pt-1">
                  <Sparkline values={p.weekly} color={color} width={104} height={34} label={`Concentración semanal en ${p.name}`} />
                </div>
              </div>

              <div className="relative">
                <div className="mb-2 flex items-baseline justify-between gap-2 text-sm">
                  <span className="text-muted">Avance</span>
                  <span className="flex items-center gap-2">
                    <span className="tabular">{p.tasksTotal ? `${p.tasksDone} de ${p.tasksTotal} tareas` : "Sin tareas"}</span>
                    {p.tasksTotal > 0 && <span className="rounded-full bg-surface-2 px-1.5 py-0.5 text-[11px] font-semibold tabular">{pct} %</span>}
                  </span>
                </div>
                <ProgressBar value={p.progress ?? 0} color={cat?.color} size="lg" label={`Avance de ${p.name}`} />
              </div>

              <dl className="relative grid grid-cols-2 gap-2 text-sm">
                {[
                  { icon: <Timer size={13} />, label: `${WEEKS} semanas`, value: formatDuration(p.focusInRange) },
                  { icon: <History size={13} />, label: "Total registrado", value: formatDuration(p.focusAllTime) },
                  { icon: <Gauge size={13} />, label: "Ritmo (4 semanas)", value: p.weeklyPace ? `${p.weeklyPace.toFixed(1).replace(".", ",")} tareas/semana` : "—" },
                  { icon: <Clock size={13} />, label: "Última actividad", value: p.lastActivity ? formatShortDate(localDate(new Date(p.lastActivity), tz)) : "—" },
                ].map((x) => (
                  <div key={x.label} className="min-w-0 rounded-2xl bg-surface-2/60 px-3 py-2.5 transition-colors hover:bg-surface-2">
                    <dt className="flex items-center gap-1.5 text-xs text-muted">
                      <span className="text-faint" aria-hidden>
                        {x.icon}
                      </span>
                      {x.label}
                    </dt>
                    <dd className="mt-0.5 truncate font-semibold tabular">{x.value}</dd>
                  </div>
                ))}
              </dl>

              {p.projectedFinish ? (
                <p
                  className={cn(
                    "relative flex gap-2.5 rounded-2xl px-3.5 py-2.5 text-sm",
                    p.onTrack === false ? "bg-warning-soft text-warning" : p.onTrack ? "bg-success-soft text-success" : "bg-surface-2/70 text-muted",
                  )}
                >
                  <CalendarCheck size={16} className="mt-0.5 shrink-0" aria-hidden />
                  <span>
                    Al ritmo actual terminarías hacia el {formatShortDate(p.projectedFinish)}
                    {p.target_date &&
                      (p.onTrack
                        ? `, antes de tu fecha objetivo (${formatShortDate(p.target_date)}).`
                        : `, después de tu fecha objetivo (${formatShortDate(p.target_date)}). Divide lo pendiente en pasos pequeños o ajusta la fecha.`)}
                    {!p.target_date && "."}
                  </span>
                </p>
              ) : done ? (
                <p className="relative flex items-center gap-2.5 rounded-2xl bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success">
                  <PartyPopper size={16} className="shrink-0" aria-hidden />
                  Todas las tareas completadas.
                </p>
              ) : (
                <p className="relative text-xs text-muted">Cierra al menos 2 tareas en 4 semanas para estimar cuándo terminarás.</p>
              )}

              <Link
                href={`/tasks?view=all&project=${p.id}`}
                className="press relative mt-auto inline-flex items-center gap-1.5 self-start rounded-full bg-tone-soft px-3 py-1.5 text-xs font-semibold text-tone-ink transition-[gap] hover:gap-2.5"
              >
                Ver tareas y editar proyecto <ArrowRight size={13} aria-hidden />
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
