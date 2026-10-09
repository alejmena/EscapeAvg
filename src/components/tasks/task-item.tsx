"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, ChevronRight, Clock, Flag, Minus, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/stats";
import { describeRecurrence } from "@/lib/domain/recurrence";
import { formatDue, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/format";
import type { Category, Project, Task } from "@/lib/types";
import { addSubtasks, bumpProgress, deleteTask, setTaskStatus } from "@/app/(app)/tasks/actions";
import { Badge } from "@/components/ui/card";
import { useAction } from "./use-action";

export function TaskCheckbox({ task, size = 20 }: { task: Task; size?: number }) {
  const { run, pending } = useAction();
  const [done, setDone] = useState(task.status === "done");
  // Sincroniza con el servidor cuando cambia el estado real de la tarea.
  const [prevStatus, setPrevStatus] = useState(task.status);
  if (prevStatus !== task.status) {
    setPrevStatus(task.status);
    setDone(task.status === "done");
  }
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`}
      disabled={pending}
      onClick={() => {
        const next = !done;
        setDone(next);
        run(() => setTaskStatus(task.id, next ? "done" : "todo"), undefined);
      }}
      className={cn(
        "grid shrink-0 place-items-center rounded-full border-2 transition-colors",
        done ? "border-success bg-success text-white dark:text-bg" : "border-border hover:border-accent",
      )}
      style={{ width: size, height: size, borderColor: !done && task.priority ? PRIORITY_COLOR[task.priority] : undefined }}
    >
      {done && <Check size={size - 8} strokeWidth={3} />}
    </button>
  );
}

export function TaskItem({
  task,
  subtasks,
  today,
  category,
  project,
  onEdit,
}: {
  task: Task;
  subtasks: Task[];
  today: string;
  category?: Category;
  project?: Project;
  onEdit: (t: Task) => void;
}) {
  const [open, setOpen] = useState(false);
  const [newSub, setNewSub] = useState("");
  const { run, pending, error } = useAction();
  const due = task.due_date ? formatDue(task.due_date, today) : null;
  const done = task.status === "done";
  const subDone = subtasks.filter((s) => s.status === "done").length;
  const recurrence = describeRecurrence(task.recurrence);

  return (
    <li className="group animate-in rounded-xl border border-transparent px-2 py-2 transition-colors hover:border-border hover:bg-surface">
      <div className="flex items-start gap-3">
        <div className="pt-0.5">
          <TaskCheckbox task={task} />
        </div>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onEdit(task)} className="block w-full text-left">
            <span className={cn("text-sm", done && "text-muted line-through")}>{task.title}</span>
          </button>
          <div className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {due && (
              <span
                className={cn(
                  "font-medium",
                  due.tone === "overdue" && !done && "text-danger",
                  due.tone === "today" && "text-success",
                )}
              >
                {due.label}
              </span>
            )}
            {category && <Badge color={category.color}>{category.name}</Badge>}
            {project && <Badge>{project.name}</Badge>}
            {task.priority > 0 && (
              <span title={`Prioridad ${PRIORITY_LABEL[task.priority].toLowerCase()}`} style={{ color: PRIORITY_COLOR[task.priority] }}>
                <Flag size={12} />
              </span>
            )}
            {recurrence && (
              <span className="inline-flex items-center gap-0.5" title={recurrence}>
                <Repeat size={12} />
              </span>
            )}
            {(task.estimated_minutes || task.actual_seconds > 0) && (
              <span className="inline-flex items-center gap-1" title="Tiempo real / estimado">
                <Clock size={12} />
                {task.actual_seconds > 0 ? formatDuration(task.actual_seconds) : "0 min"}
                {task.estimated_minutes ? ` / ${formatDuration(task.estimated_minutes * 60)}` : ""}
              </span>
            )}
            {subtasks.length > 0 && (
              <button type="button" onClick={() => setOpen(!open)} className="inline-flex items-center gap-0.5 hover:text-text">
                <ChevronRight size={12} className={cn("transition-transform", open && "rotate-90")} />
                {subDone}/{subtasks.length} pasos
              </button>
            )}
          </div>

          {task.progress_target && (
            <div className="mt-2 flex items-center gap-2">
              <div className="h-1.5 max-w-48 flex-1 overflow-hidden rounded-full bg-surface-2">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${Math.min(100, (task.progress_current / task.progress_target) * 100)}%` }}
                />
              </div>
              <span className="tabular text-xs text-muted">
                {task.progress_current} de {task.progress_target} {task.progress_unit ?? ""}
              </span>
              <button
                type="button"
                aria-label="Restar uno"
                disabled={pending || task.progress_current <= 0}
                onClick={() => run(() => bumpProgress(task.id, -1))}
                className="rounded-md p-0.5 text-muted hover:bg-surface-2 disabled:opacity-30"
              >
                <Minus size={14} />
              </button>
              <button
                type="button"
                aria-label="Sumar uno"
                disabled={pending || task.progress_current >= task.progress_target}
                onClick={() => run(() => bumpProgress(task.id, 1))}
                className="rounded-md bg-accent-soft p-0.5 text-accent hover:opacity-80 disabled:opacity-30"
              >
                <Plus size={14} />
              </button>
            </div>
          )}

          {open && (
            <ul className="mt-2 space-y-1 border-l border-border pl-3">
              {subtasks.map((s) => (
                <li key={s.id} className="flex items-center gap-2">
                  <TaskCheckbox task={s} size={16} />
                  <span className={cn("text-sm", s.status === "done" && "text-muted line-through")}>{s.title}</span>
                </li>
              ))}
              <li>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newSub.trim()) return;
                    run(() => addSubtasks(task.id, [newSub]), () => setNewSub(""));
                  }}
                >
                  <input
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    placeholder="+ Añadir paso"
                    maxLength={200}
                    className="w-full bg-transparent py-1 text-sm placeholder:text-muted focus:outline-none"
                  />
                </form>
              </li>
            </ul>
          )}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>

        <div className="flex items-center gap-0.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
          {!done && (
            <Link
              href={`/focus?task=${task.id}`}
              className="rounded-lg p-1.5 text-accent hover:bg-accent-soft"
              title="Concentrarme en esta tarea"
              aria-label={`Concentrarme en "${task.title}"`}
            >
              <Play size={16} />
            </Link>
          )}
          {subtasks.length === 0 && !open && (
            <button type="button" onClick={() => setOpen(true)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" title="Añadir pasos" aria-label="Añadir pasos">
              <Plus size={16} />
            </button>
          )}
          <button type="button" onClick={() => onEdit(task)} className="rounded-lg p-1.5 text-muted hover:bg-surface-2" title="Editar" aria-label="Editar">
            <Pencil size={15} />
          </button>
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Eliminar "${task.title}"${subtasks.length ? " y sus pasos" : ""}?`)) run(() => deleteTask(task.id));
            }}
            className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
            title="Eliminar"
            aria-label="Eliminar"
          >
            <Trash2 size={15} />
          </button>
        </div>
      </div>
    </li>
  );
}
