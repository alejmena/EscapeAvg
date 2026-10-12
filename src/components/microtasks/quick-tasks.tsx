"use client";

import "./microtasks.css";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bookmark, Check, GripVertical, History, ListChecks, MoreHorizontal, PartyPopper, Play, Plus, Repeat, Trash2, Undo2 } from "lucide-react";
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
import { ProgressRing } from "@/components/ui/card";

const BURST_COLORS = ["var(--tone)", "var(--tone-2)", "var(--gold-2)", "var(--success)", "var(--ring-habits)"];
// Con más tareas que esto, la barra de progreso deja de ir por segmentos.
const MAX_SEGMENTS = 12;
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
export function QuickTasks({
  tasks,
  templates,
  today,
  showHistoryLink = true,
  className,
}: {
  tasks: QuickTask[];
  templates: QuickTemplate[];
  today: string;
  /** En /microtasks no hace falta el enlace al historial (ya estás en él). */
  showHistoryLink?: boolean;
  className?: string;
}) {
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
  const share = total ? done / total : 0;
  const allDone = total > 0 && done === total;
  const chips = templates.filter((t) => t.repeat_days.length === 0);

  return (
    <section
      data-tone="pink"
      className={cn("card-glass @container relative min-w-0 overflow-hidden rounded-[26px] p-4 sm:p-5", className)}
      aria-labelledby="qt-title"
      aria-busy={busy > 0}
      data-testid="quick-tasks"
    >
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-tone opacity-[0.14] blur-3xl" aria-hidden />
      <div className="pointer-events-none absolute -bottom-24 -left-16 h-52 w-52 rounded-full bg-tone-2 opacity-[0.1] blur-3xl" aria-hidden />

      <div className="relative grid gap-4 @3xl:grid-cols-[210px_minmax(0,1fr)] @3xl:gap-7">
        {/* Resumen: anillo, título, contador y barra por segmentos */}
        <div className="flex min-w-0 flex-col gap-3 @3xl:gap-4 @3xl:border-r @3xl:border-border/70 @3xl:pr-6">
          <div className="flex items-center gap-3 @3xl:contents">
            <span className="@3xl:hidden">
              <ProgressRing value={share} size={48} stroke={5} color={allDone ? "var(--success)" : undefined}>
                {allDone ? <Check size={18} strokeWidth={3} className="text-success" /> : <ListChecks size={18} className="text-tone" />}
              </ProgressRing>
            </span>
            <span className="hidden @3xl:inline-grid">
              <ProgressRing value={share} size={104} stroke={9} color={allDone ? "var(--success)" : undefined}>
                <span className="flex flex-col items-center">
                  <span className="num-xl text-[26px]">{Math.round(share * 100)}%</span>
                  <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">hoy</span>
                </span>
              </ProgressRing>
            </span>
            <div className="min-w-0 flex-1 @3xl:flex-none">
              <h2 id="qt-title" className="font-display text-[17px] font-semibold leading-tight @3xl:text-[19px]">
                Mis tareas rápidas{" "}
                <span className="text-muted @3xl:block @3xl:text-[15px]">
                  <span className="@3xl:hidden">— </span>Hoy
                </span>
              </h2>
              <span className="mt-0.5 block whitespace-nowrap text-xs font-medium text-muted tabular" data-testid="quick-counter" aria-live="polite">
                {quickCounter(items)}
              </span>
            </div>
            {showHistoryLink && (
              <Link
                href="/microtasks"
                className="press inline-flex h-9 w-9 shrink-0 items-center justify-center gap-1.5 rounded-full bg-tone-soft text-xs font-semibold text-tone-ink transition-colors hover:bg-tone hover:text-white @3xl:order-last @3xl:mt-auto @3xl:h-8 @3xl:w-fit @3xl:px-3"
                aria-label="Historial y ajustes de tareas rápidas"
                title="Historial y ajustes"
              >
                <History size={15} />
                <span className="hidden @3xl:inline" aria-hidden>
                  Historial y ajustes
                </span>
              </Link>
            )}
          </div>

          {/* Un segmento por tarea: se van llenando al tachar. */}
          {total > 0 && total <= MAX_SEGMENTS ? (
            <div className="flex gap-1" aria-hidden>
              {items.map((t, i) => (
                <span key={t.id} className="h-2 flex-1 overflow-hidden rounded-full bg-surface-3/80">
                  <span
                    className={cn(
                      "block h-full rounded-full bg-gradient-to-r transition-[width] duration-500 ease-out",
                      allDone ? "from-success to-[color-mix(in_srgb,var(--success)_50%,var(--gold-2))]" : "from-tone to-tone-2",
                    )}
                    style={{ width: i < done ? "100%" : "0%", transitionDelay: `${i * 40}ms` }}
                  />
                </span>
              ))}
            </div>
          ) : (
            <div className="h-2 overflow-hidden rounded-full bg-surface-3/80" aria-hidden>
              <div className="h-full rounded-full bg-gradient-to-r from-tone to-tone-2 transition-[width] duration-500" style={{ width: `${share * 100}%` }} />
            </div>
          )}

        </div>

        <div className="min-w-0">
          {allDone && (
            <p className="qt-all-done mb-2 flex items-center gap-2.5 rounded-2xl bg-gradient-to-r from-success-soft to-gold-soft px-3 py-2.5 text-sm font-semibold text-success">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-success text-white shadow-[0_6px_14px_-6px_var(--success)] dark:text-bg">
                <PartyPopper size={15} aria-hidden />
              </span>
              Todo hecho por hoy. Bien.
            </p>
          )}

          <ul ref={listRef} className="space-y-0.5" aria-label="Tareas rápidas de hoy">
            {items.map((t, i) => {
              const isDone = t.status === "done";
              const dragging = drag?.from === i;
              const party = celebrating.has(t.id);
              return (
                <li
                  key={t.id}
                  data-qt-row
                  className={cn(
                    "group qt-in relative flex min-h-12 items-center gap-1 rounded-2xl pr-1 transition-colors duration-200 hover:bg-surface-2/70",
                    party && "qt-row-done",
                    dragging && "z-10 bg-surface shadow-pop ring-1 ring-tone/30",
                  )}
                  style={{
                    transform: dragging ? `translateY(${drag!.dy}px) scale(1.02)` : `translateY(${shiftFor(i)}px)`,
                    transition: dragging ? "none" : drag ? "transform 200ms var(--ease-out)" : undefined,
                  }}
                >
                  <button
                    type="button"
                    className="grid h-10 w-6 shrink-0 cursor-grab touch-none place-items-center text-faint transition-opacity hover:text-muted active:cursor-grabbing [@media(hover:hover)]:opacity-40 [@media(hover:hover)]:group-hover:opacity-100"
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
                    className="relative grid h-10 w-10 shrink-0 place-items-center"
                  >
                    <span
                      className={cn(
                        "grid h-6 w-6 place-items-center rounded-[8px] border-2 transition-[background-color,border-color,box-shadow] duration-200",
                        isDone
                          ? "border-transparent bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_6px_14px_-6px_var(--tone)]"
                          : "border-faint/60 bg-surface group-hover:border-tone group-hover:bg-tone-soft",
                        party && "qt-check-pop",
                      )}
                    >
                      {isDone && <Check size={15} strokeWidth={3.5} />}
                    </span>
                    {party && (
                      <span className="qt-burst" aria-hidden>
                        {Array.from({ length: 10 }, (_, k) => (
                          <i key={k} style={{ "--a": `${k * 36}deg`, "--c": BURST_COLORS[k % BURST_COLORS.length] } as React.CSSProperties} />
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
                      className="h-10 min-w-0 flex-1 rounded-xl border border-tone bg-surface px-2.5 text-[15px] shadow-[0_0_0_4px_color-mix(in_srgb,var(--tone)_16%,transparent)] focus:outline-none"
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
                      className="min-w-0 flex-1 py-2.5 text-left text-[15px] font-medium leading-snug"
                      title="Toca para editar"
                    >
                      <span data-done={isDone} className={cn("qt-strike break-words", isDone && "text-muted")}>
                        {t.title}
                      </span>
                      {t.quick_template_id && (
                        <span className="ml-2 inline-grid h-5 w-5 place-items-center rounded-full bg-tone-soft align-[-3px] text-tone-ink">
                          <Repeat size={11} aria-label="Se repite" />
                        </span>
                      )}
                    </button>
                  )}

                  {!isTmp(t.id) && editing !== t.id && (
                    <div className="flex shrink-0 items-center transition-opacity [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => setMenuFor(t)}
                        className="press grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-surface-3/70 hover:text-text"
                        aria-label={`Más opciones de "${t.title}"`}
                      >
                        <MoreHorizontal size={16} />
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(t)}
                        className="press grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-danger-soft hover:text-danger"
                        aria-label={`Eliminar "${t.title}"`}
                      >
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
            className="mt-2 flex items-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface/50 py-1 pl-1 pr-2 transition-[border-color,background-color,box-shadow] duration-200 focus-within:border-solid focus-within:border-tone/60 focus-within:bg-surface focus-within:shadow-[0_0_0_4px_color-mix(in_srgb,var(--tone)_14%,transparent)]"
          >
            <span className="tone-chip h-9 w-9 rounded-xl" aria-hidden>
              <Plus size={18} strokeWidth={2.6} />
            </span>
            <input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Añadir tarea rápida..."
              aria-label="Añadir tarea rápida"
              maxLength={200}
              enterKeyHint="done"
              className="h-10 min-w-0 flex-1 bg-transparent px-1 text-[15px] placeholder:text-muted/80 focus:outline-none"
            />
            <kbd className="hidden rounded-lg bg-surface-2 px-2 py-1 font-sans text-[11px] font-semibold text-muted @sm:inline-block" aria-hidden>
              Enter ↵
            </kbd>
          </form>

          {chips.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-1.5" aria-label="Plantillas rápidas">
              <span className="mr-0.5 inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-wider text-muted" aria-hidden>
                <Bookmark size={12} /> Un clic
              </span>
              {chips.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => add(c.title)}
                  className="press rounded-full bg-tone-soft px-3 py-1.5 text-xs font-semibold text-tone-ink transition-[background-color,color,box-shadow] hover:bg-tone hover:text-white hover:shadow-[0_6px_14px_-6px_var(--tone)]"
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
        </div>
      </div>

      {undo && (
        <div
          role="status"
          className="qt-toast glass fixed bottom-[calc(env(safe-area-inset-bottom)+6.5rem)] left-1/2 z-50 flex -translate-x-1/2 items-center gap-3 rounded-full border border-border py-2 pl-4 pr-2 text-sm shadow-pop lg:bottom-8"
        >
          <span className="max-w-[48vw] truncate">Eliminada: {undo.task.title}</span>
          <button
            type="button"
            onClick={restore}
            className="press flex items-center gap-1 rounded-full bg-gradient-to-br from-tone to-tone-2 px-3 py-1.5 text-xs font-semibold text-white shadow-[0_6px_14px_-6px_var(--tone)]"
          >
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
      <div className="space-y-4" data-tone="pink">
        <div className="rounded-[20px] border border-border/80 bg-surface-2/50 p-4">
          <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
            <span className="tone-chip h-7 w-7 rounded-lg" aria-hidden>
              <Repeat size={14} />
            </span>
            Repetir esta tarea
          </p>
          <div className="grid max-w-xs grid-cols-7 gap-1.5">
            {DAY_CHIPS.map((d) => {
              const on = days.includes(d);
              return (
                <button
                  key={d}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleDay(d)}
                  className={cn(
                    "press aspect-square w-full rounded-full text-sm font-semibold transition-[background-color,color,box-shadow]",
                    on ? "bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_6px_14px_-6px_var(--tone)]" : "border border-border bg-surface text-muted hover:text-text",
                  )}
                >
                  {DAY_SHORT[d]}
                </button>
              );
            })}
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5 text-xs">
            <button type="button" className="press rounded-full bg-tone-soft px-2.5 py-1 font-semibold text-tone-ink hover:brightness-95" onClick={() => setDays([0, 1, 2, 3, 4, 5, 6])}>
              Todos los días
            </button>
            <button type="button" className="press rounded-full bg-tone-soft px-2.5 py-1 font-semibold text-tone-ink hover:brightness-95" onClick={() => setDays([1, 2, 3, 4, 5])}>
              Lun a vie
            </button>
            <button type="button" className="press rounded-full bg-surface px-2.5 py-1 font-semibold text-muted hover:text-text" onClick={() => setDays([])}>
              Ninguno
            </button>
          </div>
          <Button variant="tone" className="mt-4 w-full" disabled={saving || (!template && days.length === 0)} onClick={() => save(days)}>
            {days.length ? `Repetir: ${describeRepeat(days)}` : template ? "Dejar de repetir" : "Elige los días"}
          </Button>
        </div>

        <div className="grid gap-2">
          {!template && (
            <Button variant="secondary" disabled={saving} onClick={() => save([])}>
              <Bookmark size={15} /> Guardar como plantilla de un clic
            </Button>
          )}
          <Link
            href={`/focus?task=${task.id}`}
            className="press flex h-10 items-center justify-center gap-2 rounded-full border border-border bg-surface text-sm font-semibold shadow-soft hover:border-border-strong hover:bg-surface-2"
          >
            <Play size={15} /> Cronometrar el tiempo real
          </Link>
          <p className="px-4 text-center text-xs text-muted">Completar una tarea rápida no suma minutos. Solo cuenta el tiempo que cronometres.</p>
          <Button variant="danger" onClick={onDelete}>
            <Trash2 size={15} /> Eliminar
          </Button>
        </div>
      </div>
    </Modal>
  );
}
