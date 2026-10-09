"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Coffee, Flag, Maximize2, Minimize2, Minus, Pause, Play, Plus, Rocket, Square, Star, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { suggestBreakdown } from "@/lib/domain/breakdown";
import { addDays, localDate, zonedParts, zonedTimeToISO } from "@/lib/domain/dates";
import { type CategoryInfo, QUALITY_HINT, QUALITY_LABEL, type Quality } from "@/lib/domain/discipline";
import type { Quote } from "@/lib/domain/quotes";
import { formatDuration } from "@/lib/domain/stats";
import { breakAfter, elapsedSeconds, formatClock, remainingSeconds, type PomodoroSettings, type SessionKind } from "@/lib/domain/timer";
import { formatLongDate } from "@/lib/format";
import type { FocusSession, Task } from "@/lib/types";
import {
  deleteSession,
  extendSession,
  logInterruption,
  logManualTime,
  reviewSession,
  setSessionCategory,
  setSessionTask,
  startSession,
  updateSessionStatus,
} from "@/app/(app)/focus/actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, ProgressRing } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";
import { askNotificationPermission, chime, notify } from "./alerts";
import { useNow } from "./use-ticker";

export type HistoryItem = {
  id: string;
  kind: SessionKind;
  status: "completed" | "abandoned";
  started_at: string;
  ended_at: string | null;
  focus_seconds: number | null;
  planned_seconds: number | null;
  note: string | null;
  task_id: string | null;
  task_title: string | null;
  interruptions: number;
  title: string | null;
  category_id: string | null;
  quality: number | null;
  outcome: string | null;
};

type TaskOption = Pick<Task, "id" | "title" | "parent_id" | "category_id" | "estimated_minutes" | "actual_seconds">;

const KIND_LABEL: Record<SessionKind, string> = {
  pomodoro: "Pomodoro",
  stopwatch: "Cronómetro",
  just_start: "Just Start",
  manual: "Registro manual",
  break: "Descanso",
};

export function FocusClient({
  active,
  tasks,
  history,
  settings,
  timezone,
  today,
  initialTaskId,
  initialJust,
  categories,
  ready,
  startQuote,
}: {
  active: FocusSession | null;
  tasks: TaskOption[];
  history: HistoryItem[];
  settings: PomodoroSettings;
  timezone: string;
  today: string;
  initialTaskId: string | null;
  initialJust: number | null;
  categories: CategoryInfo[];
  ready: boolean;
  startQuote: Quote;
}) {
  const [session, setSession] = useState<FocusSession | null>(active);
  const [mode, setMode] = useState<"pomodoro" | "stopwatch">("pomodoro");
  const [minutes, setMinutes] = useState(settings.focus_minutes);
  const [taskId, setTaskId] = useState<string>(initialTaskId ?? active?.task_id ?? "");
  const [zen, setZen] = useState(false);
  const [summary, setSummary] = useState<{ id: string; seconds: number; kind: SessionKind; taskTitle: string | null } | null>(null);
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [suggestBreak, setSuggestBreak] = useState<{ minutes: number; long: boolean } | null>(null);
  const [interruptions, setInterruptions] = useState(0);
  const { run, pending, error } = useAction();
  const finishing = useRef(false);
  const alerted = useRef<string | null>(null);

  // Sincroniza con la sesión del servidor (p. ej. iniciada en otro dispositivo).
  const [prevActive, setPrevActive] = useState(active);
  if (prevActive !== active) {
    setPrevActive(active);
    setSession(active);
  }

  const now = useNow(session?.status === "running");
  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const remaining = session ? remainingSeconds(session, now) : null;
  // "Just Start" alcanzó su objetivo: se ofrece seguir (al ampliar, planned_seconds cambia y esto vuelve a false).
  const justReached = session?.kind === "just_start" && session.status === "running" && remaining === 0;
  const taskTitle = useMemo(() => tasks.find((t) => t.id === (session?.task_id ?? taskId))?.title ?? null, [tasks, session, taskId]);
  const activityName = session?.title ?? taskTitle;
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const pomodorosToday = history.filter(
    (h) => h.kind === "pomodoro" && h.status === "completed" && localDate(new Date(h.started_at), timezone) === today,
  ).length;

  // Título de la pestaña con el reloj.
  useEffect(() => {
    if (!session) {
      document.title = "Concentración · Escape Average";
      return;
    }
    document.title = `${formatClock(remaining ?? elapsed)} · ${session.kind === "break" ? "Descanso" : "Concentrado"}`;
  }, [session, remaining, elapsed]);

  useEffect(() => {
    if (!zen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setZen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [zen]);

  const finish = (status: "completed" | "abandoned") => {
    if (!session || finishing.current) return;
    finishing.current = true;
    const kind = session.kind;
    run(
      () => updateSessionStatus(session.id, status),
      (row) => {
        finishing.current = false;
        setSession(null);
        setZen(false);
        setInterruptions(0);
        if (status === "completed" && row) {
          if (kind === "break") {
            setSummary(null);
            setSuggestBreak(null);
          } else {
            setSummary({ id: row.id, seconds: row.focus_seconds ?? 0, kind, taskTitle: row.title ?? taskTitle });
            setSuggestBreak(kind === "pomodoro" ? breakAfter(settings, pomodorosToday + 1) : null);
          }
        }
      },
    );
    // Si la acción falla, permitir reintentar.
    setTimeout(() => (finishing.current = false), 5000);
  };

  // Fin del tiempo planificado.
  useEffect(() => {
    if (!session || session.status !== "running" || remaining !== 0) return;
    if (session.kind === "pomodoro" || session.kind === "break") {
      chime();
      notify(session.kind === "break" ? "Fin del descanso" : "¡Pomodoro completado!", session.kind === "break" ? "¿Otra sesión?" : "Tómate un descanso.");
      finish("completed");
    } else if (session.kind === "just_start" && alerted.current !== `${session.id}:${session.planned_seconds}`) {
      alerted.current = `${session.id}:${session.planned_seconds}`;
      chime();
      notify("¡Lo lograste!", "Empezaste. ¿Sigues un poco más?");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, session]);

  const start = (kind: SessionKind, plannedSeconds: number | null, overrideTask?: string | null) => {
    askNotificationPermission();
    setSummary(null);
    setSuggestBreak(null);
    const tId = overrideTask !== undefined ? overrideTask : taskId || null;
    // Sin categoría elegida, la actividad hereda la de su tarea.
    const cat = categoryId || tasks.find((t) => t.id === tId)?.category_id || null;
    run(
      () =>
        startSession({
          kind: kind as "pomodoro" | "stopwatch" | "just_start" | "break",
          task_id: kind === "break" ? null : tId,
          planned_seconds: plannedSeconds,
          title: kind === "break" ? null : title.trim() || null,
          category_id: kind === "break" ? null : cat,
        }),
      (row) => {
        if (!row) return;
        setSession(row);
        setTitle("");
      },
    );
  };

  const toggle = () => {
    if (!session) return;
    run(
      () => updateSessionStatus(session.id, session.status === "running" ? "paused" : "running"),
      (row) => row && setSession(row),
    );
  };

  const interrupt = (kind: "internal" | "external") => {
    if (!session) return;
    run(() => logInterruption({ session_id: session.id, kind }), (n) => setInterruptions(n ?? interruptions + 1));
  };

  const breakdown = taskTitle ? suggestBreakdown(taskTitle) : null;

  // ---------- Vista de sesión activa ----------
  const clock = session ? (remaining ?? elapsed) : minutes * 60;
  const progress = session && session.planned_seconds ? Math.min(1, elapsed / session.planned_seconds) : 0;
  const isBreak = session?.kind === "break";

  const controls = session && (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <Button size="lg" onClick={toggle} disabled={pending} variant={session.status === "running" ? "secondary" : "primary"}>
        {session.status === "running" ? <Pause size={18} /> : <Play size={18} />}
        {session.status === "running" ? "Pausar" : "Continuar"}
      </Button>
      <Button size="lg" variant="success" onClick={() => finish("completed")} disabled={pending}>
        <Square size={16} /> Finalizar
      </Button>
    </div>
  );

  if (session && zen) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-8 bg-bg px-6 text-center">
        <button type="button" onClick={() => setZen(false)} className="absolute right-5 top-5 rounded-lg p-2 text-muted hover:bg-surface-2" aria-label="Salir del modo sin distracciones">
          <Minimize2 size={20} />
        </button>
        <p className="text-sm uppercase tracking-widest text-muted">{isBreak ? "Descanso" : (activityName ?? "Concentración")}</p>
        <p className={cn("tabular text-7xl font-light tracking-tight sm:text-9xl", session.status === "paused" && "opacity-50")} aria-live="off">
          {formatClock(clock)}
        </p>
        {controls}
        {!isBreak && (
          <button type="button" onClick={() => interrupt("internal")} className="text-xs text-muted hover:text-text">
            Registrar interrupción {interruptions > 0 && `(${interruptions})`}
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
      <div className="space-y-6">
        <Card className="flex flex-col items-center gap-6 py-10 text-center">
          {session ? (
            <>
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className={cn("h-2 w-2 rounded-full", session.status === "running" ? "animate-pulse bg-success" : "bg-warning")} />
                {KIND_LABEL[session.kind]}
                {session.status === "paused" && " · en pausa"}
              </div>
              <ProgressRing value={session.planned_seconds ? progress : 1} size={268} stroke={14} color={isBreak ? "var(--success)" : undefined}>
                <div>
                  <p className={cn("tabular text-5xl font-light tracking-tight", session.status === "paused" && "opacity-50")}>{formatClock(clock)}</p>
                  {session.planned_seconds && <p className="mt-1 text-xs text-muted">{formatDuration(elapsed)} concentrado</p>}
                </div>
              </ProgressRing>
              {!isBreak && activityName && <p className="-mt-2 max-w-sm truncate text-lg font-semibold">{activityName}</p>}
              {!isBreak && ready && (
                <Select
                  value={session.category_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setSession({ ...session, category_id: v });
                    run(() => setSessionCategory(session.id, v));
                  }}
                  className="max-w-xs"
                  aria-label="Categoría de la actividad"
                >
                  <option value="">Sin categoría</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                      {c.counts ? "" : " (no cuenta)"}
                    </option>
                  ))}
                </Select>
              )}
              {!isBreak && (
                <Select
                  value={session.task_id ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setSession({ ...session, task_id: v });
                    run(() => setSessionTask(session.id, v));
                  }}
                  className="max-w-xs"
                  aria-label="Tarea de la sesión"
                >
                  <option value="">Sin tarea asociada</option>
                  {tasks.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.parent_id ? "↳ " : ""}
                      {t.title}
                    </option>
                  ))}
                </Select>
              )}

              {justReached && session.kind === "just_start" ? (
                <div className="animate-in space-y-3 rounded-2xl bg-success-soft p-4">
                  <p className="font-medium text-success">¡Ya empezaste! Eso era lo difícil.</p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button size="sm" onClick={() => run(() => extendSession(session.id, null), (row) => row && setSession(row))}>
                      Seguir sin límite
                    </Button>
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() =>
                        run(() => extendSession(session.id, Math.min(14400, elapsed + settings.focus_minutes * 60)), (row) => row && setSession(row))
                      }
                    >
                      +{settings.focus_minutes} min
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => finish("completed")}>
                      Terminar aquí
                    </Button>
                  </div>
                </div>
              ) : (
                controls
              )}

              <div className="flex flex-wrap items-center justify-center gap-2 text-sm">
                <Button variant="ghost" size="sm" onClick={() => setZen(true)}>
                  <Maximize2 size={14} /> Sin distracciones
                </Button>
                {!isBreak && (
                  <>
                    <Button variant="ghost" size="sm" onClick={() => interrupt("internal")} title="Me distraje yo (móvil, redes, pensamientos)">
                      <Flag size={14} /> Me distraje
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => interrupt("external")} title="Me interrumpió alguien o algo">
                      <Flag size={14} /> Me interrumpieron
                    </Button>
                  </>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    if (confirm("¿Descartar esta sesión? No contará en tus estadísticas.")) finish("abandoned");
                  }}
                >
                  <X size={14} /> Descartar
                </Button>
              </div>
              {interruptions > 0 && <p className="text-xs text-muted">{interruptions} interrupciones registradas</p>}
              {!isBreak && (
                <figure className="mt-2 max-w-md border-t border-border/70 pt-4 text-center" data-testid="session-quote">
                  <blockquote className="text-lg font-medium" lang={startQuote.origin === "china" ? "zh" : "ru"}>
                    {startQuote.text}
                  </blockquote>
                  <figcaption className="mt-1 text-xs text-muted">
                    «{startQuote.translation}» · {startQuote.source}
                  </figcaption>
                </figure>
              )}
            </>
          ) : (
            <>
              {summary && (
                <div className="animate-in w-full max-w-md space-y-3 text-left">
                  <div className="rounded-2xl bg-success-soft p-4 text-center text-success">
                    <p className="font-semibold">Sesión completada: {formatDuration(summary.seconds)}</p>
                    <p className="text-sm opacity-80">{summary.taskTitle ? `"${summary.taskTitle}". ` : ""}Ya cuenta en tu nivel de hoy.</p>
                  </div>
                  {ready && <ReviewForm sessionId={summary.id} onDone={() => setSummary(null)} />}
                </div>
              )}
              {suggestBreak && (
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button variant="secondary" onClick={() => start("break", suggestBreak.minutes * 60)} disabled={pending}>
                    <Coffee size={16} /> Descanso {suggestBreak.long ? "largo" : "corto"} ({suggestBreak.minutes} min)
                  </Button>
                  <Button variant="ghost" onClick={() => setSuggestBreak(null)}>
                    Saltar descanso
                  </Button>
                </div>
              )}

              <div className="flex rounded-xl border border-border p-1" role="tablist">
                {(["pomodoro", "stopwatch"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    role="tab"
                    aria-selected={mode === m}
                    onClick={() => setMode(m)}
                    className={cn("rounded-lg px-4 py-1.5 text-sm", mode === m ? "bg-accent-soft font-medium text-accent" : "text-muted")}
                  >
                    {m === "pomodoro" ? "Pomodoro" : "Cronómetro"}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-1 sm:gap-4">
                {mode === "pomodoro" && (
                  <button type="button" onClick={() => setMinutes(Math.max(5, minutes - 5))} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Menos 5 minutos">
                    <Minus size={18} />
                  </button>
                )}
                <ProgressRing value={mode === "pomodoro" ? minutes / 60 : 0} size={224} stroke={12}>
                  <p className="tabular text-[52px] font-light tracking-tight">{mode === "pomodoro" ? formatClock(minutes * 60) : "00:00"}</p>
                </ProgressRing>
                {mode === "pomodoro" && (
                  <button type="button" onClick={() => setMinutes(Math.min(180, minutes + 5))} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Más 5 minutos">
                    <Plus size={18} />
                  </button>
                )}
              </div>

              <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
                <Input
                  value={title}
                  maxLength={120}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="¿Qué vas a hacer? (p. ej. Inglés B2)"
                  aria-label="Nombre de la actividad"
                  className="sm:col-span-2"
                />
                <Select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} aria-label="Categoría" disabled={!ready && !categories.length}>
                  <option value="">{ready ? "Categoría" : "Categoría de la tarea"}</option>
                  {ready &&
                    categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                        {c.counts ? "" : " (no cuenta)"}
                      </option>
                    ))}
                </Select>
              <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} aria-label="Tarea">
                <option value="">Tarea (opcional)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.parent_id ? "↳ " : ""}
                    {t.title}
                  </option>
                ))}
              </Select>
              </div>

              <Button size="lg" className="min-w-56" onClick={() => start(mode, mode === "pomodoro" ? minutes * 60 : null)} disabled={pending}>
                <Play size={18} /> Empezar a concentrarme
              </Button>
            </>
          )}
          {error && <p className="text-sm text-danger">{error}</p>}
        </Card>

        {!session && (
          <Card className={cn("border-accent/30", initialJust != null && "ring-2 ring-accent")}>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent">
                  <Rocket size={20} />
                </div>
                <div>
                  <h2 className="font-semibold">Just Start</h2>
                  <p className="text-sm text-muted">¿Sin ganas? No hace falta motivación, solo 2 minutos. Si quieres parar después, para.</p>
                </div>
              </div>
              <div className="flex gap-2">
                <Button variant={initialJust === 2 ? "primary" : "secondary"} onClick={() => start("just_start", 120)} disabled={pending}>
                  <Zap size={16} /> 2 min
                </Button>
                <Button variant={initialJust === 5 ? "primary" : "secondary"} onClick={() => start("just_start", 300)} disabled={pending}>
                  <Zap size={16} /> 5 min
                </Button>
              </div>
            </div>
            {breakdown && (
              <div className="mt-4 rounded-xl bg-surface-2 p-3 text-sm">
                <p className="text-muted">
                  Primer paso para <span className="text-text">&quot;{taskTitle}&quot;</span>:
                </p>
                <p className="mt-1 font-medium">{breakdown.firstStep}</p>
                <Link href="/tasks?view=all" className="mt-2 inline-block text-xs text-accent hover:underline">
                  Dividir la tarea en pasos →
                </Link>
              </div>
            )}
          </Card>
        )}

        <ManualEntry tasks={tasks} categories={categories} ready={ready} timezone={timezone} today={today} defaultTaskId={taskId} />
      </div>

      <aside className="lg:sticky lg:top-8 lg:self-start">
        <HistoryCard history={history} timezone={timezone} categories={catById} ready={ready} />
      </aside>
    </div>
  );
}

function QualityPicker({ value, onChange }: { value: Quality | null; onChange: (q: Quality | null) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Calidad de la actividad">
      {([1, 2, 3] as Quality[]).map((q) => (
        <button
          key={q}
          type="button"
          role="radio"
          aria-checked={value === q}
          title={QUALITY_HINT[q]}
          onClick={() => onChange(value === q ? null : q)}
          className={cn(
            "press rounded-xl border px-2 py-2 text-xs font-medium",
            value === q
              ? q === 1
                ? "border-warning/40 bg-warning-soft text-warning"
                : "border-accent/40 bg-accent-soft text-accent"
              : "border-border text-muted hover:text-text",
          )}
        >
          {QUALITY_LABEL[q]}
        </button>
      ))}
    </div>
  );
}

/** Evaluación opcional y rápida: ¿fue trabajo real o solo estuve ocupado? */
function ReviewForm({
  sessionId,
  initialQuality = null,
  initialOutcome = "",
  onDone,
}: {
  sessionId: string;
  initialQuality?: Quality | null;
  initialOutcome?: string;
  onDone: () => void;
}) {
  const [quality, setQuality] = useState<Quality | null>(initialQuality);
  const [outcome, setOutcome] = useState(initialOutcome);
  const { run, pending, error } = useAction();
  return (
    <form
      className="space-y-3 rounded-2xl border border-border p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => reviewSession(sessionId, { quality, outcome }), onDone);
      }}
      data-testid="review-form"
    >
      <p className="text-sm font-medium">¿Cómo fue? <span className="font-normal text-muted">(opcional)</span></p>
      <QualityPicker value={quality} onChange={setQuality} />
      <p className="text-xs text-muted">{quality ? QUALITY_HINT[quality] : "Si no la evalúas, cuenta como productiva."}</p>
      <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={2000} placeholder="Notas y resultados: qué aprendiste o terminaste" aria-label="Notas y resultados" className="min-h-16" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Ahora no
        </Button>
        <Button type="submit" size="sm" disabled={pending}>
          Guardar
        </Button>
      </div>
      {error && <p className="text-xs text-danger">{error}</p>}
    </form>
  );
}

const pad = (n: number) => String(n).padStart(2, "0");

/** Registro manual: rápido por minutos o detallado con hora de inicio y final. Nunca se solapa con otra actividad. */
function ManualEntry({
  tasks,
  categories,
  ready,
  timezone,
  today,
  defaultTaskId,
}: {
  tasks: TaskOption[];
  categories: CategoryInfo[];
  ready: boolean;
  timezone: string;
  today: string;
  defaultTaskId: string;
}) {
  const [mode, setMode] = useState<"quick" | "range">("quick");
  const [manualMin, setManualMin] = useState("");
  const [title, setTitle] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [day, setDay] = useState(today);
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [quality, setQuality] = useState<Quality | null>(null);
  const [outcome, setOutcome] = useState("");
  const [done, setDone] = useState<string | null>(null);
  const { run, pending, error } = useAction();

  const fillNow = () => {
    const now = zonedParts(new Date(), timezone);
    const from = zonedParts(new Date(Date.now() - 3600_000), timezone);
    setDay(from.date);
    setStart(`${pad(from.hour)}:${pad(from.minute)}`);
    setEnd(`${pad(now.hour)}:${pad(now.minute)}`);
  };

  let range: { startIso: string; endIso: string; minutes: number } | null = null;
  if (start && end && day) {
    const startIso = zonedTimeToISO(day, start, timezone);
    // Si la hora final es anterior a la de inicio, terminó al día siguiente.
    const endIso = zonedTimeToISO(end <= start ? addDays(day, 1) : day, end, timezone);
    range = { startIso, endIso, minutes: Math.round((Date.parse(endIso) - Date.parse(startIso)) / 60_000) };
  }
  const cat = categoryId || tasks.find((t) => t.id === (taskId || defaultTaskId))?.category_id || null;
  const extra = { title: title.trim() || null, category_id: cat, quality, outcome: outcome || null };
  const reset = (msg: string) => {
    setManualMin("");
    setTitle("");
    setOutcome("");
    setQuality(null);
    setStart("");
    setEnd("");
    setDone(msg);
  };

  return (
    <Card id="registro" className="scroll-mt-24">
      <CardTitle
        action={
          <div className="flex rounded-xl border border-border p-0.5 text-xs" role="tablist">
            {(["quick", "range"] as const).map((m) => (
              <button
                key={m}
                type="button"
                role="tab"
                aria-selected={mode === m}
                onClick={() => {
                  setMode(m);
                  if (m === "range" && !start) fillNow();
                }}
                className={cn("rounded-lg px-2.5 py-1", mode === m ? "bg-accent-soft font-medium text-accent" : "text-muted")}
              >
                {m === "quick" ? "Rápido" : "Con horario"}
              </button>
            ))}
          </div>
        }
      >
        Registrar tiempo manual
      </CardTitle>
      <p className="mb-3 text-xs text-muted">
        ¿Trabajaste sin temporizador? Añádelo para que tus horas sean reales. Las horas nunca se cuentan dos veces: en modo rápido el bloque se coloca justo antes de tus otras actividades; con horario, si se solapa, no se guarda.
      </p>
      {mode === "quick" ? (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => logManualTime({ minutes: Number(manualMin), task_id: defaultTaskId || null, ...(ready ? extra : { title: extra.title }) }), () =>
              reset("Registrado."),
            );
          }}
        >
          <Input type="number" min={1} max={720} placeholder="Minutos" value={manualMin} onChange={(e) => setManualMin(e.target.value)} aria-label="Minutos" />
          <Button type="submit" variant="secondary" disabled={!manualMin || pending}>
            Añadir
          </Button>
        </form>
      ) : (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            if (!range) return;
            run(
              () =>
                logManualTime({
                  started_at: range.startIso,
                  ended_at: range.endIso,
                  task_id: taskId || null,
                  ...(ready ? extra : { title: extra.title }),
                }),
              () => reset("Actividad registrada."),
            );
          }}
          data-testid="manual-range"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <Field label="Actividad" htmlFor="m-title" className="sm:col-span-2">
              <Input id="m-title" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="p. ej. Lectura: Sapiens" />
            </Field>
            <Field label="Categoría" htmlFor="m-cat">
              <Select id="m-cat" value={categoryId} onChange={(e) => setCategoryId(e.target.value)} disabled={!ready}>
                <option value="">{ready ? "Sin categoría" : "La de la tarea"}</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                    {c.counts ? "" : " (no cuenta)"}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tarea (opcional)" htmlFor="m-task">
              <Select id="m-task" value={taskId} onChange={(e) => setTaskId(e.target.value)}>
                <option value="">Ninguna</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Día" htmlFor="m-day">
              <Input id="m-day" type="date" value={day} max={today} onChange={(e) => setDay(e.target.value)} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              <Field label="Inicio" htmlFor="m-start">
                <Input id="m-start" type="time" value={start} onChange={(e) => setStart(e.target.value)} required />
              </Field>
              <Field label="Final" htmlFor="m-end">
                <Input id="m-end" type="time" value={end} onChange={(e) => setEnd(e.target.value)} required />
              </Field>
            </div>
          </div>
          {range && (
            <p className={cn("text-sm", range.minutes > 720 ? "text-danger" : "text-muted")}>
              Duración efectiva: <span className="font-semibold text-text tabular">{formatDuration(range.minutes * 60)}</span>
              {range.minutes > 720 && " · máximo 12 h por actividad"}
            </p>
          )}
          {ready && (
            <>
              <QualityPicker value={quality} onChange={setQuality} />
              <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={2000} placeholder="Notas y resultados (opcional)" aria-label="Notas y resultados" className="min-h-16" />
            </>
          )}
          <Button type="submit" variant="secondary" disabled={!range || range.minutes < 1 || range.minutes > 720 || pending}>
            Registrar actividad
          </Button>
        </form>
      )}
      {done && !error && <p className="mt-2 text-sm text-success">{done}</p>}
      {error && <p className="mt-2 text-sm text-danger" role="alert">{error}</p>}
    </Card>
  );
}

function HistoryCard({
  history,
  timezone,
  categories,
  ready,
}: {
  history: HistoryItem[];
  timezone: string;
  categories: Map<string, CategoryInfo>;
  ready: boolean;
}) {
  const { run } = useAction();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const groups = new Map<string, HistoryItem[]>();
  for (const h of history) {
    const d = localDate(new Date(h.started_at), timezone);
    groups.set(d, [...(groups.get(d) ?? []), h]);
  }
  const timeFmt = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  return (
    <Card>
      <CardTitle>Historial (7 días)</CardTitle>
      {history.length === 0 ? (
        <EmptyState title="Sin sesiones todavía">Tu primera sesión aparecerá aquí.</EmptyState>
      ) : (
        <div className="-mr-2 space-y-4 pr-2 lg:max-h-[calc(100dvh-10rem)] lg:overflow-y-auto">
          {[...groups].map(([day, items]) => (
            <div key={day}>
              <p className="sticky top-0 z-10 mb-1 rounded-lg bg-card py-0.5 text-xs font-medium text-muted backdrop-blur-xl">
                {formatLongDate(day)} · {formatDuration(items.filter((i) => i.status === "completed" && i.kind !== "break").reduce((a, i) => a + (i.focus_seconds ?? 0), 0))} registradas
              </p>
              <ul className="space-y-1">
                {items.map((h) => {
                  const cat = h.category_id ? categories.get(h.category_id) : undefined;
                  const q = h.quality as Quality | null;
                  return (
                  <li key={h.id} className={cn("group rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2", h.status === "abandoned" && "opacity-50")}>
                    <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="flex items-center gap-1.5 truncate">
                        {cat && <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: cat.color }} aria-hidden />}
                        <span className="truncate">{h.title ?? h.task_title ?? KIND_LABEL[h.kind]}</span>
                      </p>
                      <p className="text-xs text-muted">
                        {timeFmt.format(new Date(h.started_at))}
                        {h.ended_at && `–${timeFmt.format(new Date(h.ended_at))}`} · {cat ? cat.name : KIND_LABEL[h.kind]}
                        {cat && !cat.counts && " (no cuenta)"}
                        {h.interruptions > 0 && ` · ${h.interruptions} interr.`}
                        {h.status === "abandoned" && " · descartada"}
                      </p>
                      {q && (
                        <span className={cn("mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium", q === 1 ? "bg-warning-soft text-warning" : "bg-accent-soft text-accent")}>
                          {QUALITY_LABEL[q]}
                          {q === 1 && " · no suma"}
                        </span>
                      )}
                      {h.outcome && <p className="mt-0.5 line-clamp-2 text-xs text-muted">{h.outcome}</p>}
                    </div>
                    <span className="flex items-center gap-1">
                      <span className="tabular text-xs">{formatDuration(h.focus_seconds ?? 0)}</span>
                      {ready && h.status === "completed" && h.kind !== "break" && (
                        <button
                          type="button"
                          onClick={() => setReviewing(reviewing === h.id ? null : h.id)}
                          className="rounded p-1 text-xs text-muted hover:text-accent [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus:opacity-100"
                          aria-label="Evaluar actividad"
                        >
                          <Star size={13} />
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => confirm("¿Eliminar esta sesión del historial?") && run(() => deleteSession(h.id))}
                        className="rounded p-1 text-muted hover:text-danger [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus:opacity-100"
                        aria-label="Eliminar sesión"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                    </div>
                    {reviewing === h.id && (
                      <div className="mt-2">
                        <ReviewForm sessionId={h.id} initialQuality={q} initialOutcome={h.outcome ?? ""} onDone={() => setReviewing(null)} />
                      </div>
                    )}
                  </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
