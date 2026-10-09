"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Select, Textarea } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { suggestBreakdown } from "@/lib/domain/breakdown";
import type { RecurrenceRule } from "@/lib/domain/recurrence";
import { formatDuration } from "@/lib/domain/stats";
import { PRIORITY_LABEL, WEEKDAY_SHORT } from "@/lib/format";
import type { Category, Project, Task } from "@/lib/types";
import { addSubtasks, createTask, updateTask } from "@/app/(app)/tasks/actions";
import { logManualTime } from "@/app/(app)/focus/actions";
import { cn } from "@/lib/cn";
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
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          save();
        }}
      >
        <Input
          autoFocus
          aria-label="Título"
          placeholder="¿Qué quieres hacer?"
          value={d.title}
          maxLength={200}
          onChange={(e) => set("title", e.target.value)}
          className="h-11 text-base"
          required
        />
        <Textarea aria-label="Notas" placeholder="Notas (opcional)" value={d.notes} maxLength={10000} onChange={(e) => set("notes", e.target.value)} />

        <div className="grid grid-cols-2 gap-3">
          <Field label="Fecha límite" htmlFor="due">
            <Input id="due" type="date" value={d.due_date} onChange={(e) => set("due_date", e.target.value)} />
          </Field>
          <Field label="Prioridad" htmlFor="prio">
            <Select id="prio" value={d.priority} onChange={(e) => set("priority", Number(e.target.value))}>
              {PRIORITY_LABEL.map((l, i) => (
                <option key={l} value={i}>
                  {l}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Categoría" htmlFor="cat">
            <Select id="cat" value={d.category_id} onChange={(e) => set("category_id", e.target.value)}>
              <option value="">Sin categoría</option>
              {categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Proyecto" htmlFor="proj">
            <Select id="proj" value={d.project_id} onChange={(e) => set("project_id", e.target.value)}>
              <option value="">Sin proyecto</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </Select>
          </Field>
          <Field label="Tiempo estimado (min)" htmlFor="est">
            <Input id="est" type="number" min={1} max={10000} inputMode="numeric" value={d.estimated_minutes} onChange={(e) => set("estimated_minutes", e.target.value)} />
          </Field>
          <Field label="Repetir" htmlFor="rep">
            <Select id="rep" value={d.recurrence} onChange={(e) => set("recurrence", e.target.value as Draft["recurrence"])}>
              <option value="none">No se repite</option>
              <option value="daily">Diaria</option>
              <option value="weekly">Semanal</option>
              <option value="monthly">Mensual</option>
            </Select>
          </Field>
        </div>

        {d.recurrence !== "none" && (
          <div className="flex flex-wrap items-center gap-3 rounded-xl bg-surface-2 p-3 text-sm">
            <span>Cada</span>
            <Input type="number" min={1} max={365} value={d.interval} onChange={(e) => set("interval", e.target.value)} className="h-8 w-16" aria-label="Intervalo" />
            <span>{d.recurrence === "daily" ? "día(s)" : d.recurrence === "weekly" ? "semana(s)" : "mes(es)"}</span>
            {d.recurrence === "weekly" && (
              <div className="flex gap-1" role="group" aria-label="Días">
                {WEEKDAY_SHORT.map((w, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={d.weekdays.includes(i)}
                    onClick={() => set("weekdays", d.weekdays.includes(i) ? d.weekdays.filter((x) => x !== i) : [...d.weekdays, i])}
                    className={cn("h-7 w-7 rounded-full text-xs", d.weekdays.includes(i) ? "bg-accent text-accent-fg" : "bg-surface text-muted")}
                  >
                    {w}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        <fieldset className="rounded-xl border border-border p-3">
          <legend className="px-1 text-xs font-medium text-muted">Contador de progreso (opcional)</legend>
          <div className="flex items-center gap-2 text-sm">
            <Input type="number" min={0} aria-label="Progreso actual" value={d.progress_current} onChange={(e) => set("progress_current", e.target.value)} className="h-9 w-20" />
            <span className="text-muted">de</span>
            <Input type="number" min={1} aria-label="Objetivo" placeholder="30" value={d.progress_target} onChange={(e) => set("progress_target", e.target.value)} className="h-9 w-20" />
            <Input aria-label="Unidad" placeholder="ejercicios, páginas…" maxLength={30} value={d.progress_unit} onChange={(e) => set("progress_unit", e.target.value)} className="h-9 flex-1" />
          </div>
        </fieldset>

        {task && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs font-medium text-muted">Tiempo real dedicado</p>
              <p className="mt-1 text-lg font-semibold tabular">{formatDuration(task.actual_seconds)}</p>
              <div className="mt-2 flex gap-2">
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
            <div className="rounded-xl border border-border p-3">
              <p className="text-xs font-medium text-muted">¿Te abruma? Divídela</p>
              {!steps ? (
                <Button size="sm" variant="secondary" className="mt-2" onClick={() => setSteps(suggestBreakdown(d.title).steps)}>
                  <Sparkles size={14} /> Sugerir pasos
                </Button>
              ) : (
                <div className="mt-2 space-y-1">
                  {steps.map((s, i) => (
                    <label key={i} className="flex items-start gap-2 text-xs">
                      <input
                        type="checkbox"
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
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !d.title.trim()}>
            {pending ? "Guardando…" : task ? "Guardar" : "Crear tarea"}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
