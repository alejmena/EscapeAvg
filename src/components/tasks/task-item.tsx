"use client";

import "./tasks.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronRight, Clock, Flag, Folder, Minus, MoreHorizontal, Pencil, Play, Plus, Repeat, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { formatDuration } from "@/lib/domain/stats";
import { describeRecurrence } from "@/lib/domain/recurrence";
import { formatDue, PRIORITY_COLOR, PRIORITY_LABEL } from "@/lib/format";
import type { Category, Project, Task } from "@/lib/types";
import { addSubtasks, bumpProgress, deleteTask, setTaskStatus } from "@/app/(app)/tasks/actions";
import { Badge } from "@/components/ui/card";
import { useAction } from "./use-action";

// Chispas al completar: ángulo y color de cada una.
const SPARKS = [0, 45, 90, 135, 180, 225, 270, 315].map((a, i) => ({
  a,
  c: ["var(--success)", "var(--tone)", "var(--gold-2)", "var(--tone-2)"][i % 4],
}));
// Tiempo que se deja a la animación antes de confirmar en el servidor (la fila aún no se mueve).
const COMMIT_DELAY = 380;

const reducedMotion = () => typeof window !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Casilla redonda de una tarea. Al completarla se dibuja un anillo, la marca hace "pop" y saltan chispas;
 * el cambio se confirma en el servidor un instante después para que la animación se vea.
 * `onChange` avisa al padre (p. ej. para apagar la fila) en el mismo clic.
 */
export function TaskCheckbox({ task, size = 20, onChange }: { task: Task; size?: number; onChange?: (done: boolean) => void }) {
  const { run, pending } = useAction();
  const [done, setDone] = useState(task.status === "done");
  const [burst, setBurst] = useState(0);
  // Sincroniza con el servidor cuando cambia el estado real de la tarea.
  const [prevStatus, setPrevStatus] = useState(task.status);
  if (prevStatus !== task.status) {
    setPrevStatus(task.status);
    setDone(task.status === "done");
  }
  // Confirmación aplazada (solo al completar). Si la casilla desaparece antes, se guarda igualmente.
  const delayed = useRef<{ timer: ReturnType<typeof setTimeout>; flush: () => void } | null>(null);
  useEffect(() => {
    const ref = delayed;
    return () => ref.current?.flush();
  }, []);

  const toggle = () => {
    const next = !done;
    setDone(next);
    onChange?.(next);
    // Desmarcar antes de que se confirme: no hace falta tocar el servidor.
    if (delayed.current) {
      clearTimeout(delayed.current.timer);
      delayed.current = null;
      return;
    }
    if (next) {
      setBurst((b) => b + 1);
      navigator.vibrate?.(10);
      if (!reducedMotion()) {
        const commit = () => {
          if (!delayed.current) return;
          clearTimeout(delayed.current.timer);
          delayed.current = null;
          run(() => setTaskStatus(task.id, "done"));
        };
        delayed.current = { timer: setTimeout(commit, COMMIT_DELAY), flush: commit };
        return;
      }
    }
    run(() => setTaskStatus(task.id, next ? "done" : "todo"));
  };

  const color = !done && task.priority ? PRIORITY_COLOR[task.priority] : undefined;
  const mark = Math.max(10, Math.round(size * 0.6));
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={done}
      aria-label={done ? `Marcar "${task.title}" como pendiente` : `Completar "${task.title}"`}
      disabled={pending}
      onClick={toggle}
      className={cn(
        "group/check press relative grid shrink-0 place-items-center rounded-full border-2 transition-[background-color,border-color,box-shadow,color] duration-300 disabled:cursor-wait",
        done
          ? "border-transparent bg-gradient-to-br from-success to-[color-mix(in_srgb,var(--success)_55%,var(--tone-2))] text-white shadow-[0_6px_14px_-6px_var(--success)] dark:text-bg"
          : color
            ? "bg-[color-mix(in_srgb,var(--pc)_10%,transparent)] text-[var(--pc)] hover:bg-[color-mix(in_srgb,var(--pc)_20%,transparent)] hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--pc)_14%,transparent)]"
            : "border-faint/60 bg-surface/60 text-tone hover:border-tone hover:bg-tone-soft hover:shadow-[0_0_0_4px_color-mix(in_srgb,var(--tone)_14%,transparent)]",
      )}
      style={{ width: size, height: size, ...(color ? ({ "--pc": color, borderColor: color } as React.CSSProperties) : {}) }}
    >
      {/* Marca: completa al marcar, insinuada al pasar por encima. */}
      <span key={burst} data-burst={burst && done ? "" : undefined} className="tc-pop grid place-items-center">
        <svg
          viewBox="0 0 24 24"
          width={mark}
          height={mark}
          fill="none"
          stroke="currentColor"
          strokeWidth={3.4}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
          className={cn("transition-opacity duration-200", done ? "opacity-100" : "opacity-0 group-hover/check:opacity-50")}
        >
          <path d="M5 12.5l4.3 4.3L19 7" pathLength={1} className="tc-draw" />
        </svg>
      </span>
      {burst > 0 && done && (
        <span key={`fx${burst}`} className="pointer-events-none absolute -inset-[7px]" aria-hidden>
          <svg viewBox="0 0 100 100" className="absolute inset-0 h-full w-full overflow-visible">
            <circle cx="50" cy="50" r="47" fill="none" stroke="var(--success)" strokeWidth={2.5} vectorEffect="non-scaling-stroke" pathLength={1} className="tc-ring" />
          </svg>
          <span className="tc-sparks">
            {SPARKS.map((s) => (
              <i key={s.a} style={{ "--a": `${s.a}deg`, "--c": s.c, "--d": `${Math.round(size * 0.95)}px` } as React.CSSProperties} />
            ))}
          </span>
        </span>
      )}
    </button>
  );
}

/** Paso (subtarea) con su casilla; se tacha en cuanto lo marcas. */
function SubtaskRow({ task }: { task: Task }) {
  const [done, setDone] = useState(task.status === "done");
  const [prev, setPrev] = useState(task.status);
  if (prev !== task.status) {
    setPrev(task.status);
    setDone(task.status === "done");
  }
  return (
    <li className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-surface/70">
      <TaskCheckbox task={task} size={18} onChange={setDone} />
      <span data-done={done} className={cn("task-strike min-w-0 break-words text-sm", done && "text-muted")}>
        {task.title}
      </span>
    </li>
  );
}

const iconBtn = "press grid h-8 w-8 place-items-center rounded-full text-muted transition-colors hover:bg-surface-3/70 hover:text-text";

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
  const [more, setMore] = useState(false);
  const [newSub, setNewSub] = useState("");
  // La fila se apaga al completarla mientras el servidor la mueve de grupo.
  const [completing, setCompleting] = useState(false);
  const { run, pending, error } = useAction();
  const due = task.due_date ? formatDue(task.due_date, today) : null;
  const done = task.status === "done";
  const struck = done || completing;
  const subDone = subtasks.filter((s) => s.status === "done").length;
  const recurrence = describeRecurrence(task.recurrence);
  const color = task.priority ? PRIORITY_COLOR[task.priority] : null;
  const estimate = task.estimated_minutes ? task.estimated_minutes * 60 : 0;
  const timeShare = estimate ? Math.min(1, task.actual_seconds / estimate) : 0;
  const overTime = estimate > 0 && task.actual_seconds > estimate;
  const progress = task.progress_target ? Math.min(1, task.progress_current / task.progress_target) : 0;
  const dueVariant = !due ? "neutral" : due.tone === "overdue" && !done ? "danger" : due.tone === "today" ? "success" : due.tone === "soon" ? "tone" : "neutral";

  return (
    <li
      className={cn(
        "group relative animate-in rounded-2xl py-3 pl-4 pr-2 transition-colors duration-200 hover:bg-surface-2/70 sm:pl-5",
        completing && !done && "task-row-done",
      )}
    >
      {/* Acento de prioridad en el borde */}
      {color && !struck && (
        <span
          aria-hidden
          className="task-accent absolute bottom-3 left-1.5 top-3 w-[3px] rounded-full"
          style={{ background: `linear-gradient(${color}, color-mix(in srgb, ${color} 35%, transparent))` }}
        />
      )}
      <div className="flex items-start gap-3">
        <div className="pt-px">
          <TaskCheckbox task={task} size={24} onChange={(d) => setCompleting(d && !done)} />
        </div>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onEdit(task)} className="block w-full rounded-lg text-left">
            <span data-done={struck} className={cn("task-strike break-words text-[15px] font-medium leading-snug", struck && "text-muted")}>
              {task.title}
            </span>
          </button>
          <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted">
            {task.status === "in_progress" && !struck && (
              <Badge variant="tone">
                <span className="live-dot h-1.5 w-1.5" aria-hidden />
                En curso
              </Badge>
            )}
            {due && !done && (
              <Badge variant={dueVariant}>
                <CalendarDays size={11} aria-hidden />
                {due.label}
              </Badge>
            )}
            {category && (
              <Badge color={category.color}>
                <span className="h-1.5 w-1.5 rounded-full" style={{ background: category.color }} aria-hidden />
                {category.name}
              </Badge>
            )}
            {project && (
              <Badge variant="neutral" className="text-text/80">
                <Folder size={11} aria-hidden />
                {project.name}
              </Badge>
            )}
            {task.priority > 0 && color && (
              <span
                title={`Prioridad ${PRIORITY_LABEL[task.priority].toLowerCase()}`}
                className="inline-flex items-center gap-1 font-semibold"
                style={{ color }}
              >
                <Flag size={12} fill="currentColor" fillOpacity={0.25} aria-hidden />
                {PRIORITY_LABEL[task.priority]}
              </span>
            )}
            {recurrence && (
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 font-medium" title={recurrence}>
                <Repeat size={11} aria-hidden />
                {recurrence}
              </span>
            )}
            {(task.estimated_minutes || task.actual_seconds > 0) && (
              <span className="inline-flex items-center gap-1.5 tabular" title="Tiempo real / estimado">
                <Clock size={12} aria-hidden />
                <span>
                  {task.actual_seconds > 0 ? formatDuration(task.actual_seconds) : "0 min"}
                  {task.estimated_minutes ? ` / ${formatDuration(task.estimated_minutes * 60)}` : ""}
                </span>
                {estimate > 0 && (
                  <span className="relative h-1.5 w-10 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <span
                      className={cn("absolute inset-y-0 left-0 rounded-full", overTime ? "bg-warning" : "bg-gradient-to-r from-tone to-tone-2")}
                      style={{ width: `${Math.max(timeShare * 100, task.actual_seconds > 0 ? 8 : 0)}%` }}
                    />
                  </span>
                )}
              </span>
            )}
            {subtasks.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen(!open)}
                aria-expanded={open}
                className={cn(
                  "press inline-flex items-center gap-1 rounded-full px-2 py-0.5 font-semibold transition-colors",
                  subDone === subtasks.length ? "bg-success-soft text-success" : "bg-tone-soft text-tone-ink hover:brightness-95",
                )}
              >
                <ChevronRight size={12} className={cn("transition-transform duration-300", open && "rotate-90")} aria-hidden />
                {subDone}/{subtasks.length} pasos
              </button>
            )}
          </div>

          {task.progress_target && (
            <div className="mt-2.5 flex max-w-md items-center gap-2.5">
              <div className="h-2 min-w-16 flex-1 overflow-hidden rounded-full bg-surface-3/80" aria-hidden>
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-500",
                    progress >= 1 ? "bg-success shadow-[0_0_10px_-2px_var(--success)]" : "bg-gradient-to-r from-tone to-tone-2 shadow-[0_0_10px_-2px_var(--tone)]",
                  )}
                  style={{ width: `${progress * 100}%` }}
                />
              </div>
              <span className="tabular whitespace-nowrap text-xs font-semibold text-text">
                {task.progress_current} de {task.progress_target} {task.progress_unit ?? ""}
              </span>
              <span className="flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  aria-label="Restar uno"
                  disabled={pending || task.progress_current <= 0}
                  onClick={() => run(() => bumpProgress(task.id, -1))}
                  className="press grid h-7 w-7 place-items-center rounded-full bg-surface-2 text-muted hover:bg-surface-3 hover:text-text disabled:opacity-30"
                >
                  <Minus size={14} />
                </button>
                <button
                  type="button"
                  aria-label="Sumar uno"
                  disabled={pending || task.progress_current >= task.progress_target}
                  onClick={() => run(() => bumpProgress(task.id, 1))}
                  className="press grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_6px_14px_-6px_var(--tone)] hover:brightness-110 disabled:opacity-30"
                >
                  <Plus size={14} />
                </button>
              </span>
            </div>
          )}

          {open && (
            <ul className="pop-in mt-2.5 space-y-0.5 rounded-2xl border border-border/70 bg-surface-2/50 p-1.5">
              {subtasks.map((s) => (
                <SubtaskRow key={s.id} task={s} />
              ))}
              <li>
                <form
                  className="flex items-center gap-2.5 rounded-xl px-2 py-1 focus-within:bg-surface/80"
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!newSub.trim()) return;
                    run(() => addSubtasks(task.id, [newSub]), () => setNewSub(""));
                  }}
                >
                  <span className="grid h-[18px] w-[18px] shrink-0 place-items-center rounded-full border-2 border-dashed border-faint/60 text-faint" aria-hidden>
                    <Plus size={10} strokeWidth={3} />
                  </span>
                  <input
                    value={newSub}
                    onChange={(e) => setNewSub(e.target.value)}
                    placeholder="+ Añadir paso"
                    aria-label="Nuevo paso"
                    maxLength={200}
                    className="h-8 min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted focus:outline-none"
                  />
                </form>
              </li>
            </ul>
          )}
          {error && <p className="mt-1 text-xs text-danger">{error}</p>}
        </div>

        {/* Acciones: al pasar por encima en escritorio; en táctil, concentrarse y "más". */}
        <div className="flex shrink-0 items-center gap-0.5 transition-opacity duration-200 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
          {!done && (
            <Link
              href={`/focus?task=${task.id}`}
              className="press grid h-8 w-8 place-items-center rounded-full bg-tone-soft text-tone-ink transition-[background-color,color,box-shadow] hover:bg-tone hover:text-white hover:shadow-[0_8px_18px_-8px_var(--tone)]"
              title="Concentrarme en esta tarea"
              aria-label={`Concentrarme en "${task.title}"`}
            >
              <Play size={13} fill="currentColor" />
            </Link>
          )}
          <div className={cn("items-center gap-0.5", more ? "flex" : "hidden [@media(hover:hover)]:flex")}>
            {subtasks.length === 0 && !open && (
              <button type="button" onClick={() => setOpen(true)} className={iconBtn} title="Añadir pasos" aria-label="Añadir pasos">
                <Plus size={16} />
              </button>
            )}
            <button type="button" onClick={() => onEdit(task)} className={iconBtn} title="Editar" aria-label="Editar">
              <Pencil size={15} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (confirm(`¿Eliminar "${task.title}"${subtasks.length ? " y sus pasos" : ""}?`)) run(() => deleteTask(task.id));
              }}
              className={cn(iconBtn, "hover:bg-danger-soft hover:text-danger")}
              title="Eliminar"
              aria-label="Eliminar"
            >
              <Trash2 size={15} />
            </button>
          </div>
          <button
            type="button"
            onClick={() => setMore(!more)}
            aria-expanded={more}
            aria-label={more ? "Menos acciones" : "Más acciones"}
            className={cn(iconBtn, "[@media(hover:hover)]:hidden", more && "bg-surface-3/70 text-text")}
          >
            <MoreHorizontal size={16} />
          </button>
        </div>
      </div>
    </li>
  );
}
