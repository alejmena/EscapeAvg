"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { CalendarDays, CheckCircle2, FolderPlus, Inbox, ListTodo, Pencil, Plus, Sun } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatLongDate } from "@/lib/format";
import { localDate } from "@/lib/domain/dates";
import type { Category, Project, Task } from "@/lib/types";
import { createProject, createTask, deleteProject, updateProject } from "@/app/(app)/tasks/actions";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
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

  const sections: { title: string; items: Task[]; tone?: "danger" }[] = [];
  if (view === "today") {
    sections.push({ title: "Vencidas", items: open.filter((t) => t.due_date && t.due_date < today), tone: "danger" });
    sections.push({ title: "Hoy", items: open.filter((t) => t.due_date === today) });
    sections.push({ title: "Sin fecha", items: open.filter((t) => !t.due_date) });
    sections.push({
      title: "Completadas hoy",
      items: top.filter((t) => t.status === "done" && t.completed_at && localDate(new Date(t.completed_at), timezone) === today),
    });
  } else if (view === "upcoming") {
    const upcoming = open.filter((t) => t.due_date && t.due_date > today).sort((a, b) => a.due_date!.localeCompare(b.due_date!));
    const byDay = new Map<string, Task[]>();
    for (const t of upcoming) byDay.set(t.due_date!, [...(byDay.get(t.due_date!) ?? []), t]);
    for (const [day, items] of byDay) sections.push({ title: formatLongDate(day), items });
  } else if (view === "all") {
    const groups = new Map<string, Task[]>();
    for (const t of open) groups.set(t.project_id ?? "", [...(groups.get(t.project_id ?? "") ?? []), t]);
    sections.push({ title: "Sin proyecto", items: groups.get("") ?? [] });
    for (const p of projects) if (groups.get(p.id)?.length) sections.push({ title: p.name, items: groups.get(p.id)! });
  } else {
    sections.push({ title: "Completadas", items: top.filter((t) => t.status === "done") });
  }
  const visible = sections.filter((s) => s.items.length > 0);

  const setParam = (key: string, value: string | null) => {
    const sp = new URLSearchParams(params.toString());
    if (value) sp.set(key, value);
    else sp.delete(key);
    router.push(`/tasks?${sp.toString()}`);
  };

  return (
    <div>
      <PageHeader
        title="Tareas"
        subtitle={`${open.length} pendientes`}
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nueva tarea
          </Button>
        }
      />

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex rounded-xl border border-border bg-surface p-1">
          {VIEWS.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setParam("view", v.id === "today" ? null : v.id)}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm",
                view === v.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text",
              )}
            >
              {v.icon}
              <span className="hidden sm:inline">{v.label}</span>
            </button>
          ))}
        </div>
        <Select value={filterCategory ?? ""} onChange={(e) => setParam("category", e.target.value || null)} className="h-10 w-auto" aria-label="Filtrar por categoría">
          <option value="">Todas las categorías</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </Select>
        <Select value={filterProject ?? ""} onChange={(e) => setParam("project", e.target.value || null)} className="h-10 w-auto" aria-label="Filtrar por proyecto">
          <option value="">Todos los proyectos</option>
          {projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </Select>
        {filterProject && projMap.get(filterProject) && (
          <Button variant="ghost" size="sm" onClick={() => setProjectModal(projMap.get(filterProject)!)}>
            <Pencil size={14} /> Editar proyecto
          </Button>
        )}
        <Button variant="ghost" size="sm" onClick={() => setProjectModal("new")}>
          <FolderPlus size={15} /> Proyecto
        </Button>
      </div>

      {view !== "done" && (
        <QuickAdd
          defaults={{
            due_date: view === "today" ? today : undefined,
            category_id: filterCategory ?? undefined,
            project_id: filterProject ?? undefined,
          }}
        />
      )}

      {visible.length === 0 ? (
        <EmptyState icon={<Inbox size={28} />} title={view === "done" ? "Aún no hay tareas completadas" : "Nada pendiente aquí"}>
          {view === "today" ? (
            <>
              Añade algo pequeño que puedas terminar hoy, o revisa{" "}
              <Link href="/tasks?view=upcoming" className="text-accent">
                las próximas
              </Link>
              .
            </>
          ) : (
            "Escribe arriba tu próxima tarea."
          )}
        </EmptyState>
      ) : (
        <div className="space-y-6">
          {visible.map((s) => (
            <section key={s.title}>
              <h2 className={cn("mb-1 px-2 text-xs font-semibold uppercase tracking-wide", s.tone === "danger" ? "text-danger" : "text-muted")}>
                {s.title} <span className="font-normal">· {s.items.length}</span>
              </h2>
              <ul>
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

function QuickAdd({ defaults }: { defaults: { due_date?: string; category_id?: string; project_id?: string } }) {
  const [title, setTitle] = useState("");
  const { run, pending, error } = useAction();
  return (
    <form
      className="mb-6"
      onSubmit={(e) => {
        e.preventDefault();
        if (!title.trim()) return;
        run(() => createTask({ title, ...defaults }), () => setTitle(""));
      }}
    >
      <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3 focus-within:border-accent">
        <Plus size={18} className="text-muted" />
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Añadir tarea y pulsar Enter"
          maxLength={200}
          aria-label="Nueva tarea rápida"
          className="h-11 flex-1 bg-transparent text-sm placeholder:text-muted focus:outline-none"
        />
        {pending && <span className="text-xs text-muted">Guardando…</span>}
      </div>
      {error && <p className="mt-1 text-xs text-danger">{error}</p>}
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
  return (
    <Modal open onClose={onClose} title={project ? "Editar proyecto" : "Nuevo proyecto"}>
      <form
        className="space-y-3"
        onSubmit={(e) => {
          e.preventDefault();
          const input = { name, description: description || null, category_id: category || null, target_date: target || null };
          if (project) run(() => updateProject(project.id, { ...input, status }), onClose);
          else run(() => createProject(input), onClose);
        }}
      >
        <Input autoFocus required maxLength={80} placeholder="Nombre del proyecto" value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre" />
        <textarea
          className="min-h-20 w-full rounded-xl border border-border bg-surface px-3 py-2 text-sm"
          placeholder="Plan: objetivo, alcance, hitos…"
          maxLength={5000}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          aria-label="Plan"
        />
        <div className="grid grid-cols-2 gap-3">
          <Select value={category} onChange={(e) => setCategory(e.target.value)} aria-label="Categoría">
            <option value="">Sin categoría</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Input type="date" value={target} onChange={(e) => setTarget(e.target.value)} aria-label="Fecha objetivo" />
        </div>
        {project && (
          <Select value={status} onChange={(e) => setStatus(e.target.value)} aria-label="Estado del proyecto">
            {PROJECT_STATUS.map((st) => (
              <option key={st.id} value={st.id}>
                {st.label}
              </option>
            ))}
          </Select>
        )}
        {error && <p className="text-sm text-danger">{error}</p>}
        <div className="flex items-center justify-between gap-2">
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
