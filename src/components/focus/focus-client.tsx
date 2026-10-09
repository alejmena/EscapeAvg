"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { Coffee, Flag, Maximize2, Minimize2, Minus, Pause, Play, Plus, Rocket, Square, Trash2, X, Zap } from "lucide-react";
import { cn } from "@/lib/cn";
import { suggestBreakdown } from "@/lib/domain/breakdown";
import { localDate } from "@/lib/domain/dates";
import { formatDuration } from "@/lib/domain/stats";
import { breakAfter, elapsedSeconds, formatClock, remainingSeconds, type PomodoroSettings, type SessionKind } from "@/lib/domain/timer";
import { formatLongDate } from "@/lib/format";
import type { FocusSession, Task } from "@/lib/types";
import {
  deleteSession,
  extendSession,
  logInterruption,
  logManualTime,
  setSessionTask,
  startSession,
  updateSessionStatus,
} from "@/app/(app)/focus/actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, ProgressRing } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
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
};

type TaskOption = Pick<Task, "id" | "title" | "parent_id" | "estimated_minutes" | "actual_seconds">;

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
}: {
  active: FocusSession | null;
  tasks: TaskOption[];
  history: HistoryItem[];
  settings: PomodoroSettings;
  timezone: string;
  today: string;
  initialTaskId: string | null;
  initialJust: number | null;
}) {
  const [session, setSession] = useState<FocusSession | null>(active);
  const [mode, setMode] = useState<"pomodoro" | "stopwatch">("pomodoro");
  const [minutes, setMinutes] = useState(settings.focus_minutes);
  const [taskId, setTaskId] = useState<string>(initialTaskId ?? active?.task_id ?? "");
  const [zen, setZen] = useState(false);
  const [summary, setSummary] = useState<{ seconds: number; kind: SessionKind; taskTitle: string | null } | null>(null);
  const [suggestBreak, setSuggestBreak] = useState<{ minutes: number; long: boolean } | null>(null);
  const [interruptions, setInterruptions] = useState(0);
  const [manualMin, setManualMin] = useState("");
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
            setSummary({ seconds: row.focus_seconds ?? 0, kind, taskTitle });
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
    run(
      () => startSession({ kind: kind as "pomodoro" | "stopwatch" | "just_start" | "break", task_id: kind === "break" ? null : tId, planned_seconds: plannedSeconds }),
      (row) => row && setSession(row),
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
        <p className="text-sm uppercase tracking-widest text-muted">{isBreak ? "Descanso" : (taskTitle ?? "Concentración")}</p>
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
              <ProgressRing value={session.planned_seconds ? progress : 1} size={240} stroke={8} color={isBreak ? "var(--success)" : undefined}>
                <div>
                  <p className={cn("tabular text-5xl font-light tracking-tight", session.status === "paused" && "opacity-50")}>{formatClock(clock)}</p>
                  {session.planned_seconds && <p className="mt-1 text-xs text-muted">{formatDuration(elapsed)} concentrado</p>}
                </div>
              </ProgressRing>
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
            </>
          ) : (
            <>
              {summary && (
                <div className="animate-in w-full max-w-md rounded-2xl bg-success-soft p-4 text-success">
                  <p className="font-semibold">Sesión completada: {formatDuration(summary.seconds)}</p>
                  <p className="text-sm opacity-80">{summary.taskTitle ? `en "${summary.taskTitle}". ` : ""}Cada sesión suma.</p>
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

              <div className="flex items-center gap-4">
                {mode === "pomodoro" && (
                  <button type="button" onClick={() => setMinutes(Math.max(5, minutes - 5))} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Menos 5 minutos">
                    <Minus size={18} />
                  </button>
                )}
                <p className="tabular text-6xl font-light tracking-tight sm:text-7xl">{mode === "pomodoro" ? formatClock(minutes * 60) : "00:00"}</p>
                {mode === "pomodoro" && (
                  <button type="button" onClick={() => setMinutes(Math.min(180, minutes + 5))} className="rounded-full p-2 text-muted hover:bg-surface-2" aria-label="Más 5 minutos">
                    <Plus size={18} />
                  </button>
                )}
              </div>

              <Select value={taskId} onChange={(e) => setTaskId(e.target.value)} className="max-w-xs" aria-label="Tarea">
                <option value="">¿En qué vas a trabajar? (opcional)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.parent_id ? "↳ " : ""}
                    {t.title}
                  </option>
                ))}
              </Select>

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
      </div>

      <aside className="space-y-6">
        <Card>
          <CardTitle>Registrar tiempo manual</CardTitle>
          <p className="mb-3 text-xs text-muted">¿Trabajaste sin temporizador? Añádelo para que tus estadísticas sean reales.</p>
          <form
            className="flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              run(() => logManualTime({ minutes: Number(manualMin), task_id: taskId || null }), () => setManualMin(""));
            }}
          >
            <Input type="number" min={1} max={720} placeholder="Minutos" value={manualMin} onChange={(e) => setManualMin(e.target.value)} aria-label="Minutos" />
            <Button type="submit" variant="secondary" disabled={!manualMin || pending}>
              Añadir
            </Button>
          </form>
        </Card>
        <HistoryCard history={history} timezone={timezone} />
      </aside>
    </div>
  );
}

function HistoryCard({ history, timezone }: { history: HistoryItem[]; timezone: string }) {
  const { run } = useAction();
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
        <div className="space-y-4">
          {[...groups].map(([day, items]) => (
            <div key={day}>
              <p className="mb-1 text-xs font-medium text-muted">
                {formatLongDate(day)} · {formatDuration(items.filter((i) => i.status === "completed" && i.kind !== "break").reduce((a, i) => a + (i.focus_seconds ?? 0), 0))}
              </p>
              <ul className="space-y-1">
                {items.map((h) => (
                  <li key={h.id} className={cn("group flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-sm hover:bg-surface-2", h.status === "abandoned" && "opacity-50")}>
                    <div className="min-w-0">
                      <p className="truncate">{h.task_title ?? KIND_LABEL[h.kind]}</p>
                      <p className="text-xs text-muted">
                        {timeFmt.format(new Date(h.started_at))} · {KIND_LABEL[h.kind]}
                        {h.interruptions > 0 && ` · ${h.interruptions} interr.`}
                        {h.status === "abandoned" && " · descartada"}
                      </p>
                    </div>
                    <span className="flex items-center gap-1">
                      <span className="tabular text-xs">{formatDuration(h.focus_seconds ?? 0)}</span>
                      <button
                        type="button"
                        onClick={() => confirm("¿Eliminar esta sesión del historial?") && run(() => deleteSession(h.id))}
                        className="rounded p-1 text-muted opacity-0 hover:text-danger group-hover:opacity-100 focus:opacity-100"
                        aria-label="Eliminar sesión"
                      >
                        <Trash2 size={13} />
                      </button>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
