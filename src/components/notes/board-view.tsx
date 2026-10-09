"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckSquare, GripHorizontal, LayoutGrid, Pencil, Plus, Tag, Trash2 } from "lucide-react";
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

const NOTE_STYLE: Record<NoteColor, string> = {
  yellow: "bg-[#fff3b0] dark:bg-[#3a3416] text-[#3d3500] dark:text-[#f5e9a8]",
  pink: "bg-[#ffd6e4] dark:bg-[#3d1c29] text-[#4a1027] dark:text-[#f9c6d8]",
  blue: "bg-[#d3e8ff] dark:bg-[#172a40] text-[#0b2a4a] dark:text-[#bcdcff]",
  green: "bg-[#d5f5df] dark:bg-[#153322] text-[#0b3b1e] dark:text-[#bdf0cf]",
  purple: "bg-[#e6dcff] dark:bg-[#2a2145] text-[#2a1460] dark:text-[#d9ccff]",
  orange: "bg-[#ffe1c4] dark:bg-[#3d2714] text-[#4a2600] dark:text-[#ffd3a8]",
  gray: "bg-[#ececf0] dark:bg-[#26262d] text-[#24242c] dark:text-[#dcdce3]",
};
const SWATCH: Record<NoteColor, string> = {
  yellow: "#facc15",
  pink: "#f472b6",
  blue: "#60a5fa",
  green: "#4ade80",
  purple: "#a78bfa",
  orange: "#fb923c",
  gray: "#a1a1aa",
};
const COLORS = Object.keys(NOTE_STYLE) as NoteColor[];

type Patch = Partial<Pick<Note, "content" | "color" | "x" | "y" | "width" | "height" | "z_index" | "group_label">>;

export function BoardView({ board, boards, initialNotes }: { board: Board; boards: Board[]; initialNotes: Note[] }) {
  const router = useRouter();
  const [notes, setNotes] = useState<Note[]>(initialNotes);
  const [saving, setSaving] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [groupFilter, setGroupFilter] = useState<string>("");
  const pending = useRef(new Map<string, Patch>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canvasRef = useRef<HTMLDivElement>(null);
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
      (row) => row && setNotes((prev) => [...prev, row]),
    );
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
    setNotes((prev) => prev.map((n) => ({ ...n, ...positions.find((p) => p.id === n.id) })));
    setSaving("saving");
    run(() => updateNotePositions(positions), () => setSaving("saved"));
  };

  const canvasSize = useMemo(() => {
    const w = Math.max(1600, ...notes.map((n) => n.x + n.width + 200));
    const h = Math.max(1000, ...notes.map((n) => n.y + n.height + 200));
    return { w, h };
  }, [notes]);

  return (
    <div className="flex h-[calc(100dvh-8.5rem)] flex-col gap-3 lg:h-[calc(100dvh-4rem)]">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex max-w-full gap-1 overflow-x-auto rounded-xl border border-border bg-surface p-1">
          {boards.map((b) => (
            <Link
              key={b.id}
              href={`/notes/${b.id}`}
              className={cn(
                "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm",
                b.id === board.id ? "bg-accent-soft font-medium text-accent" : "text-muted hover:text-text",
              )}
            >
              {b.name}
            </Link>
          ))}
          <button
            type="button"
            className="rounded-lg px-2 text-muted hover:text-text"
            aria-label="Nuevo tablero"
            title="Nuevo tablero"
            onClick={() => {
              const name = prompt("Nombre del nuevo tablero");
              if (name?.trim()) run(() => createBoard(name), (id) => id && router.push(`/notes/${id}`));
            }}
          >
            <Plus size={16} />
          </button>
        </div>
        <Button variant="ghost" size="icon" title="Renombrar tablero" aria-label="Renombrar tablero" onClick={() => {
          const name = prompt("Nuevo nombre", board.name);
          if (name?.trim()) run(() => updateBoard(board.id, { name }));
        }}>
          <Pencil size={15} />
        </Button>
        {boards.length > 1 && (
          <Button variant="ghost" size="icon" title="Eliminar tablero" aria-label="Eliminar tablero" onClick={() => {
            if (confirm(`¿Eliminar el tablero "${board.name}" y todas sus notas?`)) run(() => deleteBoard(board.id), () => router.push("/notes"));
          }}>
            <Trash2 size={15} />
          </Button>
        )}
        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-muted" aria-live="polite">
            {saving === "saving" ? "Guardando…" : saving === "saved" ? "Guardado" : saving === "error" ? "Error al guardar" : ""}
          </span>
          {groups.length > 0 && (
            <Select value={groupFilter} onChange={(e) => setGroupFilter(e.target.value)} className="h-9 w-auto" aria-label="Filtrar por grupo">
              <option value="">Todos los grupos</option>
              {groups.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </Select>
          )}
          {notes.length > 1 && (
            <Button variant="secondary" size="sm" onClick={arrangeByGroup} title="Ordenar en columnas por grupo">
              <LayoutGrid size={14} /> Agrupar
            </Button>
          )}
          <Button size="sm" onClick={addNote}>
            <Plus size={14} /> Nota
          </Button>
        </div>
      </div>
      {error && <p className="text-sm text-danger">{error}</p>}

      <div
        ref={canvasRef}
        className="relative flex-1 overflow-auto rounded-2xl border border-border bg-surface-2/50"
        style={{ backgroundImage: "radial-gradient(var(--border) 1px, transparent 1px)", backgroundSize: "24px 24px" }}
      >
        <div className="relative" style={{ width: canvasSize.w, height: canvasSize.h }}>
          {notes.length === 0 && (
            <div className="absolute left-10 top-10 max-w-sm text-sm text-muted">
              Tablero vacío. Pulsa <b>+ Nota</b> para escribir ideas, listas o recordatorios. Arrástralas por la barra superior y
              cambia su tamaño desde la esquina.
            </div>
          )}
          {notes.map((n) => (
            <StickyNote
              key={n.id}
              note={n}
              dimmed={Boolean(groupFilter) && n.group_label !== groupFilter}
              onChange={change}
              onFront={() => bringToFront(n.id)}
              onDelete={() => {
                if (n.content.trim() && !confirm("¿Eliminar esta nota?")) return;
                pending.current.delete(n.id);
                setNotes((prev) => prev.filter((x) => x.id !== n.id));
                run(() => deleteNote(n.id));
              }}
              onConvert={async () => { await flush(); run(() => convertNoteToTask(n.id), (taskId) => taskId && setNotes((prev) => prev.map((x) => (x.id === n.id ? { ...x, task_id: taskId } : x)))); }}
              onFlush={flush}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function StickyNote({
  note,
  dimmed,
  onChange,
  onFront,
  onDelete,
  onConvert,
  onFlush,
}: {
  note: Note;
  dimmed: boolean;
  onChange: (id: string, patch: Patch, delay?: number) => void;
  onFront: () => void;
  onDelete: () => void;
  onConvert: () => void;
  onFlush: () => void;
}) {
  const [menu, setMenu] = useState(false);
  const drag = useRef<{ px: number; py: number; x: number; y: number; w: number; h: number; mode: "move" | "resize" } | null>(null);

  const startDrag = (e: React.PointerEvent, mode: "move" | "resize") => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { px: e.clientX, py: e.clientY, x: note.x, y: note.y, w: note.width, h: note.height, mode };
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
    onFlush();
  };

  const moveBy = (dx: number, dy: number) => onChange(note.id, { x: Math.max(0, note.x + dx), y: Math.max(0, note.y + dy) }, 400);

  return (
    <div
      className={cn("absolute flex flex-col rounded-xl shadow-md transition-opacity", NOTE_STYLE[note.color], dimmed && "opacity-30")}
      style={{ left: note.x, top: note.y, width: note.width, height: note.height, zIndex: note.z_index }}
      onPointerDown={() => onFront()}
    >
      <div
        className="flex h-7 shrink-0 cursor-grab touch-none items-center justify-between rounded-t-xl px-2 active:cursor-grabbing"
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
        <GripHorizontal size={14} className="opacity-40" />
        <div className="flex items-center gap-0.5" onPointerDown={(e) => e.stopPropagation()}>
          {note.group_label && <span className="mr-1 max-w-24 truncate rounded bg-black/10 px-1 text-[10px]">{note.group_label}</span>}
          {note.task_id ? (
            <Link href="/tasks?view=all" title="Convertida en tarea" className="rounded p-1 opacity-70 hover:opacity-100">
              <CheckSquare size={13} />
            </Link>
          ) : (
            <button type="button" onClick={onConvert} title="Convertir en tarea" aria-label="Convertir en tarea" className="rounded p-1 opacity-50 hover:opacity-100">
              <CheckSquare size={13} />
            </button>
          )}
          <button type="button" onClick={() => setMenu(!menu)} title="Color y grupo" aria-label="Color y grupo" className="rounded p-1 opacity-50 hover:opacity-100">
            <Tag size={13} />
          </button>
          <button type="button" onClick={onDelete} title="Eliminar" aria-label="Eliminar nota" className="rounded p-1 opacity-50 hover:opacity-100">
            <Trash2 size={13} />
          </button>
        </div>
      </div>
      {menu && (
        <div className="space-y-2 border-b border-black/10 px-2 pb-2" onPointerDown={(e) => e.stopPropagation()}>
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                aria-pressed={note.color === c}
                onClick={() => onChange(note.id, { color: c }, 200)}
                className={cn("h-5 w-5 rounded-full border border-black/10", note.color === c && "ring-2 ring-black/40")}
                style={{ backgroundColor: SWATCH[c] }}
              />
            ))}
          </div>
          <input
            defaultValue={note.group_label ?? ""}
            placeholder="Grupo / tema"
            maxLength={40}
            onChange={(e) => onChange(note.id, { group_label: e.target.value.trim() || null })}
            className="w-full rounded bg-black/5 px-2 py-1 text-xs placeholder:opacity-60 focus:outline-none"
            aria-label="Grupo"
          />
        </div>
      )}
      <textarea
        value={note.content}
        onChange={(e) => onChange(note.id, { content: e.target.value })}
        placeholder="Escribe aquí…"
        maxLength={5000}
        className="flex-1 resize-none bg-transparent px-3 pb-3 pt-1 text-sm leading-relaxed placeholder:opacity-50 focus:outline-none"
        aria-label="Contenido de la nota"
      />
      <div
        className="absolute bottom-0 right-0 h-4 w-4 cursor-nwse-resize touch-none"
        onPointerDown={onResizeDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        aria-hidden
        style={{ background: "linear-gradient(135deg, transparent 50%, rgba(0,0,0,.15) 50%)", borderBottomRightRadius: 12 }}
      />
    </div>
  );
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v));
}
