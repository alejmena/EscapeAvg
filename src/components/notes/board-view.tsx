"use client";

import "./board.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, CheckSquare, Filter, GripHorizontal, LayoutGrid, Palette, Pencil, Plus, StickyNote, Trash2 } from "lucide-react";
import { cn } from "@/lib/cn";
import type { Board, Note, NoteColor } from "@/lib/types";
import {
  convertNoteToTask,
  createBoard,
  createNote,
  deleteBoard,
  deleteNote,
  updateBoard,
  updateNote,
  updateNotePositions,
} from "@/app/(app)/notes/actions";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";

// Color de muestra de cada nota (el papel y la tinta están en board.css).
const SWATCH: Record<NoteColor, string> = {
  yellow: "#facc15",
  pink: "#f472b6",
  blue: "#60a5fa",
  green: "#4ade80",
  purple: "#a78bfa",
  orange: "#fb923c",
  gray: "#a1a1aa",
};
const COLORS = Object.keys(SWATCH) as NoteColor[];

type Patch = Partial<Pick<Note, "content" | "color" | "x" | "y" | "width" | "height" | "z_index" | "group_label">>;
export type NotePreview = Pick<Note, "color" | "x" | "y" | "width" | "height">;

const reduceMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Inclinación estable de cada nota (entre -1,6° y 1,6°), para que el tablero parezca de papel. */
function tilt(id: string) {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return ((Math.abs(h) % 7) - 3) * 0.55;
}

export function BoardView({
  board,
  boards,
  previews,
  initialNotes,
}: {
  board: Board;
  boards: Board[];
  previews: Record<string, NotePreview[]>;
  initialNotes: Note[];
}) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const [leaving, setLeaving] = useState<ReadonlySet<string>>(new Set());
  const [arranging, setArranging] = useState(false);
  const [focusId, setFocusId] = useState<string | null>(null);
  const pending = useRef(new Map<string, Patch>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);
  // Orden de entrada de las notas que ya estaban al cargar (las nuevas caen sin retraso).
  const [entryOrder] = useState(() => new Map(initialNotes.map((n, i) => [n.id, Math.min(i, 10)])));
  const { run, error } = useAction();

  const flush = useCallback(async () => {
    const entries = [...pending.current];
    pending.current.clear();
    if (!entries.length) return;
    setSaving("saving");
    const results = await Promise.all(entries.map(([id, patch]) => updateNote(id, patch)));
    setSaving(results.every((r) => r.ok) ? "saved" : "error");
  }, []);

  const schedule = useCallback(
    (id: string, patch: Patch, delay = 600) => {
      pending.current.set(id, { ...pending.current.get(id), ...patch });
      if (timer.current) clearTimeout(timer.current);
      timer.current = setTimeout(flush, delay);
    },
    [flush],
  );

  // En pantallas estrechas, la tarjeta del tablero actual se centra en la tira de tableros.
  useEffect(() => {
    const nav = navRef.current;
    const el = nav?.querySelector<HTMLElement>('[aria-current="page"]');
    if (nav && el && nav.scrollWidth > nav.clientWidth) nav.scrollLeft = el.offsetLeft - (nav.clientWidth - el.offsetWidth) / 2;
  }, []);

  // Guardar lo pendiente al salir de la página.
  useEffect(() => {
    const onHide = () => void flush();
    window.addEventListener("pagehide", onHide);
    return () => {
      window.removeEventListener("pagehide", onHide);
      void flush();
    };
  }, [flush]);

  const change = (id: string, patch: Patch, delay?: number) => {
    setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, ...patch } : n)));
    schedule(id, patch, delay);
  };

  const maxZ = notes.reduce((m, n) => Math.max(m, n.z_index), 0);
  const bringToFront = (id: string) => {
    const n = notes.find((x) => x.id === id);
    if (n && n.z_index < maxZ) change(id, { z_index: maxZ + 1 }, 300);
  };

  const addNote = () => {
    const el = canvasRef.current;
    const x = Math.round((el?.scrollLeft ?? 0) + 40 + (notes.length % 5) * 24);
    const y = Math.round((el?.scrollTop ?? 0) + 40 + (notes.length % 5) * 24);
    run(
      () => createNote(board.id, { x, y, z_index: maxZ + 1, color: "yellow", content: "", group_label: groupFilter || null }),
      (row) => {
        if (!row) return;
        setNotes((prev) => [...prev, row]);
        setFocusId(row.id);
      },
    );
  };

  const removeNote = (id: string) => {
    pending.current.delete(id);
    const drop = () => setNotes((prev) => prev.filter((x) => x.id !== id));
    if (reduceMotion()) drop();
    else {
      // Primero se desvanece y luego desaparece del tablero.
      setLeaving((s) => new Set(s).add(id));
      setTimeout(() => {
        drop();
        setLeaving((s) => {
          const next = new Set(s);
          next.delete(id);
          return next;
        });
      }, 240);
    }
    run(() => deleteNote(id));
  };

  const groups = useMemo(() => [...new Set(notes.map((n) => n.group_label).filter(Boolean) as string[])].sort(), [notes]);

  const arrangeByGroup = () => {
    const cols = new Map<string, Note[]>();
    for (const n of notes) cols.set(n.group_label ?? "", [...(cols.get(n.group_label ?? "") ?? []), n]);
    const keys = [...cols.keys()].sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)));
    const positions: { id: string; x: number; y: number }[] = [];
    let x = 24;
    for (const k of keys) {
      let y = 56;
      const items = cols.get(k)!;
      const width = Math.max(...items.map((i) => i.width));
      for (const n of items) {
        positions.push({ id: n.id, x, y });
        y += n.height + 16;
      }
      x += width + 32;
    }
    // Las notas viajan a su sitio (sin animación si se pidió reducir movimiento).
    if (!reduceMotion()) {
      setArranging(true);
      setTimeout(() => setArranging(false), 700);
    }
    canvasRef.current?.scrollTo({ left: 0, top: 0, behavior: reduceMotion() ? "auto" : "smooth" });
    setNotes((prev) => prev.map((n) => ({ ...n, ...positions.find((p) => p.id === n.id) })));
    setSaving("saving");
    run(() => updateNotePositions(positions), () => setSaving("saved"));
  };

  const canvasSize = useMemo(() => {
    const w = Math.max(1600, ...notes.map((n) => n.x + n.width + 200));
    const h = Math.max(1000, ...notes.map((n) => n.y + n.height + 200));
    return { w, h };
  }, [notes]);

  const status =
    saving === "saving" ? "Guardando…" : saving === "saved" ? "Guardado" : saving === "error" ? "Error al guardar" : "";

  return (
    <div className="flex h-[calc(100dvh-11rem)] flex-col gap-4 lg:h-[calc(100dvh-5.5rem)]">
      {/* Cabecera: nombre del tablero y tableros como tarjetas con miniatura */}
      <header className="relative flex flex-wrap items-center gap-x-6 gap-y-3">
        <div className="pointer-events-none absolute -left-16 -top-24 h-56 w-56 rounded-full bg-tone opacity-[0.16] blur-3xl" aria-hidden />
        <div className="relative flex min-w-0 items-center gap-3.5">
          <span className="tone-chip h-12 w-12 rounded-[16px] [&_svg]:h-6 [&_svg]:w-6">
            <StickyNote aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="eyebrow mb-0.5">Tablero de ideas</p>
            <div className="flex min-w-0 items-center gap-1">
              <h1 className="truncate text-[26px] font-bold leading-[1.1] sm:text-[30px]">{board.name}</h1>
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 shrink-0"
                title="Renombrar tablero"
                aria-label="Renombrar tablero"
                onClick={() => {
                  const name = prompt("Nuevo nombre", board.name);
                  if (name?.trim()) run(() => updateBoard(board.id, { name }));
                }}
              >
                <Pencil size={15} />
              </Button>
              {boards.length > 1 && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0 hover:bg-danger-soft hover:text-danger"
                  title="Eliminar tablero"
                  aria-label="Eliminar tablero"
                  onClick={() => {
                    if (confirm(`¿Eliminar el tablero "${board.name}" y todas sus notas?`)) run(() => deleteBoard(board.id), () => router.push("/notes"));
                  }}
                >
                  <Trash2 size={15} />
                </Button>
              )}
            </div>
          </div>
        </div>

        <nav ref={navRef} aria-label="Tableros" className="relative -mx-4 flex w-[calc(100%+2rem)] min-w-0 gap-2 overflow-x-auto px-4 py-1 sm:mx-0 sm:w-full sm:px-0.5 lg:w-auto lg:flex-1">
          {boards.map((b, i) => {
            const active = b.id === board.id;
            const items = active ? notes : (previews[b.id] ?? []);
            return (
              <Link
                key={b.id}
                href={`/notes/${b.id}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "press group flex shrink-0 items-center gap-2.5 rounded-2xl border p-1.5 pr-4 transition-[background-color,border-color,box-shadow,transform] duration-300",
                  i === 0 && "lg:ml-auto",
                  active
                    ? "border-tone/40 bg-surface shadow-[0_10px_24px_-14px_var(--tone),0_0_0_3px_color-mix(in_srgb,var(--tone)_14%,transparent)] dark:bg-surface-2"
                    : "border-card-border bg-surface/55 hover:-translate-y-0.5 hover:border-border-strong hover:bg-surface dark:bg-surface-2/40",
                )}
              >
                <MiniBoard notes={items} active={active} />
                <span className="min-w-0 leading-tight">
                  <span className={cn("block max-w-[11rem] truncate text-sm font-semibold", !active && "text-muted group-hover:text-text")}>{b.name}</span>
                  <span className="mt-0.5 block text-[11.5px] text-muted tabular">
                    {items.length} {items.length === 1 ? "nota" : "notas"}
                  </span>
                </span>
              </Link>
            );
          })}
          <button
            type="button"
            className="press grid w-14 shrink-0 place-items-center rounded-2xl border border-dashed border-border-strong text-muted transition-colors hover:border-tone hover:bg-tone-soft hover:text-tone-ink"
            aria-label="Nuevo tablero"
            title="Nuevo tablero"
            onClick={() => {
              const name = prompt("Nombre del nuevo tablero");
              if (name?.trim()) run(() => createBoard(name), (id) => id && router.push(`/notes/${id}`));
            }}
          >
            <Plus size={18} />
          </button>
        </nav>
      </header>
      {error && (
        <p role="alert" className="self-start rounded-full bg-danger-soft px-3 py-1 text-sm font-medium text-danger">
          {error}
        </p>
      )}

      {/* Lienzo */}
      <div className="board-canvas relative min-h-0 flex-1 overflow-hidden rounded-[28px]">
        <div ref={canvasRef} className="absolute inset-0 isolate overflow-auto overscroll-contain">
          <div className={cn("board-dots relative", arranging && "board-arranging")} style={{ width: canvasSize.w, height: canvasSize.h }}>
            {notes.map((n) => (
              <Sticky
                key={n.id}
                note={n}
                delay={(entryOrder.get(n.id) ?? 0) * 45}
                dimmed={Boolean(groupFilter) && n.group_label !== groupFilter}
                leaving={leaving.has(n.id)}
                autoFocus={focusId === n.id}
                onChange={change}
                onFront={() => bringToFront(n.id)}
                onDelete={() => {
                  if (n.content.trim() && !confirm("¿Eliminar esta nota?")) return;
                  removeNote(n.id);
                }}
                onConvert={async () => {
                  await flush();
                  run(() => convertNoteToTask(n.id), (taskId) => taskId && setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, task_id: taskId } : x))));
                }}
                onFlush={flush}
              />
            ))}
          </div>
        </div>

        {notes.length === 0 && (
          <div className="pointer-events-none absolute inset-0 isolate grid place-items-center p-6">
            <div className="relative flex max-w-sm flex-col items-center text-center">
              <div className="absolute -inset-x-10 -inset-y-8 -z-10 rounded-full bg-surface/80 blur-2xl dark:bg-bg/70" aria-hidden />
              <div className="relative mb-6 h-24 w-36" aria-hidden>
                <div className="absolute inset-0 -z-10 scale-125 rounded-full bg-tone opacity-20 blur-2xl" />
                <div className="note-paper absolute left-1 top-3 h-[70px] w-[70px]" data-color="blue" style={{ "--rot": "-12deg", "--delay": "60ms" } as React.CSSProperties} />
                <div className="note-paper absolute right-1 top-4 h-[70px] w-[70px]" data-color="pink" style={{ "--rot": "10deg", "--delay": "140ms" } as React.CSSProperties} />
                <div className="note-paper absolute left-1/2 top-0 grid h-[78px] w-[78px] -translate-x-1/2 place-items-center" data-color="yellow" style={{ "--rot": "-2deg", "--delay": "220ms" } as React.CSSProperties}>
                  <Plus size={26} className="opacity-50" />
                </div>
              </div>
              <p className="eyebrow">Tablero vacío</p>
              <p className="mt-1 font-display text-xl font-semibold">Tu lienzo está en blanco</p>
              <p className="mt-2 text-sm leading-relaxed text-muted">
                Pulsa <b className="text-text">+ Nota</b> para escribir ideas, listas o recordatorios. Arrástralas por la barra superior y cambia su tamaño desde la esquina.
              </p>
            </div>
          </div>
        )}

        {/* Estado del autoguardado */}
        <div className="pointer-events-none absolute right-3 top-3 z-20">
          <span
            aria-live="polite"
            className={cn(
              "glass inline-flex items-center gap-1.5 rounded-full border border-card-border px-2.5 py-1 text-xs font-semibold shadow-float transition-[opacity,transform] duration-300",
              status ? "opacity-100" : "-translate-y-1 opacity-0",
              saving === "error" ? "text-danger" : "text-muted",
            )}
          >
            {status && (
              <span
                className={cn("h-1.5 w-1.5 rounded-full", saving === "saving" ? "animate-pulse bg-warning" : saving === "error" ? "bg-danger" : "bg-success")}
                aria-hidden
              />
            )}
            {status}
          </span>
        </div>

        {/* Barra de herramientas flotante */}
        <div className="glass absolute bottom-4 left-1/2 z-20 flex max-w-[calc(100%-1.5rem)] -translate-x-1/2 items-center gap-1 rounded-full border border-card-border p-1.5 shadow-pop">
          {groups.length > 0 && (
            <div className="relative min-w-0">
              <Filter size={14} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-tone-ink" aria-hidden />
              <Select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="h-9 w-auto max-w-[10.5rem] rounded-full! border-transparent! bg-tone-soft/70! pl-8! text-[13px] font-semibold text-tone-ink! sm:max-w-[13rem]"
                aria-label="Filtrar por grupo"
              >
                <option value="">Todos los grupos</option>
                {groups.map((g) => (
                  <option key={g} value={g}>
                    {g}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {notes.length > 1 && (
            <Button variant="ghost" size="sm" className="h-9 shrink-0 text-text" onClick={arrangeByGroup} title="Ordenar en columnas por grupo">
              <LayoutGrid size={15} /> <span className="max-sm:sr-only">Agrupar</span>
            </Button>
          )}
          {(groups.length > 0 || notes.length > 1) && <span className="mx-0.5 h-6 w-px shrink-0 bg-border" aria-hidden />}
          <Button size="sm" className="h-9 shrink-0 px-4" onClick={addNote}>
            <Plus size={15} /> Nota
          </Button>
        </div>
      </div>
    </div>
  );
}

/** Miniatura del tablero: cada nota como un rectángulo de su color. */
function MiniBoard({ notes, active }: { notes: NotePreview[]; active: boolean }) {
  const W = 52;
  const H = 38;
  const maxX = Math.max(820, ...notes.map((n) => n.x + n.width));
  const maxY = Math.max(600, ...notes.map((n) => n.y + n.height));
  const s = Math.min((W - 6) / maxX, (H - 6) / maxY);
  return (
    <span
      className={cn("mini-board relative block shrink-0 overflow-hidden rounded-xl ring-1", active ? "ring-tone/40" : "ring-[var(--card-edge)]")}
      style={{ width: W, height: H }}
      aria-hidden
    >
      {notes.length === 0 ? (
        <span className="absolute inset-2 rounded-md border border-dashed border-border-strong" />
      ) : (
        notes.slice(0, 24).map((n, i) => (
          <span
            key={i}
            className="absolute rounded-[2px] shadow-[0_1px_1px_rgb(0_0_0/0.15)]"
            style={{ left: 3 + n.x * s, top: 3 + n.y * s, width: Math.max(4, n.width * s), height: Math.max(4, n.height * s), background: SWATCH[n.color] }}
          />
        ))
      )}
    </span>
  );
}

function Sticky({
  note,
  delay,
  dimmed,
  leaving,
  autoFocus,
  onChange,
  onFront,
  onDelete,
  onConvert,
  onFlush,
}: {
  note: Note;
  delay: number;
  dimmed: boolean;
  leaving: boolean;
  autoFocus: boolean;
  onChange: (id: string, patch: Patch, delay?: number) => void;
  onFront: () => void;
  onDelete: () => void;
  onConvert: () => void;
  onFlush: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const [dragging, setDragging] = useState<"move" | "resize" | null>(null);
  const drag = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number; mode: "move" | "resize" } | null>(null);

  const startDrag = (e: React.PointerEvent, mode: "move" | "resize") => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: note.x, y: note.y, w: note.width, h: note.height, mode };
    setDragging(mode);
    onFront();
  };
  const onMoveDown = (e: React.PointerEvent) => startDrag(e, "move");
  const onResizeDown = (e: React.PointerEvent) => startDrag(e, "resize");
  const onPointerMove = (e: React.PointerEvent) => {
    const d = drag.current;
    if (!d) return;
    const dx = Math.round(e.clientX - d.px);
    const dy = Math.round(e.clientY - d.py);
    if (d.mode === "move") onChange(note.id, { x: Math.max(0, d.x + dx), y: Math.max(0, d.y + dy) }, 100000);
    else onChange(note.id, { width: clamp(d.w + dx, 140, 800), height: clamp(d.h + dy, 100, 800) }, 100000);
  };
  const onPointerUp = () => {
    if (!drag.current) return;
    drag.current = null;
    setDragging(null);
    onFlush();
  };

  const moveBy = (dx: number, dy: number) => onChange(note.id, { x: Math.max(0, note.x + dx), y: Math.max(0, note.y + dy) }, 400);

  return (
    <div
      className="note-paper absolute flex flex-col"
      data-color={note.color}
      data-dragging={dragging === "move" || undefined}
      data-resizing={dragging === "resize" || undefined}
      data-dimmed={dimmed || undefined}
      data-leaving={leaving || undefined}
      style={
        {
          left: note.x,
          top: note.y,
          width: note.width,
          height: note.height,
          zIndex: note.z_index,
          "--rot": `${tilt(note.id)}deg`,
          "--delay": `${delay}ms`,
        } as React.CSSProperties
      }
      onPointerDown={() => onFront()}
    >
      <div
        className="relative flex h-8 shrink-0 cursor-grab touch-none items-center gap-1.5 rounded-t-[14px] pl-2.5 pr-1 active:cursor-grabbing"
        onPointerDown={onMoveDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onKeyDown={(e) => {
          const step = e.shiftKey ? 40 : 10;
          if (e.key === "ArrowLeft") moveBy(-step, 0);
          else if (e.key === "ArrowRight") moveBy(step, 0);
          else if (e.key === "ArrowUp") moveBy(0, -step);
          else if (e.key === "ArrowDown") moveBy(0, step);
          else return;
          e.preventDefault();
        }}
        tabIndex={0}
        role="button"
        aria-label="Mover nota (flechas del teclado)"
      >
        <GripHorizontal size={15} className="shrink-0 opacity-35" aria-hidden />
        {note.group_label && <span className="note-chip min-w-0 max-w-28 truncate rounded-full px-2 py-0.5 text-[10.5px] font-semibold">{note.group_label}</span>}
        <div className="ml-auto flex shrink-0 items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
          {note.task_id && (
            <Link href="/tasks?view=all" title="Convertida en tarea" className="note-chip pop-in mr-0.5 inline-flex h-6 items-center gap-1 rounded-full px-2 text-[10.5px] font-semibold hover:opacity-80">
              <CheckSquare size={12} aria-hidden /> Tarea
            </Link>
          )}
          <div className="note-tools flex items-center gap-0.5">
            {!note.task_id && (
              <button type="button" onClick={onConvert} title="Convertir en tarea" aria-label="Convertir en tarea" className="note-btn">
                <CheckSquare size={14} />
              </button>
            )}
            <button type="button" onClick={() => setMenu(!menu)} title="Color y grupo" aria-label="Color y grupo" aria-expanded={menu} className={cn("note-btn", menu && "note-chip opacity-100")}>
              <Palette size={14} />
            </button>
            <button type="button" onClick={onDelete} title="Eliminar" aria-label="Eliminar nota" className="note-btn">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
      {menu && (
        <div className="note-panel pop-in relative z-10 mx-2 mb-1 space-y-2 rounded-xl p-2" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex flex-wrap gap-1.5">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={note.color === c}
                onClick={() => onChange(note.id, { color: c }, 200)}
                className={cn(
                  "press grid h-6 w-6 place-items-center rounded-full shadow-[0_0_0_1px_rgb(0_0_0/0.12)_inset] transition-transform hover:scale-110",
                  note.color === c && "scale-110 shadow-[0_0_0_2px_currentColor]",
                )}
                style={{ backgroundColor: SWATCH[c] }}
              >
                {note.color === c && <Check size={13} strokeWidth={3} className="text-[var(--ink)]" aria-hidden />}
              </button>
            ))}
          </div>
          <input
            defaultValue={note.group_label ?? ""}
            placeholder="Grupo / tema"
            maxLength={40}
            onChange={(e) => onChange(note.id, { group_label: e.target.value.trim() || null })}
            className="w-full rounded-lg px-2.5 py-1.5 text-xs font-medium focus:outline-none"
            aria-label="Grupo"
          />
        </div>
      )}
      <textarea
        value={note.content}
        onChange={(e) => onChange(note.id, { content: e.target.value })}
        placeholder="Escribe aquí…"
        maxLength={5000}
        autoFocus={autoFocus}
        className="flex-1 resize-none bg-transparent px-3.5 pb-4 pt-0.5 text-[14px] font-medium leading-relaxed placeholder:text-current placeholder:opacity-45 focus:outline-none"
        aria-label="Contenido de la nota"
      />
      <div
        className="note-corner absolute bottom-0 right-0 h-[18px] w-[18px] cursor-nwse-resize touch-none"
        onPointerDown={onResizeDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden
      />
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
