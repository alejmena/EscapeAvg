import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { addDays, localDate, startOfWeek } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/stats";
import { projectStats, stalledProjects } from "@/lib/domain/analytics";
import { getProjectData, getSessionPoints } from "@/lib/data/analytics";
import { formatShortDate } from "@/lib/format";
import type { Category } from "@/lib/types";
import { Badge, Card, CardTitle, EmptyState, ProgressBar } from "@/components/ui/card";
import { HBar } from "@/components/charts/bar-chart";
import { Sparkline } from "@/components/charts/line-chart";
import { buttonClass } from "@/components/ui/button";

export const metadata: Metadata = { title: "Proyectos" };

const WEEKS = 12;
const STATUS_LABEL: Record<string, string> = { active: "Activo", paused: "En pausa", done: "Terminado" };

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
      <EmptyState icon={<FolderKanban size={28} />} title="Aún no tienes proyectos">
        <p>Crea un proyecto en Tareas y asígnale tareas: aquí verás el tiempo que le dedicas, su avance y a qué ritmo vas.</p>
        <Link href="/tasks?view=all" className={buttonClass("secondary", "sm", "mt-3")}>
          Ir a tareas
        </Link>
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

  return (
    <div className="space-y-6">
      <p className="text-sm text-muted">
        Últimas {WEEKS} semanas ({formatShortDate(from)} – {formatShortDate(today)})
        {totalFocus > 0 && ` · ${Math.round((projectFocus / totalFocus) * 100)} % de tu concentración fue a proyectos`}
      </p>

      <Card>
        <CardTitle>Tiempo dedicado a cada proyecto</CardTitle>
        {maxFocus === 0 ? (
          <p className="text-sm text-muted">Aún no hay sesiones en tareas de proyectos. Empieza una sesión desde una tarea del proyecto para medir el tiempo.</p>
        ) : (
          <div className="space-y-3">
            {stats
              .filter((p) => p.focusInRange > 0)
              .map((p) => (
                <HBar
                  key={p.id}
                  label={p.name}
                  value={p.focusInRange}
                  max={maxFocus}
                  color={(p.category_id && cats.get(p.category_id)?.color) || "var(--accent)"}
                  right={formatDuration(p.focusInRange)}
                />
              ))}
          </div>
        )}
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {stats.map((p) => {
          const cat = p.category_id ? cats.get(p.category_id) : undefined;
          return (
            <Card key={p.id} className="space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold">{p.name}</h2>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    <Badge>{STATUS_LABEL[p.status] ?? p.status}</Badge>
                    {cat && <Badge color={cat.color}>{cat.name}</Badge>}
                    {stalled.has(p.id) && <Badge color="#c27803">Sin actividad en 14 días</Badge>}
                  </div>
                </div>
                <Sparkline values={p.weekly} color={cat?.color} label={`Concentración semanal en ${p.name}`} />
              </div>
              <div>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="text-muted">Avance</span>
                  <span className="tabular">{p.tasksTotal ? `${p.tasksDone} de ${p.tasksTotal} tareas` : "Sin tareas"}</span>
                </div>
                <ProgressBar value={p.progress ?? 0} color={cat?.color} label={`Avance de ${p.name}`} />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-xs text-muted">{WEEKS} semanas</dt>
                  <dd className="tabular">{formatDuration(p.focusInRange)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Total registrado</dt>
                  <dd className="tabular">{formatDuration(p.focusAllTime)}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Ritmo (4 semanas)</dt>
                  <dd className="tabular">{p.weeklyPace ? `${p.weeklyPace.toFixed(1).replace(".", ",")} tareas/semana` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Última actividad</dt>
                  <dd className="tabular">{p.lastActivity ? formatShortDate(localDate(new Date(p.lastActivity), tz)) : "—"}</dd>
                </div>
              </dl>
              {p.projectedFinish ? (
                <p className={p.onTrack === false ? "text-sm text-warning" : "text-sm text-muted"}>
                  Al ritmo actual terminarías hacia el {formatShortDate(p.projectedFinish)}
                  {p.target_date && (p.onTrack ? `, antes de tu fecha objetivo (${formatShortDate(p.target_date)}).` : `, después de tu fecha objetivo (${formatShortDate(p.target_date)}). Divide lo pendiente en pasos pequeños o ajusta la fecha.`)}
                  {!p.target_date && "."}
                </p>
              ) : p.tasksTotal > 0 && p.tasksDone === p.tasksTotal ? (
                <p className="text-sm text-success">Todas las tareas completadas.</p>
              ) : (
                <p className="text-xs text-muted">Cierra al menos 2 tareas en 4 semanas para estimar cuándo terminarás.</p>
              )}
              <Link href={`/tasks?view=all&project=${p.id}`} className="inline-block text-xs text-accent hover:underline">
                Ver tareas y editar proyecto
              </Link>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
