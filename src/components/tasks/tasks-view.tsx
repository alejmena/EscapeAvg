"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertTriangle,
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Folder,
  FolderPlus,
  Inbox,
  ListTodo,
  Pencil,
  Plus,
  Sparkles,
  Sun,
  Tag,
  Trophy,
  X,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { formatLongDate, formatShortDate } from "@/lib/format";
import { addDays, diffDays, localDate, weekday } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/stats";
import type { Category, Project, Task } from "@/lib/types";
import { createProject, createTask, deleteProject, updateProject } from "@/app/(app)/tasks/actions";
import { Button, buttonClass } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader, ProgressRing } from "@/components/ui/card";
import { ErrorText, Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { CountUp } from "@/components/fx/count-up";
import { IconSelect } from "./icon-select";
import { TaskEditor } from "./task-editor";
import { TaskItem } from "./task-item";
import { useAction } from "./use-action";

export type TaskView = "today" | "upcoming" | "all" | "done";

const VIEWS: { id: TaskView; label: string; icon: React.ReactNode }[] = [
  { id: "today", label: "Hoy", icon: <Sun size={15} /> },
  { id: "upcoming", label: "Próximas", icon: <CalendarDays size={15} /> },
  { id: "all", label: "Todas", icon: <ListTodo size={15} /> },
  { id: "done", label: "Completadas", icon: <CheckCircle2 size={15} /> },
];

type SectionKind = "overdue" | "today" | "nodate" | "doneToday" | "day" | "project" | "noproject" | "doneDay";
type Section = { key: string; title: string; items: Task[]; kind: SectionKind; day?: string; project?: Project };

const WEEKDAY_ABBR = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
const monthFmt = new Intl.DateTimeFormat("es", { month: "short", timeZone: "UTC" });

/** Segundos de trabajo estimado que quedan en estas tareas. */
const remainingSeconds = (items: Task[]) =>
  items.reduce((s, t) => s + Math.max(0, (t.estimated_minutes ?? 0) * 60 - t.actual_seconds), 0);

export function TasksView({
  view,
  today,
  timezone,
  tasks,
  categories,
  projects,
  filterCategory,
  filterProject,
}: {
  view: TaskView;
  today: string;
  timezone: string;
  tasks: Task[];
  categories: Category[];
  projects: Project[];
  filterCategory: string | null;
  filterProject: string | null;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const [editing, setEditing] = useState<Task | null>(null);
  const [creating, setCreating] = useState(false);
  const [projectModal, setProjectModal] = useState<"new" | Project | null>(null);

  const catMap = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const projMap = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);
  const subtasksOf = useMemo(() => {
    const m = new Map<string, Task[]>();
    for (const t of tasks) if (t.parent_id) m.set(t.parent_id, [...(m.get(t.parent_id) ?? []), t]);
    return m;
  }, [tasks]);

  const top = tasks.filter(
    (t) => !t.parent_id && (!filterCategory || t.category_id === filterCategory) && (!filterProject || t.project_id === filterProject),
  );
  const open = top.filter((t) => t.status !== "done");
  const doneDay = (t: Task) => (t.completed_at ? localDate(new Date(t.completed_at), timezone) : null);

  // Cifras del día (las usa la tarjeta principal).
  const overdue = open.filter((t) => t.due_date && t.due_date < today);
  const dueToday = open.filter((t) => t.due_date === today);
  const noDate = open.filter((t) => !t.due_date);
  const upcoming = open.filter((t) => t.due_date && t.due_date > today);
  const doneToday = top.filter((t) => t.status === "done" && doneDay(t) === today);

  const sections: Section[] = [];
  if (view === "today") {
    sections.push({ key: "overdue", title: "Vencidas", items: overdue, kind: "overdue" });
    sections.push({ key: "today", title: "Hoy", items: dueToday, kind: "today" });
    sections.push({ key: "nodate", title: "Sin fecha", items: noDate, kind: "nodate" });
    sections.push({ key: "done-today", title: "Completadas hoy", items: doneToday, kind: "doneToday" });
  } else if (view === "upcoming") {
    const sorted = upcoming.slice().sort((a, b) => a.due_date!.localeCompare(b.due_date!));
    const byDay = new Map<string, Task[]>();
    for (const t of sorted) byDay.set(t.due_date!, [...(byDay.get(t.due_date!) ?? []), t]);
    for (const [day, items] of byDay) sections.push({ key: day, title: formatLongDate(day), items, kind: "day", day });
  } else if (view === "all") {
    const groups = new Map<string, Task[]>();
    for (const t of open) groups.set(t.project_id ?? "", [...(groups.get(t.project_id ?? "") ?? []), t]);
    sections.push({ key: "none", title: "Sin proyecto", items: groups.get("") ?? [], kind: "noproject" });
    for (const p of projects) if (groups.get(p.id)?.length) sections.push({ key: p.id, title: p.name, items: groups.get(p.id)!, kind: "project", project: p });
  } else {
    // Completadas, agrupadas por el día en que las terminaste.
    const byDay = new Map<string, Task[]>();
    for (const t of top.filter((x) => x.status === "done")) {
      const d = doneDay(t) ?? "";
      byDay.set(d, [...(byDay.get(d) ?? []), t]);
    }
    for (const [day, items] of byDay) {
      const title = !day ? "Completadas" : day === today ? "Hoy" : day === addDays(today, -1) ? "Ayer" : formatLongDate(day);
      sections.push({ key: day || "sin-dia", title, items, kind: "doneDay", day: day || undefined });
    }
  }
  const visible = sections.filter((s) => s.items.length > 0);

  const hrefWith = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    const qs = sp.toString();
    return qs ? `/tasks?${qs}` : "/tasks";
  };
  const setParam = (key: string, value: string | null) => router.push(hrefWith(key, value));
  const clearFilters = () => {
    const sp = new URLSearchParams(params.toString());
    sp.delete("category");
    sp.delete("project");
    const qs = sp.toString();
    router.push(qs ? `/tasks?${qs}` : "/tasks");
  };
  const activeCategory = filterCategory ? catMap.get(filterCategory) : undefined;
  const activeProject = filterProject ? projMap.get(filterProject) : undefined;

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle={view === "done" ? "Todo lo que ya has terminado, día a día." : `${open.length} ${open.length === 1 ? "pendiente" : "pendientes"}`}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nueva tarea
          </Button>
        }
      />

      {view === "done" ? (
        <DoneHero tasks={top.filter((t) => t.status === "done")} today={today} doneDay={doneDay} />
      ) : (
        <TodayHero
          today={today}
          load={overdue.length + dueToday.length}
          remaining={remainingSeconds([...overdue, ...dueToday])}
          counts={{ overdue: overdue.length, upcoming: upcoming.length, noDate: noDate.length, doneToday: doneToday.length }}
        >
          <QuickAdd
            defaults={{
              due_date: view === "today" ? today : undefined,
              category_id: filterCategory ?? undefined,
              project_id: filterProject ?? undefined,
            }}
            labels={[view === "today" ? "Para hoy" : "Sin fecha", activeCategory?.name, activeProject?.name].filter(Boolean) as string[]}
          />
        </TodayHero>
      )}

      {/* Vistas y filtros */}
      <div className="mb-5 flex flex-wrap items-center gap-2.5">
        <nav className="seg w-full sm:w-auto" aria-label="Vistas de tareas">
          {VIEWS.map((v) => (
            <Link
              key={v.id}
              href={hrefWith("view", v.id === "today" ? null : v.id)}
              scroll={false}
              aria-current={view === v.id ? "page" : undefined}
              aria-label={v.label}
              className="flex-1 justify-center sm:flex-none [&[aria-current=page]>svg]:text-tone"
            >
              {v.icon}
              <span className={cn(view === v.id ? "inline" : "hidden sm:inline")}>{v.label}</span>
            </Link>
          ))}
        </nav>
        <div className="flex w-full min-w-0 items-center gap-2 sm:ml-auto sm:w-auto">
          <FilterSelect
            className="flex-1 sm:flex-none"
            icon={<Tag size={14} />}
            dot={activeCategory?.color}
            active={!!filterCategory}
            value={filterCategory ?? ""}
            onChange={(e) => setParam("category", e.target.value || null)}
            aria-label="Filtrar por categoría"
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </FilterSelect>
          <FilterSelect
            className="flex-1 sm:flex-none"
            icon={<Folder size={14} />}
            active={!!filterProject}
            value={filterProject ?? ""}
            onChange={(e) => setParam("project", e.target.value || null)}
            aria-label="Filtrar por proyecto"
          >
            <option value="">Todos los proyectos</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </FilterSelect>
          <Button variant="secondary" size="sm" onClick={() => setProjectModal("new")} className="h-10! w-10 shrink-0 px-0! sm:w-auto sm:px-4!" title="Nuevo proyecto">
            <FolderPlus size={15} />
            <span className="sr-only sm:not-sr-only">Proyecto</span>
          </Button>
        </div>
        {(filterCategory || filterProject) && (
          <div className="pop-in flex w-full flex-wrap items-center gap-1.5 text-xs text-muted">
            <span className="mr-0.5 font-semibold">Filtrando:</span>
            {activeCategory && (
              <button
                type="button"
                onClick={() => setParam("category", null)}
                className="press inline-flex items-center gap-1.5 rounded-full py-1 pl-2.5 pr-1.5 font-semibold"
                style={{ background: `color-mix(in srgb, ${activeCategory.color} 15%, transparent)`, color: activeCategory.color }}
                aria-label={`Quitar filtro ${activeCategory.name}`}
              >
                <Tag size={12} aria-hidden /> {activeCategory.name} <X size={13} aria-hidden />
              </button>
            )}
            {activeProject && (
              <button
                type="button"
                onClick={() => setParam("project", null)}
                className="press inline-flex items-center gap-1.5 rounded-full bg-tone-soft py-1 pl-2.5 pr-1.5 font-semibold text-tone-ink"
                aria-label={`Quitar filtro ${activeProject.name}`}
              >
                <Folder size={12} aria-hidden /> {activeProject.name} <X size={13} aria-hidden />
              </button>
            )}
            {filterCategory && filterProject && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                Quitar filtros
              </Button>
            )}
            {activeProject && (
              <Button variant="secondary" size="sm" onClick={() => setProjectModal(activeProject)} className="ml-auto">
                <Pencil size={14} /> Editar proyecto
              </Button>
            )}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={view === "done" ? <Trophy size={28} /> : view === "upcoming" ? <CalendarDays size={28} /> : <Inbox size={28} />}
          title={view === "done" ? "Aún no hay tareas completadas" : "Nada pendiente aquí"}
          action={
            view === "today" ? (
              <Link href={hrefWith("view", "upcoming")} className={buttonClass("secondary", "sm")}>
                Ver próximas <ArrowRight size={14} />
              </Link>
            ) : undefined
          }
        >
          {view === "today" ? (
            <>
              Añade algo pequeño que puedas terminar hoy, o revisa{" "}
              <Link href="/tasks?view=upcoming" className="font-semibold text-tone-ink hover:underline">
                las próximas
              </Link>
              .
            </>
          ) : (
            "Escribe arriba tu próxima tarea."
          )}
        </EmptyState>
      ) : (
        <div className="space-y-5">
          {visible.map((s, i) => (
            <section
              key={s.key}
              className={cn("card-glass rounded-[24px] p-2 sm:p-2.5", s.kind === "overdue" && "ring-1 ring-danger/25")}
              data-reveal={i >= 2 && i < 6 ? "" : undefined}
            >
              <SectionHeader section={s} today={today} category={s.project?.category_id ? catMap.get(s.project.category_id) : undefined} />
              <ul className="space-y-0.5">
                {s.items.map((t) => (
                  <TaskItem
                    key={t.id}
                    task={t}
                    subtasks={(subtasksOf.get(t.id) ?? []).sort((a, b) => a.position - b.position)}
                    today={today}
                    category={t.category_id ? catMap.get(t.category_id) : undefined}
                    project={t.project_id ? projMap.get(t.project_id) : undefined}
                    onEdit={setEditing}
                  />
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {(editing || creating) && (
        <TaskEditor
          key={editing?.id ?? "new"}
          task={editing}
          defaults={{ due_date: view === "today" ? today : null, category_id: filterCategory, project_id: filterProject }}
          open
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
          categories={categories}
          projects={projects}
        />
      )}
      {projectModal && (
        <ProjectModal
          key={projectModal === "new" ? "new" : projectModal.id}
          categories={categories}
          project={projectModal === "new" ? null : projectModal}
          onClose={() => setProjectModal(null)}
          onDeleted={() => {
            setProjectModal(null);
            setParam("project", null);
          }}
        />
      )}
    </div>
  );
}

/** Tarjeta principal de las vistas abiertas: carga del día, avance y el campo para añadir. */
function TodayHero({
  today,
  load,
  remaining,
  counts,
  children,
}: {
  today: string;
  load: number;
  remaining: number;
  counts: { overdue: number; upcoming: number; noDate: number; doneToday: number };
  children: React.ReactNode;
}) {
  const plate = load + counts.doneToday;
  const share = plate ? counts.doneToday / plate : 0;
  const pills = [
    { n: counts.overdue, label: counts.overdue === 1 ? "vencida" : "vencidas", icon: <AlertTriangle size={13} />, hot: counts.overdue > 0 },
    { n: counts.upcoming, label: counts.upcoming === 1 ? "próxima" : "próximas", icon: <CalendarDays size={13} /> },
    { n: counts.noDate, label: "sin fecha", icon: <Inbox size={13} /> },
    { n: counts.doneToday, label: counts.doneToday === 1 ? "hecha hoy" : "hechas hoy", icon: <CheckCircle2 size={13} /> },
  ];
  return (
    <Card variant="feature" className="mb-6 p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[var(--tone-2)] opacity-40 blur-3xl animate-glow" aria-hidden />
      <div className="relative flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <Sun size={13} aria-hidden /> {formatLongDate(today)}
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5 gap-y-1">
            <CountUp value={load} className="num-xl text-[46px] sm:text-[68px]" />
            <span className="font-display text-lg font-semibold leading-tight sm:text-xl">{load === 1 ? "tarea para hoy" : "tareas para hoy"}</span>
          </p>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-muted">
            {load === 0 ? (
              <>
                <Sparkles size={14} aria-hidden /> Día despejado: adelanta algo de lo próximo.
              </>
            ) : (
              <>
                <Clock size={14} aria-hidden /> {remaining > 0 ? `≈ ${formatDuration(remaining)} de trabajo estimado` : "Sin estimación de tiempo"}
              </>
            )}
          </p>
        </div>
        <div className="shrink-0 text-center">
          <span className="sm:hidden">
            <ProgressRing value={share} size={76} stroke={7} color="#fff">
              <span className="num-xl text-xl">{Math.round(share * 100)}%</span>
            </ProgressRing>
          </span>
          <span className="hidden sm:inline">
            <ProgressRing value={share} size={124} stroke={9} color="#fff">
              <span className="flex flex-col items-center">
                <span className="num-xl text-[30px]">{Math.round(share * 100)}%</span>
                <span className="mt-1 text-[11px] font-medium text-muted">del día</span>
              </span>
            </ProgressRing>
          </span>
        </div>
      </div>

      <ul className="relative mt-4 flex flex-wrap gap-1.5 empty:hidden" aria-label="Resumen">
        {pills.filter((p) => p.n > 0).map((p) => (
          <li
            key={p.label}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ring-1 backdrop-blur-sm",
              p.hot ? "bg-white text-[color-mix(in_srgb,var(--danger)_82%,#000)] ring-white" : "bg-surface ring-border",
            )}
          >
            {p.icon}
            <span className="tabular">{p.n}</span> {p.label}
          </li>
        ))}
      </ul>

      <div className="relative mt-5">{children}</div>
    </Card>
  );
}

/** Tarjeta principal de "Completadas": total, ritmo de los últimos 7 días y tiempo invertido. */
function DoneHero({ tasks, today, doneDay }: { tasks: Task[]; today: string; doneDay: (t: Task) => string | null }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));
  const perDay = days.map((d) => tasks.filter((t) => doneDay(t) === d).length);
  const max = Math.max(1, ...perDay);
  const week = perDay.reduce((a, b) => a + b, 0);
  const seconds = tasks.reduce((s, t) => s + t.actual_seconds, 0);
  return (
    <Card variant="feature" tone="green" className="mb-6 p-5 sm:p-7">
      <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full bg-[var(--tone-2)] opacity-40 blur-3xl animate-glow" aria-hidden />
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <p className="eyebrow flex items-center gap-1.5">
            <Trophy size={13} aria-hidden /> Tu historial
          </p>
          <p className="mt-2 flex flex-wrap items-baseline gap-x-2.5">
            <CountUp value={tasks.length} className="num-xl text-[52px] sm:text-[68px]" />
            <span className="font-display text-lg font-semibold sm:text-xl">{tasks.length === 1 ? "terminada" : "terminadas"}</span>
          </p>
          <p className="mt-2 text-sm text-muted">
            <span className="font-semibold text-text tabular">{week}</span> en los últimos 7 días
            {seconds > 0 && (
              <>
                {" "}
                · <span className="font-semibold text-text">{formatDuration(seconds)}</span> de trabajo real
              </>
            )}
          </p>
        </div>
        <div className="flex h-24 items-end gap-1.5 sm:gap-2" aria-label="Tareas terminadas en los últimos 7 días" role="img">
          {perDay.map((n, i) => (
            <div key={days[i]} className="flex flex-col items-center gap-1.5">
              <div className="flex h-16 w-6 items-end overflow-hidden rounded-lg bg-surface sm:w-7">
                <div
                  className="grow-up w-full rounded-lg bg-white shadow-[0_0_12px_rgb(255_255_255/0.5)]"
                  style={{ height: `${n ? Math.max(12, (n / max) * 100) : 0}%`, animationDelay: `${i * 60}ms` }}
                />
              </div>
              <span className={cn("text-[10px] font-semibold", days[i] === today ? "text-text" : "text-muted")}>{WEEKDAY_ABBR[weekday(days[i])].slice(0, 1)}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/** Encabezado de cada grupo: ficha de color, título y contador. */
function SectionHeader({ section: s, today, category }: { section: Section; today: string; category?: Category }) {
  const estimate = s.kind === "doneToday" || s.kind === "doneDay" ? 0 : remainingSeconds(s.items);
  const count = s.items.length;
  let chip: React.ReactNode;
  let badge: "danger" | "tone" | "neutral" | "success" | "solid" = "neutral";
  let note: React.ReactNode = null;
  switch (s.kind) {
    case "overdue":
      chip = <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-danger-soft text-danger"><AlertTriangle size={17} /></span>;
      badge = "danger";
      note = "Empieza por aquí";
      break;
    case "today":
      chip = <span className="tone-chip h-9 w-9 rounded-xl"><Sun size={17} /></span>;
      badge = "solid";
      break;
    case "nodate":
    case "noproject":
      chip = <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface-2 text-muted"><Inbox size={17} /></span>;
      break;
    case "doneToday":
    case "doneDay":
      chip = <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-success-soft text-success"><CheckCircle2 size={17} /></span>;
      badge = "success";
      break;
    case "project":
      chip = (
        <span
          className={cn("grid h-9 w-9 shrink-0 place-items-center rounded-xl", !category && "tone-chip-soft")}
          style={category ? { background: `color-mix(in srgb, ${category.color} 16%, transparent)`, color: category.color } : undefined}
        >
          <Folder size={17} />
        </span>
      );
      badge = "tone";
      if (s.project?.target_date) note = `Objetivo: ${formatShortDate(s.project.target_date)}`;
      else if (s.project?.status === "paused") note = "En pausa";
      break;
    case "day": {
      const d = s.day!;
      const diff = diffDays(d, today);
      chip = (
        <span className="tone-chip-soft h-11 w-11 flex-col rounded-[14px] leading-none">
          <span className="text-[9px] font-bold uppercase tracking-wider">{WEEKDAY_ABBR[weekday(d)]}</span>
          <span className="mt-0.5 font-display text-[17px] font-bold tabular">{Number(d.slice(8))}</span>
        </span>
      );
      badge = diff <= 1 ? "solid" : "tone";
      note = diff === 1 ? "Mañana" : `En ${diff} días · ${monthFmt.format(new Date(`${d}T12:00:00Z`))}`;
      break;
    }
  }
  return (
    <div className="flex items-center gap-3 px-2.5 pb-1.5 pt-2 sm:px-3">
      {chip}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className={cn("font-display text-[16px] font-semibold leading-tight", s.kind === "overdue" && "text-danger")}>{s.title}</h2>
          <Badge variant={badge} className="tabular">
            {count}
          </Badge>
        </div>
        {note && <p className="mt-0.5 text-xs text-muted">{note}</p>}
      </div>
      {estimate > 0 && (
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-surface-2 px-2.5 py-1 text-[11px] font-semibold text-muted tabular sm:inline-flex" title="Tiempo estimado pendiente">
          <Clock size={12} aria-hidden /> {formatDuration(estimate)}
        </span>
      )}
    </div>
  );
}

/** Select de filtro con icono (o el color de la categoría) y estado activo del tono. */
function FilterSelect({
  icon,
  dot,
  active,
  className,
  children,
  ...props
}: React.SelectHTMLAttributes<HTMLSelectElement> & { icon: React.ReactNode; dot?: string; active: boolean }) {
  return (
    <IconSelect
      {...props}
      wrapperClassName={className}
      icon={<span className={cn("ml-0.5 flex", active ? "text-tone-ink" : "text-muted")}>{dot ? <span className="block h-2.5 w-2.5 rounded-full" style={{ background: dot }} /> : icon}</span>}
      className={cn("h-10 w-full truncate rounded-full! pl-9! text-[13px] font-medium sm:w-auto", active && "border-tone/50! bg-tone-soft! font-semibold text-tone-ink!")}
    >
      {children}
    </IconSelect>
  );
}

/** Campo protagonista para añadir una tarea con Enter. */
function QuickAdd({ defaults, labels }: { defaults: { due_date?: string; category_id?: string; project_id?: string }; labels: string[] }) {
  const [title, setTitle] = useState("");
  const [added, setAdded] = useState(0);
  const { run, pending, error } = useAction();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        run(
          () => createTask({ title, ...defaults }),
          () => {
            setTitle("");
            setAdded((n) => n + 1);
          },
        );
      }}
    >
      <div className="qa-field flex items-center gap-2 rounded-[20px] bg-surface p-1.5 ring-1 ring-border-strong backdrop-blur-md transition-[background-color,box-shadow] focus-within:bg-surface-3 focus-within:ring-white/70">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-white shadow-[0_6px_16px_-8px_rgb(0_0_0/0.5)]" style={{ color: "var(--tone)" }} aria-hidden>
          <Plus size={20} strokeWidth={2.6} className={cn(pending && "qa-spin")} />
        </span>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Añadir tarea y pulsar Enter"
          maxLength={200}
          aria-label="Nueva tarea rápida"
          className="h-10 min-w-0 flex-1 bg-transparent text-[15px] font-medium text-text placeholder:text-muted focus:outline-none"
        />
        {pending ? (
          <span className="pr-3 text-xs font-medium text-muted">Guardando…</span>
        ) : (
          <kbd className="mr-2 hidden rounded-lg bg-surface-3 px-2 py-1 font-sans text-[11px] font-semibold text-muted sm:inline-block">Enter ↵</kbd>
        )}
      </div>
      <div className="mt-2 flex flex-wrap items-center gap-1.5 px-1 text-xs text-muted">
        <span>Se guardará:</span>
        {labels.map((l) => (
          <span key={l} className="rounded-full bg-surface px-2 py-0.5 font-semibold text-text">
            {l}
          </span>
        ))}
        {added > 0 && (
          <span key={added} className="pop-in ml-auto inline-flex items-center gap-1 font-semibold text-text" role="status">
            <CheckCircle2 size={13} aria-hidden /> Añadida
          </span>
        )}
      </div>
      {error && <p className="mt-1 rounded-lg bg-surface px-2 py-1 text-xs font-medium text-text">{error}</p>}
    </form>
  );
}

const PROJECT_STATUS = [
  { id: "active", label: "Activo" },
  { id: "paused", label: "En pausa" },
  { id: "done", label: "Terminado" },
] as const;

function ProjectModal({ categories, project, onClose, onDeleted }: { categories: Category[]; project: Project | null; onClose: () => void; onDeleted: () => void }) {
  const [name, setName] = useState(project?.name ?? "");
  const [description, setDescription] = useState(project?.description ?? "");
  const [category, setCategory] = useState(project?.category_id ?? "");
  const [target, setTarget] = useState(project?.target_date ?? "");
  const [status, setStatus] = useState<string>(project?.status ?? "active");
  const { run, pending, error } = useAction();
  const color = categories.find((c) => c.id === category)?.color;
  return (
    <Modal open onClose={onClose} title={project ? "Editar proyecto" : "Nuevo proyecto"}>
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          const input = { name, description: description || null, category_id: category || null, target_date: target || null };
          if (project) run(() => updateProject(project.id, { ...input, status }), onClose);
          else run(() => createProject(input), onClose);
        }}
      >
        <div className="flex items-center gap-3 rounded-2xl bg-surface-2/70 p-3">
          <span
            className="tone-chip h-11 w-11 rounded-[14px]"
            style={color ? { background: `linear-gradient(140deg, ${color}, color-mix(in srgb, ${color} 55%, var(--tone-2)))` } : undefined}
            aria-hidden
          >
            <Folder size={20} />
          </span>
          <Input
            autoFocus
            required
            maxLength={80}
            placeholder="Nombre del proyecto"
            value={name}
            onChange={(e) => setName(e.target.value)}
            aria-label="Nombre"
            className="h-11 border-transparent! bg-surface! font-display text-base font-semibold"
          />
        </div>
        <Textarea placeholder="Plan: objetivo, alcance, hitos…" maxLength={5000} value={description} onChange={(e) => setDescription(e.target.value)} aria-label="Plan" className="min-h-24" />
        <div className="grid grid-cols-2 gap-3">
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Categoría</p>
            <IconSelect
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              aria-label="Categoría"
              icon={<span className="ml-0.5 h-2.5 w-2.5 rounded-full border border-border-strong" style={color ? { background: color, borderColor: color } : undefined} />}
            >
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </IconSelect>
          </div>
          <div>
            <p className="mb-1.5 text-xs font-semibold text-muted">Fecha objetivo</p>
            <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Fecha objetivo" />
          </div>
        </div>
        {project && (
          <Field label="Estado" htmlFor="project-status">
            <IconSelect id="project-status" value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado del proyecto">
              {PROJECT_STATUS.map((st) => (
                <option key={st.id} value={st.id}>
                  {st.label}
                </option>
              ))}
            </IconSelect>
          </Field>
        )}
        <ErrorText>{error}</ErrorText>
        <div className="flex items-center justify-between gap-2 border-t border-border pt-4">
          {project ? (
            <Button
              variant="danger"
              size="sm"
              disabled={pending}
              onClick={() => {
                if (confirm(`¿Eliminar el proyecto "${project.name}"? Sus tareas se conservan, sin proyecto.`)) run(() => deleteProject(project.id), onDeleted);
              }}
            >
              Eliminar
            </Button>
          ) : (
            <span />
          )}
          <Button type="submit" disabled={pending || !name.trim()}>
            {project ? "Guardar" : "Crear proyecto"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
