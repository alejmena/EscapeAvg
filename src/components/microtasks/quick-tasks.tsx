"use client";

import "./microtasks.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Check, GripVertical, History, MoreHorizontal, Play, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
import { cn } from "@/lib/cn";
import { describeRepeat, moveItem, quickCounter } from "@/lib/domain/quick";
import type { ActionResult, QuickTask, QuickTemplate } from "@/lib/types";
import {
  addQuickTask,
  deleteQuickTask,
  makeQuickRecurring,
  renameQuickTask,
  reorderQuickTasks,
  restoreQuickTask,
  toggleQuickTask,
} from "@/app/(app)/microtasks/actions";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";

const BURST_COLORS = ["var(--ring-tasks)", "var(--ring-habits)", "var(--ring-focus)", "var(--warning)", "var(--accent)"];
const DAY_CHIPS = [1, 2, 3, 4, 5, 6, 0] as const;
const DAY_SHORT = ["D", "L", "M", "X", "J", "V", "S"];

type Undo = { task: QuickTask; index: number };
type Drag = { from: number; to: number; dy: number; shift: number };

let tmpSeq = 0;
const isTmp = (id: string) => id.startsWith("tmp-");

/**
 * "Mis tareas rápidas — Hoy": escribir y pulsar Enter crea la tarea; un toque la completa.
 * Todo se guarda solo en Supabase; la interfaz responde al instante (optimista).
 */
export function QuickTasks({ tasks, templates, today }: { tasks: QuickTask[]; templates: QuickTemplate[]; today: string }) {
  const router = useRouter();
  const [items, setItems] = useState(tasks);
  const [busy, setBusy] = useState(0);
  // Cuando el servidor manda datos nuevos y no hay cambios en vuelo, se adoptan tal cual.
  const [prevTasks, setPrevTasks] = useState(tasks);
  if (prevTasks !== tasks) {
    setPrevTasks(tasks);
    if (busy === 0) setItems(tasks);
  }

  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [celebrating, setCelebrating] = useState<Set<string>>(new Set());
  const [editing, setEditing] = useState<string | null>(null);
  const [menuFor, setMenuFor] = useState<QuickTask | null>(null);
  const [undo, setUndo] = useState<Undo | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const listRef = useRef<HTMLUListElement>(null);
  const dragData = useRef<{ startY: number; mids: number[]; heights: number[]; from: number; to: number; gap: number } | null>(null);

  useEffect(() => {
    if (!undo) return;
    const t = setTimeout(() => setUndo(null), 7000);
    return () => clearTimeout(t);
  }, [undo]);

  async function track<T>(p: Promise<ActionResult<T>>): Promise<ActionResult<T>> {
    setBusy((b) => b + 1);
    setError(null);
    try {
      const r = await p;
      if (!r.ok) {
        setError(r.error);
        router.refresh();
      }
      return r;
    } catch {
      setError("Sin conexión con el servidor. Inténtalo de nuevo.");
      router.refresh();
      return { ok: false, error: "offline" };
    } finally {
      setBusy((b) => b - 1);
    }
  }

  const nextPosition = () => items.reduce((m, t) => Math.max(m, t.position), 0) + 1;

  async function add(title: string) {
    const clean = title.trim().slice(0, 200);
    if (!clean) return;
    const position = nextPosition();
    const tmp: QuickTask = {
      id: `tmp-${++tmpSeq}`,
      title: clean,
      status: "todo",
      due_date: today,
      position,
      completed_at: null,
      quick_template_id: null,
      actual_seconds: 0,
    };
    setItems((xs) => [...xs, tmp]);
    const r = await track(addQuickTask({ title: clean, position }));
    setItems((xs) => (r.ok && r.data ? xs.map((x) => (x.id === tmp.id ? r.data! : x)) : xs.filter((x) => x.id !== tmp.id)));
  }

  function toggle(t: QuickTask) {
    const done = t.status !== "done";
    setItems((xs) =>
      xs.map((x) => (x.id === t.id ? { ...x, status: done ? "done" : "todo", completed_at: done ? new Date().toISOString() : null } : x)),
    );
    if (done) {
      setCelebrating((s) => new Set(s).add(t.id));
      setTimeout(
        () =>
          setCelebrating((s) => {
            const n = new Set(s);
            n.delete(t.id);
            return n;
          }),
        900,
      );
      navigator.vibrate?.(12);
    }
    track(toggleQuickTask(t.id, done));
  }

  function rename(t: QuickTask, title: string) {
    setEditing(null);
    const clean = title.trim().slice(0, 200);
    if (!clean || clean === t.title) return;
    setItems((xs) => xs.map((x) => (x.id === t.id ? { ...x, title: clean } : x)));
    track(renameQuickTask(t.id, clean));
  }

  function remove(t: QuickTask) {
    const index = items.findIndex((x) => x.id === t.id);
    setItems((xs) => xs.filter((x) => x.id !== t.id));
    setMenuFor(null);
    setUndo({ task: t, index });
    track(deleteQuickTask(t.id));
  }

  async function restore() {
    if (!undo) return;
    const { task, index } = undo;
    setUndo(null);
    setItems((xs) => {
      const next = xs.slice();
      next.splice(Math.min(index, next.length), 0, task);
      return next;
    });
    const r = await track(
      restoreQuickTask({ title: task.title, done: task.status === "done", due_date: task.due_date, position: task.position }),
    );
    setItems((xs) => (r.ok && r.data ? xs.map((x) => (x.id === task.id ? r.data! : x)) : xs.filter((x) => x.id !== task.id)));
  }

  // --- Arrastrar para ordenar (ratón y táctil, con el asa ⋮⋮) ---
  function onDragStart(e: React.PointerEvent, index: number) {
    if (e.button !== 0 || !listRef.current) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const rows = [...listRef.current.querySelectorAll<HTMLElement>("[data-qt-row]")];
    const rects = rows.map((r) => r.getBoundingClientRect());
    dragData.current = {
      startY: e.clientY,
      mids: rects.map((r) => r.top + r.height / 2),
      heights: rects.map((r) => r.height),
      from: index,
      to: index,
      gap: rects.length > 1 ? Math.max(0, rects[1].top - rects[0].bottom) : 0,
    };
    setDrag({ from: index, to: index, dy: 0, shift: dragData.current.heights[index] + dragData.current.gap });
  }

  function onDragMove(e: React.PointerEvent) {
    const d = dragData.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const center = d.mids[d.from] + dy;
    let to = 0;
    d.mids.forEach((m, i) => {
      if (i !== d.from && m < center) to++;
    });
    d.to = to;
    setDrag({ from: d.from, to, dy, shift: d.heights[d.from] + d.gap });
  }

  function onDragEnd() {
    const d = dragData.current;
    dragData.current = null;
    setDrag(null);
    // El destino se lee del ref: el último movimiento puede no haberse renderizado aún al soltar.
    if (!d) return;
    const { from, to } = d;
    if (from === to) return;
    const next = moveItem(items, from, to).map((t, i) => ({ ...t, position: i + 1 }));
    setItems(next);
    track(reorderQuickTasks(next.filter((t) => !isTmp(t.id)).map((t) => t.id)));
  }

  function shiftFor(i: number): number {
    if (!drag || i === drag.from) return 0;
    const h = drag.shift;
    if (drag.from < i && i <= drag.to) return -h;
    if (drag.to <= i && i < drag.from) return h;
    return 0;
  }

  const total = items.length;
  const done = items.filter((t) => t.status === "done").length;
  const chips = templates.filter((t) => t.repeat_days.length === 0);

  return (
    <section className="card-glass relative min-w-0 overflow-hidden rounded-[24px] p-5" aria-labelledby="qt-title" aria-busy={busy > 0} data-testid="quick-tasks">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-warning via-ring-focus to-accent" aria-hidden />
      <div className="mb-1 flex items-center justify-between gap-2">
        <h2 id="qt-title" className="min-w-0 text-[13px] font-bold uppercase tracking-wider">
          Mis tareas rápidas <span className="text-muted">— Hoy</span>
        </h2>
        <div className="flex shrink-0 items-center gap-1">
          <span className="whitespace-nowrap text-xs text-muted tabular" data-testid="quick-counter" aria-live="polite">
            {quickCounter(items)}
          </span>
          <Link href="/microtasks" className="rounded-full p-1.5 text-muted hover:bg-surface-2 hover:text-text" aria-label="Historial y ajustes de tareas rápidas" title="Historial y ajustes">
            <History size={15} />
          </Link>
        </div>
      </div>
      <div className="mb-3 h-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
        <div className="h-full rounded-full bg-gradient-to-r from-ring-tasks to-[var(--ring-tasks-2)] transition-[width] duration-500" style={{ width: total ? `${(done / total) * 100}%` : "0%" }} />
      </div>

      {total > 0 && done === total && (
        <p className="qt-all-done mb-2 flex items-center gap-1.5 text-sm font-semibold text-success">
          <Check size={16} strokeWidth={3} /> Todo hecho por hoy. Bien.
        </p>
      )}

      <ul ref={listRef} className="space-y-0.5" aria-label="Tareas rápidas de hoy">
        {items.map((t, i) => {
          const isDone = t.status === "done";
          const dragging = drag?.from === i;
          return (
            <li
              key={t.id}
              data-qt-row
              className={cn(
                "group qt-in relative flex min-h-11 items-center gap-1.5 rounded-xl pr-1",
                celebrating.has(t.id) && "qt-row-done",
                dragging && "z-10 bg-surface shadow-pop",
              )}
              style={{
                transform: dragging ? `translateY(${drag!.dy}px) scale(1.02)` : `translateY(${shiftFor(i)}px)`,
                transition: dragging ? "none" : drag ? "transform 200ms var(--ease-out)" : undefined,
              }}
            >
              <button
                type="button"
                className="grid h-9 w-6 shrink-0 cursor-grab touch-none place-items-center text-muted/60 hover:text-muted active:cursor-grabbing"
                aria-label={`Arrastrar "${t.title}" para cambiar el orden`}
                onPointerDown={(e) => onDragStart(e, i)}
                onPointerMove={onDragMove}
                onPointerUp={onDragEnd}
                onPointerCancel={onDragEnd}
              >
                <GripVertical size={15} />
              </button>
              <button
                type="button"
                role="checkbox"
                aria-checked={isDone}
                aria-label={isDone ? `Desmarcar "${t.title}"` : `Completar "${t.title}"`}
                disabled={isTmp(t.id)}
                onClick={() => toggle(t)}
                className="relative grid h-9 w-9 shrink-0 place-items-center"
              >
                <span
                  className={cn(
                    "grid h-[22px] w-[22px] place-items-center rounded-[7px] border-2 transition-colors duration-200",
                    isDone ? "border-success bg-success text-white dark:text-bg" : "border-border bg-surface group-hover:border-accent",
                    celebrating.has(t.id) && "qt-check-pop",
                  )}
                >
                  {isDone && <Check size={14} strokeWidth={3.5} />}
                </span>
                {celebrating.has(t.id) && (
                  <span className="qt-burst" aria-hidden>
                    {Array.from({ length: 8 }, (_, k) => (
                      <i key={k} style={{ "--a": `${k * 45}deg`, "--c": BURST_COLORS[k % BURST_COLORS.length] } as React.CSSProperties} />
                    ))}
                  </span>
                )}
              </button>

              {editing === t.id ? (
                <input
                  autoFocus
                  defaultValue={t.title}
                  maxLength={200}
                  aria-label="Editar tarea"
                  className="h-9 min-w-0 flex-1 rounded-lg border border-accent bg-surface px-2 text-[15px] focus:outline-none"
                  onBlur={(e) => rename(t, e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") e.currentTarget.blur();
                    if (e.key === "Escape") setEditing(null);
                  }}
                />
              ) : (
                <button
                  type="button"
                  onClick={() => !isTmp(t.id) && setEditing(t.id)}
                  className="min-w-0 flex-1 py-2 text-left text-[15px] leading-snug"
                  title="Toca para editar"
                >
                  <span data-done={isDone} className={cn("qt-strike break-words", isDone && "text-muted")}>
                    {t.title}
                  </span>
                  {t.quick_template_id && <Repeat size={12} className="ml-1.5 inline align-[-1px] text-muted" aria-label="Se repite" />}
                </button>
              )}

              {!isTmp(t.id) && editing !== t.id && (
                <div className="flex shrink-0 items-center opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
                  <button type="button" onClick={() => setMenuFor(t)} className="grid h-9 w-8 place-items-center rounded-lg text-muted hover:bg-surface-2 hover:text-text" aria-label={`Más opciones de "${t.title}"`}>
                    <MoreHorizontal size={16} />
                  </button>
                  <button type="button" onClick={() => remove(t)} className="grid h-9 w-8 place-items-center rounded-lg text-muted hover:bg-danger-soft hover:text-danger" aria-label={`Eliminar "${t.title}"`}>
                    <Trash2 size={15} />
                  </button>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = text;
          setText("");
          add(v);
        }}
        className="mt-1 flex items-center gap-1.5"
      >
        <span className="grid h-9 w-6 shrink-0 place-items-center" aria-hidden />
        <span className="grid h-9 w-9 shrink-0 place-items-center text-accent" aria-hidden>
          <Plus size={18} />
        </span>
        <input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Añadir tarea rápida..."
          aria-label="Añadir tarea rápida"
          maxLength={200}
          enterKeyHint="done"
          className="h-10 min-w-0 flex-1 rounded-xl bg-transparent px-1 text-[15px] placeholder:text-muted/80 focus:bg-surface-2/60 focus:outline-none"
        />
      </form>

      {chips.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Plantillas rápidas">
          <Bookmark size={13} className="text-muted" aria-hidden />
          {chips.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => add(c.title)}
              className="press rounded-full border border-border bg-surface px-2.5 py-1 text-xs hover:border-accent hover:text-accent"
              title="Añadir a hoy con un clic"
            >
              + {c.title}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-2 text-xs text-danger">
          {error}
        </p>
      )}

      {undo && (
        <div
          role="status"
          className="qt-toast glass fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border py-2 pl-4 pr-2 text-sm shadow-pop lg:bottom-8"
        >
          <span className="max-w-[48vw] truncate">Eliminada: {undo.task.title}</span>
          <button type="button" onClick={restore} className="press flex items-center gap-1 rounded-full bg-accent px-3 py-1.5 text-xs font-semibold text-accent-fg">
            <Undo2 size={13} /> Deshacer
          </button>
        </div>
      )}

      {menuFor && (
        <TaskMenu
          task={menuFor}
          template={templates.find((x) => x.id === menuFor.quick_template_id) ?? null}
          onClose={() => setMenuFor(null)}
          onDelete={() => remove(menuFor)}
          onSaved={(repeating) => {
            if (repeating) setItems((xs) => xs.map((x) => (x.id === menuFor.id ? { ...x, quick_template_id: x.quick_template_id ?? "pending" } : x)));
            setMenuFor(null);
          }}
          track={track}
        />
      )}
    </section>
  );
}

function TaskMenu({
  task,
  template,
  onClose,
  onDelete,
  onSaved,
  track,
}: {
  task: QuickTask;
  template: QuickTemplate | null;
  onClose: () => void;
  onDelete: () => void;
  onSaved: (repeating: boolean) => void;
  track: <T>(p: Promise<ActionResult<T>>) => Promise<ActionResult<T>>;
}) {
  const [days, setDays] = useState<number[]>(template?.repeat_days ?? []);
  const [saving, setSaving] = useState(false);
  const toggleDay = (d: number) => setDays((xs) => (xs.includes(d) ? xs.filter((x) => x !== d) : [...xs, d]));

  async function save(repeat: number[]) {
    setSaving(true);
    const r = await track(makeQuickRecurring(task.id, repeat));
    setSaving(false);
    if (r.ok) onSaved(repeat.length > 0);
  }

  return (
    <Modal open onClose={onClose} title={task.title} sheet>
      <div className="space-y-5">
        <div>
          <p className="mb-2 flex items-center gap-1.5 text-sm font-medium">
            <Repeat size={15} className="text-accent" /> Repetir esta tarea
          </p>
          <div className="flex flex-wrap gap-1.5">
            {DAY_CHIPS.map((d) => (
              <button
                key={d}
                type="button"
                aria-pressed={days.includes(d)}
                onClick={() => toggleDay(d)}
                className={cn(
                  "press h-10 w-10 rounded-full border text-sm font-semibold",
                  days.includes(d) ? "border-accent bg-accent text-accent-fg" : "border-border bg-surface text-muted",
                )}
              >
                {DAY_SHORT[d]}
              </button>
            ))}
          </div>
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            <button type="button" className="text-accent hover:underline" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>
              Todos los días
            </button>
            <button type="button" className="text-accent hover:underline" onClick={() => setDays([1, 2, 3, 4, 5])}>
              Lun a vie
            </button>
            <button type="button" className="text-muted hover:underline" onClick={() => setDays([])}>
              Ninguno
            </button>
          </div>
          <Button className="mt-3 w-full" disabled={saving || (!template && days.length === 0)} onClick={() => save(days)}>
            {days.length ? `Repetir: ${describeRepeat(days)}` : template ? "Dejar de repetir" : "Elige los días"}
          </Button>
        </div>

        <div className="grid gap-2">
          {!template && (
            <Button variant="secondary" disabled={saving} onClick={() => save([])}>
              <Bookmark size={15} /> Guardar como plantilla de un clic
            </Button>
          )}
          <Link href={`/focus?task=${task.id}`} className="press flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-medium shadow-soft hover:bg-surface-2">
            <Play size={15} /> Cronometrar el tiempo real
          </Link>
          <p className="text-center text-xs text-muted">Completar una tarea rápida no suma minutos. Solo cuenta el tiempo que cronometres.</p>
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={15} /> Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
