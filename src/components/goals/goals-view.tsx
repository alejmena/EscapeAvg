"use client";

import { useState } from "react";
import { CheckCircle2, Plus, Target, Trash2 } from "lucide-react";
import { GOAL_METRIC_LABEL, type GoalMetric, type GoalPeriod } from "@/lib/domain/goals";
import { formatShortDate } from "@/lib/format";
import type { Category } from "@/lib/types";
import type { GoalWithProgress } from "@/lib/data/stats";
import { createGoal, deleteGoal, setGoalManualValue, setGoalStatus } from "@/app/(app)/goals/actions";
import { Button } from "@/components/ui/button";
import { Card, EmptyState, PageHeader, ProgressBar } from "@/components/ui/card";
import { ErrorText, Field, Input, Select } from "@/components/ui/form";
import { Modal } from "@/components/ui/modal";
import { useAction } from "@/components/tasks/use-action";

export function GoalsView({ goals, categories, past, today }: { goals: GoalWithProgress[]; categories: Category[]; past: { id: string; title: string; status: string }[]; today: string }) {
  const [creating, setCreating] = useState(false);
  const { run } = useAction();
  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name;
  return (
    <div>
      <PageHeader
        title="Objetivos"
        subtitle="Metas medibles que se actualizan solas con tus datos."
        action={
          <Button onClick={() => setCreating(true)}>
            <Plus size={16} /> Nuevo objetivo
          </Button>
        }
      />
      {goals.length === 0 ? (
        <EmptyState icon={<Target size={28} />} title="Sin objetivos activos">
          Prueba algo alcanzable, por ejemplo: 5 horas de estudio esta semana.
        </EmptyState>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {goals.map((g) => (
            <Card key={g.id} className="space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h3 className="font-medium">{g.title}</h3>
                  <p className="text-xs text-muted">
                    {GOAL_METRIC_LABEL[g.metric]}
                    {catName(g.category_id) ? ` · ${catName(g.category_id)}` : ""} · {formatShortDate(g.range.from)} – {formatShortDate(g.range.to)}
                  </p>
                </div>
                <div className="flex gap-0.5">
                  {g.progress.achieved && (
                    <button type="button" className="rounded-lg p-1.5 text-success hover:bg-success-soft" title="Marcar como logrado" aria-label="Marcar como logrado" onClick={() => run(() => setGoalStatus(g.id, "achieved"))}>
                      <CheckCircle2 size={16} />
                    </button>
                  )}
                  <button type="button" className="rounded-lg p-1.5 text-muted hover:bg-danger-soft hover:text-danger" aria-label="Eliminar objetivo" onClick={() => confirm("¿Eliminar este objetivo?") && run(() => deleteGoal(g.id))}>
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-semibold tabular">{g.progress.value}</span>
                <span className="text-sm text-muted">de {g.progress.target}</span>
              </div>
              <ProgressBar value={g.progress.ratio} color={g.progress.achieved ? "var(--success)" : undefined} label={g.title} />
              {g.metric === "manual" && <ManualUpdate id={g.id} value={g.progress.value} />}
              {g.progress.achieved && <p className="text-sm font-medium text-success">¡Objetivo alcanzado!</p>}
            </Card>
          ))}
        </div>
      )}
      {past.length > 0 && (
        <div className="mt-8">
          <h2 className="mb-2 text-sm font-semibold text-muted">Anteriores</h2>
          <ul className="space-y-1 text-sm">
            {past.map((p) => (
              <li key={p.id} className="flex items-center justify-between rounded-lg px-2 py-1.5 hover:bg-surface">
                <span>
                  {p.status === "achieved" ? "✓ " : ""}
                  {p.title}
                </span>
                <button type="button" className="text-xs text-muted hover:text-text" onClick={() => run(() => setGoalStatus(p.id, "active"))}>
                  Reactivar
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
      {creating && <GoalEditor categories={categories} today={today} onClose={() => setCreating(false)} />}
    </div>
  );
}

function ManualUpdate({ id, value }: { id: string; value: number }) {
  const [v, setV] = useState(String(value));
  const { run, pending } = useAction();
  return (
    <form
      className="flex gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => setGoalManualValue(id, Number(v)));
      }}
    >
      <Input type="number" min={0} step="any" value={v} onChange={(e) => setV(e.target.value)} className="h-8 w-28" aria-label="Progreso actual" />
      <Button type="submit" size="sm" variant="secondary" disabled={pending}>
        Actualizar
      </Button>
    </form>
  );
}

function GoalEditor({ categories, today, onClose }: { categories: Category[]; today: string; onClose: () => void }) {
  const [title, setTitle] = useState("");
  const [metric, setMetric] = useState<GoalMetric>("focus_minutes");
  const [period, setPeriod] = useState<GoalPeriod>("weekly");
  const [target, setTarget] = useState("300");
  const [category, setCategory] = useState("");
  const [start, setStart] = useState(today);
  const [end, setEnd] = useState(today);
  const { run, pending, error } = useAction();
  return (
    <Modal open onClose={onClose} title="Nuevo objetivo">
      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          run(
            () =>
              createGoal({
                title,
                metric,
                period,
                target_value: Number(target),
                category_id: category || null,
                start_date: period === "custom" ? start : null,
                end_date: period === "custom" ? end : null,
              }),
            onClose,
          );
        }}
      >
        <Input autoFocus required maxLength={120} placeholder="Ej.: Estudiar 5 horas esta semana" value={title} onChange={(e) => setTitle(e.target.value)} aria-label="Título" />
        <div className="grid grid-cols-2 gap-3">
          <Field label="Qué se mide" htmlFor="metric">
            <Select id="metric" value={metric} onChange={(e) => setMetric(e.target.value as GoalMetric)}>
              <option value="focus_minutes">Minutos de concentración</option>
              <option value="tasks_completed">Tareas completadas</option>
              <option value="habit_completions">Hábitos cumplidos</option>
              <option value="manual">Manual (lo actualizo yo)</option>
            </Select>
          </Field>
          <Field label="Meta" htmlFor="target">
            <Input id="target" type="number" min={1} step="any" required value={target} onChange={(e) => setTarget(e.target.value)} />
          </Field>
          <Field label="Período" htmlFor="period">
            <Select id="period" value={period} onChange={(e) => setPeriod(e.target.value as GoalPeriod)}>
              <option value="weekly">Esta semana (se renueva)</option>
              <option value="monthly">Este mes (se renueva)</option>
              <option value="custom">Fechas concretas</option>
            </Select>
          </Field>
          {metric !== "manual" && (
            <Field label="Categoría" htmlFor="gcat">
              <Select id="gcat" value={category} onChange={(e) => setCategory(e.target.value)}>
                <option value="">Todas</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </Select>
            </Field>
          )}
        </div>
        {period === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label="Desde" htmlFor="gs">
              <Input id="gs" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
            </Field>
            <Field label="Hasta" htmlFor="ge">
              <Input id="ge" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
            </Field>
          </div>
        )}
        <p className="text-xs text-muted">Consejo: empieza por una meta que estés seguro de poder cumplir. Siempre puedes subirla.</p>
        <ErrorText>{error}</ErrorText>
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button type="submit" disabled={pending || !title.trim()}>
            Crear objetivo
          </Button>
        </div>
      </form>
    </Modal>
  );
}
