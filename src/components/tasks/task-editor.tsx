"use client";

import { useState } from "react";
import { CalendarDays, Check, Clock, Flag, Folder, Gauge, Sparkles, SplitSquareVertical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { suggestBreakdown } from "@/lib/domain/breakdown";
import type { RecurrenceRule } from "@/lib/domain/recurrence";
import { formatDuration } from "@/lib/domain/stats";
import { PRIORITY_COLOR, PRIORITY_LABEL, WEEKDAY_SHORT } from "@/lib/format";
import type { Category, Project, Task } from "@/lib/types";
import { addSubtasks, createTask, updateTask } from "@/app/(app)/tasks/actions";
import { logManualTime } from "@/app/(app)/focus/actions";
import { cn } from "@/lib/cn";
import { IconSelect } from "./icon-select";
import { useAction } from "./use-action";

type Draft = {
  title: string;
  notes: string;
  priority: number;
  due_date: string;
  category_id: string;
  project_id: string;
  estimated_minutes: string;
  progress_target: string;
  progress_current: string;
  progress_unit: string;
  recurrence: "none" | RecurrenceRule["freq"];
  interval: string;
  weekdays: number[];
};

function toDraft(t?: Partial<Task>): Draft {
  return {
    title: t?.title ?? "",
    notes: t?.notes ?? "",
    priority: t?.priority ?? 0,
    due_date: t?.due_date ?? "",
    category_id: t?.category_id ?? "",
    project_id: t?.project_id ?? "",
    estimated_minutes: t?.estimated_minutes ? String(t.estimated_minutes) : "",
    progress_target: t?.progress_target ? String(t.progress_target) : "",
    progress_current: t?.progress_current ? String(t.progress_current) : "0",
    progress_unit: t?.progress_unit ?? "",
    recurrence: t?.recurrence?.freq ?? "none",
    interval: String(t?.recurrence?.interval ?? 1),
    weekdays: t?.recurrence?.weekdays ?? [],
  };
}

const intOrNull = (s: string) => (s.trim() === "" ? null : Math.round(Number(s)));

/** Bloque del editor con ficha de icono y título pequeño. */
function Block({ icon, title, children, className }: { icon: React.ReactNode; title: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("rounded-[20px] border border-border/80 bg-surface-2/40 p-3.5", className)}>
      <p className="mb-3 flex items-center gap-2 text-[13px] font-semibold text-text">
        <span className="tone-chip-soft h-7 w-7 rounded-lg [&_svg]:h-3.5 [&_svg]:w-3.5" aria-hidden>
          {icon}
        </span>
        {title}
      </p>
      {children}
    </div>
  );
}

export function TaskEditor({
  task,
  defaults,
  open,
  onClose,
  categories,
  projects,
}: {
  task: Task | null;
  defaults?: Partial<Task>;
  open: boolean;
  onClose: () => void;
  categories: Category[];
  projects: Project[];
}) {
  const [d, setD] = useState<Draft>(() => toDraft(task ?? defaults));
  const [manual, setManual] = useState("");
  const [steps, setSteps] = useState<string[] | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const { run, pending, error } = useAction();
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setD((prev) => ({ ...prev, [k]: v }));
  const prioColor = d.priority ? PRIORITY_COLOR[d.priority] : undefined;
  const catColor = categories.find((c) => c.id === d.category_id)?.color;
  const estimate = task?.estimated_minutes ? task.estimated_minutes * 60 : 0;

  const save = () => {
    const payload = {
      title: d.title,
      notes: d.notes || null,
      priority: d.priority,
      due_date: d.due_date || null,
      category_id: d.category_id || null,
      project_id: d.project_id || null,
      estimated_minutes: intOrNull(d.estimated_minutes),
      progress_target: intOrNull(d.progress_target),
      progress_current: intOrNull(d.progress_current) ?? 0,
      progress_unit: d.progress_unit || null,
      recurrence:
        d.recurrence === "none"
          ? null
          : {
              freq: d.recurrence,
              interval: Math.max(1, intOrNull(d.interval) ?? 1),
              ...(d.recurrence === "weekly" && d.weekdays.length ? { weekdays: d.weekdays } : {}),
            },
    };
    run<unknown>(() => (task ? updateTask(task.id, payload) : createTask(payload)), onClose);
  };

  return (
    <Modal open={open} onClose={onClose} title={task ? "Editar tarea" : "Nueva tarea"} className="max-w-xl">
      <form
        className="space-y-3.5"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        {/* Qué: título protagonista y notas */}
        <div className="relative overflow-hidden rounded-[22px] border border-border/80 bg-surface-2/60 p-2">
          <div className="pointer-events-none absolute -right-10 -top-12 h-32 w-32 rounded-full bg-tone opacity-[0.14] blur-2xl" aria-hidden />
          <Input
            autoFocus
            aria-label="Título"
            placeholder="¿Qué quieres hacer?"
            value={d.title}
            maxLength={200}
            onChange={(e) => set("title", e.target.value)}
            className="relative h-12 border-transparent! bg-transparent! px-2.5! font-display text-lg! font-semibold shadow-none! focus:bg-surface!"
            required
          />
          <Textarea
            aria-label="Notas"
            placeholder="Notas (opcional)"
            value={d.notes}
            maxLength={10000}
            onChange={(e) => set("notes", e.target.value)}
            className="relative min-h-16 border-transparent! bg-transparent! px-2.5! shadow-none! focus:bg-surface!"
          />
        </div>

        <Block icon={<CalendarDays />} title="Cuándo">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Fecha límite" htmlFor="due">
              <Input id="due" type="date" value={d.due_date} onChange={(e) => set("due_date", e.target.value)} />
            </Field>
            <Field label="Repetir" htmlFor="rep">
              <IconSelect id="rep" value={d.recurrence} onChange={(e) => set("recurrence", e.target.value as Draft["recurrence"])}>
                <option value="none">No se repite</option>
                <option value="daily">Diaria</option>
                <option value="weekly">Semanal</option>
                <option value="monthly">Mensual</option>
              </IconSelect>
            </Field>
          </div>
          {d.recurrence !== "none" && (
            <div className="pop-in mt-3 flex flex-wrap items-center gap-2.5 rounded-2xl bg-tone-soft/70 p-3 text-sm text-tone-ink">
              <span className="font-medium">Cada</span>
              <Input type="number" min={1} max={365} value={d.interval} onChange={(e) => set("interval", e.target.value)} className="h-8 w-16 text-center" aria-label="Intervalo" />
              <span className="font-medium">{d.recurrence === "daily" ? "día(s)" : d.recurrence === "weekly" ? "semana(s)" : "mes(es)"}</span>
              {d.recurrence === "weekly" && (
                <div className="flex gap-1" role="group" aria-label="Días">
                  {WEEKDAY_SHORT.map((w, i) => {
                    const on = d.weekdays.includes(i);
                    return (
                      <button
                        key={i}
                        type="button"
                        aria-pressed={on}
                        onClick={() => set("weekdays", on ? d.weekdays.filter((x) => x !== i) : [...d.weekdays, i])}
                        className={cn(
                          "press h-8 w-8 rounded-full text-xs font-semibold transition-colors",
                          on ? "bg-gradient-to-br from-tone to-tone-2 text-white shadow-[0_6px_14px_-6px_var(--tone)]" : "bg-surface text-muted hover:text-text",
                        )}
                      >
                        {w}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </Block>

        <Block icon={<Flag />} title="Prioridad y esfuerzo">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Prioridad" htmlFor="prio">
              <IconSelect
                id="prio"
                value={d.priority}
                onChange={(e) => set("priority", Number(e.target.value))}
                icon={<Flag size={14} className="text-faint" style={prioColor ? { color: prioColor, fill: prioColor, fillOpacity: 0.3 } : undefined} />}
              >
                {PRIORITY_LABEL.map((l, i) => (
                  <option key={l} value={i}>
                    {l}
                  </option>
                ))}
              </IconSelect>
            </Field>
            <Field label="Tiempo estimado (min)" htmlFor="est">
              <div className="relative">
                <Clock size={14} className="pointer-events-none absolute left-3 top-1/2 z-10 -translate-y-1/2 text-faint" aria-hidden />
                <Input
                  id="est"
                  type="number"
                  min={1}
                  max={10000}
                  inputMode="numeric"
                  value={d.estimated_minutes}
                  onChange={(e) => set("estimated_minutes", e.target.value)}
                  className="pl-8!"
                />
              </div>
            </Field>
          </div>
        </Block>

        <Block icon={<Folder />} title="Organización">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Categoría" htmlFor="cat">
              <IconSelect
                id="cat"
                value={d.category_id}
                onChange={(e) => set("category_id", e.target.value)}
                icon={<span className="ml-0.5 h-2.5 w-2.5 rounded-full border border-border-strong" style={catColor ? { background: catColor, borderColor: catColor } : undefined} />}
              >
                <option value="">Sin categoría</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </IconSelect>
            </Field>
            <Field label="Proyecto" htmlFor="proj">
              <IconSelect id="proj" value={d.project_id} onChange={(e) => set("project_id", e.target.value)} icon={<Folder size={14} className="text-faint" />}>
                <option value="">Sin proyecto</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </IconSelect>
            </Field>
          </div>
        </Block>

        <Block icon={<Gauge />} title="Contador de progreso (opcional)">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Input type="number" min={0} aria-label="Progreso actual" value={d.progress_current} onChange={(e) => set("progress_current", e.target.value)} className="h-9 w-20 text-center" />
            <span className="text-muted">de</span>
            <Input type="number" min={1} aria-label="Objetivo" placeholder="30" value={d.progress_target} onChange={(e) => set("progress_target", e.target.value)} className="h-9 w-20 text-center" />
            <Input aria-label="Unidad" placeholder="ejercicios, páginas…" maxLength={30} value={d.progress_unit} onChange={(e) => set("progress_unit", e.target.value)} className="h-9 min-w-32 flex-1" />
          </div>
        </Block>

        {task && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="card-tint rounded-[20px] p-3.5">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <Clock size={13} aria-hidden /> Tiempo real dedicado
              </p>
              <p className="num-xl mt-2 text-[26px]">{formatDuration(task.actual_seconds)}</p>
              {estimate > 0 && (
                <div className="mt-2">
                  <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                    <div
                      className={cn("h-full rounded-full", task.actual_seconds > estimate ? "bg-warning" : "bg-gradient-to-r from-tone to-tone-2")}
                      style={{ width: `${Math.min(100, (task.actual_seconds / estimate) * 100)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">de {formatDuration(estimate)} estimados</p>
                </div>
              )}
              <div className="mt-3 flex gap-2">
                <Input type="number" min={1} max={720} placeholder="min" aria-label="Minutos a registrar" value={manual} onChange={(e) => setManual(e.target.value)} className="h-8 w-20" />
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={pending || !manual}
                  onClick={() => run(() => logManualTime({ task_id: task.id, minutes: Number(manual) }), () => setManual(""))}
                >
                  Registrar
                </Button>
              </div>
            </div>
            <div className="card-tint rounded-[20px] p-3.5" data-tone="violet">
              <p className="flex items-center gap-1.5 text-xs font-semibold text-muted">
                <SplitSquareVertical size={13} aria-hidden /> ¿Te abruma? Divídela
              </p>
              {!steps ? (
                <>
                  <p className="mt-2 text-xs leading-relaxed text-muted">Te propongo pasos pequeños para arrancar sin pensarlo demasiado.</p>
                  <Button size="sm" variant="tone" className="mt-3" onClick={() => setSteps(suggestBreakdown(d.title).steps)}>
                    <Sparkles size={14} /> Sugerir pasos
                  </Button>
                </>
              ) : (
                <div className="mt-2 space-y-1">
                  {steps.map((s, i) => (
                    <label
                      key={i}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 rounded-xl px-2 py-1.5 text-xs transition-colors hover:bg-surface/70",
                        picked.has(i) && "bg-surface/80 font-medium",
                      )}
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 accent-[var(--tone)]"
                        checked={picked.has(i)}
                        onChange={() => {
                          const n = new Set(picked);
                          if (n.has(i)) n.delete(i);
                          else n.add(i);
                          setPicked(n);
                        }}
                      />
                      {s}
                    </label>
                  ))}
                  <Button
                    size="sm"
                    variant="tone"
                    className="mt-1"
                    disabled={pending || picked.size === 0}
                    onClick={() =>
                      run(
                        () => addSubtasks(task.id, steps.filter((_, i) => picked.has(i))),
                        () => {
                          setSteps(null);
                          setPicked(new Set());
                        },
                      )
                    }
                  >
                    Añadir {picked.size || ""} pasos
                  </Button>
                </div>
              )}
            </div>
          </div>
        )}

        <ErrorText>{error}</ErrorText>
        {/* Pie fijo: guardar siempre a mano aunque el formulario sea largo. */}
        <div className="sticky bottom-0 z-10 -mx-5 -mb-5 flex justify-end gap-2 border-t border-border bg-surface/95 px-5 py-4 backdrop-blur-md sm:-mx-6 sm:-mb-6 sm:px-6">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !d.title.trim()}>
            {!pending && <Check size={16} aria-hidden />}
            {pending ? "Guardando…" : task ? "Guardar" : "Crear tarea"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
