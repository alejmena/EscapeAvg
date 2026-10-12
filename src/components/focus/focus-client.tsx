"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  Check,
  ChevronDown,
  Clock3,
  Coffee,
  Flag,
  History,
  Hourglass,
  Info,
  Infinity as InfinityIcon,
  Maximize2,
  Minimize2,
  Minus,
  Pause,
  PenLine,
  Play,
  Plus,
  Quote as QuoteIcon,
  Rocket,
  Sparkles,
  Square,
  Star,
  Timer,
  Trash2,
  TrendingUp,
  Watch,
  X,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { suggestBreakdown } from "@/lib/domain/breakdown";
import { addDays, eachDay, localDate, weekday, zonedParts, zonedTimeToISO } from "@/lib/domain/dates";
import { type CategoryInfo, QUALITY_HINT, QUALITY_LABEL, type Quality } from "@/lib/domain/discipline";
import type { Quote } from "@/lib/domain/quotes";
import { formatDuration } from "@/lib/domain/stats";
import { breakAfter, elapsedSeconds, formatClock, remainingSeconds, type PomodoroSettings, type SessionKind } from "@/lib/domain/timer";
import { formatLongDate, WEEKDAY_SHORT } from "@/lib/format";
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
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { Field, Input, Select, Textarea } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";
import { askNotificationPermission, chime, notify } from "./alerts";
import { burst } from "@/components/fx/burst";
import { useClientNow, useNow } from "./use-ticker";

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

const KIND_ICON: Record<SessionKind, LucideIcon> = {
  pomodoro: Timer,
  stopwatch: Watch,
  just_start: Rocket,
  manual: PenLine,
  break: Coffee,
};

// Duraciones rápidas del pomodoro (la de tus ajustes siempre aparece).
const PRESETS = [15, 25, 45, 60, 90];
function presetsFor(focusMinutes: number): number[] {
  if (PRESETS.includes(focusMinutes)) return PRESETS;
  const nearest = PRESETS.reduce((a, b) => (Math.abs(b - focusMinutes) < Math.abs(a - focusMinutes) ? b : a));
  return [...PRESETS.filter((p) => p !== nearest), focusMinutes].sort((a, b) => a - b);
}

// Botones grandes y táctiles para el temporizador.
const BIG = "h-14! px-7! text-base! min-w-40";

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
  const clientNow = useClientNow();
  const elapsed = session ? elapsedSeconds(session, now) : 0;
  const remaining = session ? remainingSeconds(session, now) : null;
  // "Just Start" alcanzó su objetivo: se ofrece seguir (al ampliar, planned_seconds cambia y esto vuelve a false).
  const justReached = session?.kind === "just_start" && session.status === "running" && remaining === 0;
  const taskTitle = useMemo(() => tasks.find((t) => t.id === (session?.task_id ?? taskId))?.title ?? null, [tasks, session, taskId]);
  const activityName = session?.title ?? taskTitle;
  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);
  const timeFmt = useMemo(() => new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", timeZone: timezone }), [timezone]);

  const todayItems = history.filter((h) => localDate(new Date(h.started_at), timezone) === today);
  const pomodorosToday = todayItems.filter((h) => h.kind === "pomodoro" && h.status === "completed").length;
  const todaySeconds = todayItems.filter((h) => h.status === "completed" && h.kind !== "break").reduce((a, h) => a + (h.focus_seconds ?? 0), 0);

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
    // El fondo no se desplaza mientras dura el modo sin distracciones.
    const root = document.documentElement;
    const prev = root.style.overflow;
    root.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      root.style.overflow = prev;
    };
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

  // Atajo: la barra espaciadora pausa o continúa (si no estás escribiendo ni sobre un botón).
  const toggleRef = useRef(toggle);
  useEffect(() => {
    toggleRef.current = toggle;
  });
  const hasSession = !!session;
  useEffect(() => {
    if (!hasSession) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || e.repeat || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t?.closest("input, textarea, select, button, a, [contenteditable='true']")) return;
      e.preventDefault();
      toggleRef.current();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [hasSession]);

  const interrupt = (kind: "internal" | "external") => {
    if (!session) return;
    run(() => logInterruption({ session_id: session.id, kind }), (n) => setInterruptions(n ?? interruptions + 1));
  };

  const breakdown = taskTitle ? suggestBreakdown(taskTitle) : null;

  // ---------- Esfera del temporizador ----------
  const running = session?.status === "running";
  const paused = session?.status === "paused";
  const isBreak = session?.kind === "break";
  const clock = session ? (remaining ?? elapsed) : mode === "pomodoro" ? minutes * 60 : 0;
  // Una vuelta = una hora; el color es el tiempo que queda (o el que llevas, en el cronómetro).
  const dialValue = session ? (remaining != null ? remaining / 3600 : (elapsed % 3600) / 3600) : mode === "pomodoro" ? minutes / 60 : 0;
  const lastMinute = !!session && remaining != null && remaining > 0 && remaining <= 60 && running;
  const eta =
    clientNow == null
      ? null
      : session
        ? remaining != null && running
          ? timeFmt.format(new Date(now + remaining * 1000))
          : null
        : mode === "pomodoro"
          ? timeFmt.format(new Date(clientNow + minutes * 60_000))
          : null;
  const clockText = formatClock(clock);

  const controls = session && (
    <div className="flex w-full max-w-md flex-wrap items-center justify-center gap-3">
      <Button size="lg" onClick={toggle} disabled={pending} variant={running ? "secondary" : "tone"} className={cn(BIG, "flex-1")}>
        {running ? <Pause size={18} className="fill-current" /> : <Play size={18} className="fill-current" />}
        {running ? "Pausar" : "Continuar"}
      </Button>
      <Button size="lg" variant="success" onClick={() => finish("completed")} disabled={pending} className={cn(BIG, "flex-1")}>
        <Square size={16} className="fill-current" /> Finalizar
      </Button>
    </div>
  );

  const statusPill = session && (
    <div className="inline-flex flex-wrap items-center justify-center gap-x-2 gap-y-1 rounded-full border border-border bg-surface/70 px-3.5 py-1.5 text-[13px] font-medium shadow-[0_1px_2px_rgb(21_19_43/0.05)] backdrop-blur">
      {paused ? <span className="h-2 w-2 rounded-full bg-warning" aria-hidden /> : <span className="live-dot" aria-hidden />}
      <span className={paused ? "text-warning" : "text-tone-ink"}>{paused ? "En pausa" : isBreak ? "Recargando" : "Concentrado"}</span>
      {!isBreak && (
        <>
          <span className="text-faint" aria-hidden>
            ·
          </span>
          <span className="text-muted">{KIND_LABEL[session.kind]}</span>
        </>
      )}
      {eta && <span className="text-muted">· hasta las {eta}</span>}
    </div>
  );

  const dialFace = (big: boolean) => (
    <>
      <p
        className={cn(
          "num-xl font-semibold transition-opacity",
          clockText.length > 5 ? (big ? "text-[clamp(44px,12vw,76px)]" : "text-[44px] sm:text-[52px]") : big ? "text-[clamp(60px,17vw,104px)]" : "text-[60px] sm:text-[72px]",
          paused && "opacity-45",
          lastMinute && "text-tone-gradient",
        )}
        aria-live="off"
      >
        {clockText}
      </p>
      <p className="mt-2 text-xs font-medium text-muted">
        {session
          ? paused
            ? "En pausa"
            : session.planned_seconds
              ? `${formatDuration(elapsed)} concentrado`
              : "Sin límite"
          : mode === "pomodoro"
            ? eta
              ? `Terminas a las ${eta}`
              : "Listo cuando tú"
            : "Cuenta hacia arriba"}
      </p>
    </>
  );

  if (session && zen) {
    // Portal: así el modo zen cubre toda la pantalla (el <main> animado no lo recorta).
    return createPortal(
      <div className="dark fixed inset-0 z-[60] overflow-y-auto bg-bg text-text">
        <div data-tone={isBreak ? "teal" : "coral"} className="relative isolate flex min-h-full flex-col items-center justify-center gap-7 px-6 py-20 text-center">
          {/* Resplandor del tono: vivo mientras corre el reloj. */}
          <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden" aria-hidden>
            <div
              className={cn(
                "absolute left-1/2 top-1/2 h-[80vmin] w-[80vmin] -translate-x-1/2 -translate-y-1/2 rounded-full bg-tone opacity-30 blur-[110px] transition-opacity duration-700",
                running ? "animate-glow motion-reduce:animate-none" : "opacity-10",
              )}
            />
            <div className="absolute -right-[12vmin] -top-[14vmin] h-[60vmin] w-[60vmin] rounded-full bg-tone-2 opacity-[0.18] blur-[110px]" />
            <div className="absolute -bottom-[18vmin] -left-[12vmin] h-[60vmin] w-[60vmin] rounded-full bg-tone opacity-[0.14] blur-[110px]" />
            <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(55%_55%_at_50%_50%,#000,transparent)]" />
          </div>
          <button
            type="button"
            onClick={() => setZen(false)}
            className="press absolute right-5 top-5 grid h-11 w-11 place-items-center rounded-full border border-border bg-surface/60 text-muted backdrop-blur hover:bg-surface-2 hover:text-text"
            aria-label="Salir del modo sin distracciones"
          >
            <Minimize2 size={19} />
          </button>
          {statusPill}
          <p className="max-w-xl truncate text-sm font-semibold uppercase tracking-[0.28em] text-muted">{isBreak ? "Descanso" : (activityName ?? "Concentración")}</p>
          <Dial value={dialValue} running={running} paused={paused} className="w-[min(80vw,440px)]">
            {dialFace(true)}
          </Dial>
          {controls}
          {!isBreak && (
            <button type="button" onClick={() => interrupt("internal")} className="press inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-muted hover:bg-surface-2 hover:text-text">
              <Flag size={13} /> Registrar interrupción {interruptions > 0 && `(${interruptions})`}
            </button>
          )}
          <p className="absolute inset-x-0 bottom-5 hidden text-[11px] text-faint sm:block">
            <kbd className="rounded-md border border-border px-1.5 py-0.5 font-sans">Espacio</kbd> pausar ·{" "}
            <kbd className="rounded-md border border-border px-1.5 py-0.5 font-sans">Esc</kbd> salir
          </p>
        </div>
      </div>,
      document.body,
    );
  }

  const presets = presetsFor(settings.focus_minutes);
  const cycleSize = settings.sessions_before_long_break;
  const cycleDone = pomodorosToday === 0 ? 0 : pomodorosToday % cycleSize || cycleSize;
  const nextBreak = breakAfter(settings, pomodorosToday + 1);

  return (
    <div className="stagger">
      <PageHeader title="Concentración" subtitle="Un bloque, una tarea. Elige qué vas a hacer, pulsa empezar y deja el resto fuera." />
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="min-w-0 space-y-6">
          <Card tone={isBreak ? "teal" : undefined} className="overflow-clip px-4 py-7 sm:px-8 sm:py-9">
            {/* Escenario: halo del tono y rejilla de puntos. */}
            <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
              <div className="absolute left-1/2 top-24 h-80 w-80 -translate-x-1/2 rounded-full bg-tone opacity-[0.13] blur-3xl" />
              <div className="absolute -right-24 -top-24 h-64 w-64 rounded-full bg-tone-2 opacity-[0.1] blur-3xl" />
              <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(55%_45%_at_50%_35%,#000,transparent)]" />
            </div>
            <div className="relative flex flex-col items-center gap-6 text-center">
              {session ? (
                <>
                  {statusPill}
                  <Dial value={dialValue} running={running} paused={paused} className="w-[268px] sm:w-[312px]">
                    {dialFace(false)}
                  </Dial>
                  {!isBreak && activityName && <p className="-mt-1 max-w-sm truncate font-display text-xl font-semibold">{activityName}</p>}
                  {!isBreak && (
                    <div className={cn("grid w-full max-w-md gap-2", ready && "sm:grid-cols-2")}>
                      {ready && (
                        <Select
                          value={session.category_id ?? ""}
                          onChange={(e) => {
                            const v = e.target.value || null;
                            setSession({ ...session, category_id: v });
                            run(() => setSessionCategory(session.id, v));
                          }}
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
                      <Select
                        value={session.task_id ?? ""}
                        onChange={(e) => {
                          const v = e.target.value || null;
                          setSession({ ...session, task_id: v });
                          run(() => setSessionTask(session.id, v));
                        }}
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
                    </div>
                  )}

                  {justReached && session.kind === "just_start" ? (
                    <div className="animate-in relative w-full max-w-md overflow-clip rounded-[22px] border border-success/25 bg-success-soft p-5">
                      <BurstOnMount colors={["var(--success)", "var(--tone)", "var(--tone-2)"]} className="left-1/2 top-8" />
                      <div className="relative flex flex-col items-center gap-3">
                        <span className="pop-in grid h-11 w-11 place-items-center rounded-2xl bg-success text-white shadow-[0_10px_24px_-10px_var(--success)] dark:text-bg">
                          <Sparkles size={20} />
                        </span>
                        <p className="font-display text-lg font-semibold text-success">¡Ya empezaste! Eso era lo difícil.</p>
                        <div className="flex flex-wrap justify-center gap-2">
                          <Button size="sm" variant="tone" onClick={() => run(() => extendSession(session.id, null), (row) => row && setSession(row))}>
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
                    </div>
                  ) : (
                    controls
                  )}

                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Button variant="secondary" size="sm" onClick={() => setZen(true)}>
                      <Maximize2 size={14} /> Sin distracciones
                    </Button>
                    {!isBreak && (
                      <>
                        <Button variant="secondary" size="sm" onClick={() => interrupt("internal")} title="Me distraje yo (móvil, redes, pensamientos)">
                          <Flag size={14} /> Me distraje
                        </Button>
                        <Button variant="secondary" size="sm" onClick={() => interrupt("external")} title="Me interrumpió alguien o algo">
                          <Flag size={14} /> Me interrumpieron
                        </Button>
                      </>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="hover:bg-danger-soft hover:text-danger"
                      onClick={() => {
                        if (confirm("¿Descartar esta sesión? No contará en tus estadísticas.")) finish("abandoned");
                      }}
                    >
                      <X size={14} /> Descartar
                    </Button>
                  </div>
                  {interruptions > 0 && (
                    <Badge variant="warning" className="pop-in px-3 py-1 text-xs">
                      {interruptions} interrupciones registradas
                    </Badge>
                  )}
                  {!isBreak && (
                    <figure className="relative mt-3 w-full max-w-md rounded-[22px] border border-border bg-surface/60 px-5 pb-4 pt-6 text-center" data-testid="session-quote">
                      <span className="tone-chip absolute -top-4 left-1/2 h-8 w-8 -translate-x-1/2 rounded-full" aria-hidden>
                        <QuoteIcon size={14} className="fill-current" />
                      </span>
                      <blockquote className="font-display text-xl font-medium leading-snug" lang={startQuote.origin === "china" ? "zh" : "ru"}>
                        {startQuote.text}
                      </blockquote>
                      <figcaption className="mt-1.5 text-xs text-muted">
                        «{startQuote.translation}» · {startQuote.source}
                      </figcaption>
                    </figure>
                  )}
                </>
              ) : (
                <>
                  {summary && (
                    <div className="animate-in w-full max-w-md space-y-3 text-left">
                      <div className="relative overflow-clip rounded-[22px] border border-success/25 bg-success-soft px-4 py-5 text-center">
                        <BurstOnMount colors={["var(--success)", "var(--tone)", "var(--tone-2)", "var(--gold)"]} className="left-1/2 top-11" />
                        <span className="pop-in relative mx-auto mb-3 grid h-12 w-12 place-items-center rounded-2xl bg-success text-white shadow-[0_12px_26px_-10px_var(--success)] dark:text-bg">
                          <Check size={24} strokeWidth={3} />
                        </span>
                        <p className="relative font-display text-lg font-semibold text-success">Sesión completada: {formatDuration(summary.seconds)}</p>
                        <p className="relative mt-0.5 text-sm text-success/80">{summary.taskTitle ? `"${summary.taskTitle}". ` : ""}Ya cuenta en tu nivel de hoy.</p>
                      </div>
                      {ready && <ReviewForm sessionId={summary.id} onDone={() => setSummary(null)} />}
                    </div>
                  )}
                  {suggestBreak && (
                    <div data-tone="teal" className="card-tint animate-in w-full max-w-md rounded-[22px] p-4 text-left">
                      <div className="flex items-center gap-3">
                        <span className="tone-chip h-11 w-11 rounded-2xl">
                          <Coffee size={19} />
                        </span>
                        <div className="min-w-0">
                          <p className="font-semibold">Toca recargar</p>
                          <p className="text-xs text-muted">Levántate, bebe agua y mira lejos de la pantalla.</p>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        <Button variant="tone" size="sm" className="flex-1" onClick={() => start("break", suggestBreak.minutes * 60)} disabled={pending}>
                          <Coffee size={14} /> Descanso {suggestBreak.long ? "largo" : "corto"} ({suggestBreak.minutes} min)
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setSuggestBreak(null)}>
                          Saltar descanso
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="seg" role="tablist" aria-label="Tipo de temporizador">
                    {(["pomodoro", "stopwatch"] as const).map((m) => (
                      <button
                        key={m}
                        type="button"
                        role="tab"
                        aria-selected={mode === m}
                        onClick={() => setMode(m)}
                        className="h-9! px-4! aria-selected:[&_svg]:text-tone"
                      >
                        {m === "pomodoro" ? <Timer size={15} aria-hidden /> : <Watch size={15} aria-hidden />}
                        {m === "pomodoro" ? "Pomodoro" : "Cronómetro"}
                      </button>
                    ))}
                  </div>

                  <Dial value={dialValue} className="w-[264px] sm:w-[312px]">
                    {dialFace(false)}
                  </Dial>

                  {mode === "pomodoro" ? (
                    <div className="-mt-1 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setMinutes(Math.max(5, minutes - 5))}
                        className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface/80 text-muted hover:border-border-strong hover:text-text"
                        aria-label="Menos 5 minutos"
                      >
                        <Minus size={17} />
                      </button>
                      <div className="seg" role="group" aria-label="Duración en minutos">
                        {presets.map((p) => (
                          <button key={p} type="button" aria-pressed={minutes === p} onClick={() => setMinutes(p)} className="tabular px-2.5! sm:px-3.5!">
                            {p}
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => setMinutes(Math.min(180, minutes + 5))}
                        className="press grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-surface/80 text-muted hover:border-border-strong hover:text-text"
                        aria-label="Más 5 minutos"
                      >
                        <Plus size={17} />
                      </button>
                    </div>
                  ) : (
                    <p className="-mt-1 inline-flex h-10 items-center gap-2 rounded-full bg-surface-2/70 px-4 text-sm text-muted">
                      <InfinityIcon size={16} className="text-tone" aria-hidden /> Sin límite: para cuando quieras.
                    </p>
                  )}

                  <div className="grid w-full max-w-md gap-2 sm:grid-cols-2">
                    <Input
                      value={title}
                      maxLength={120}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="¿Qué vas a hacer? (p. ej. Inglés B2)"
                      aria-label="Nombre de la actividad"
                      className="h-12 text-[15px] sm:col-span-2"
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

                  <Button size="lg" variant="tone" className={cn(BIG, "w-full max-w-md")} onClick={() => start(mode, mode === "pomodoro" ? minutes * 60 : null)} disabled={pending}>
                    <Play size={18} className="fill-current" /> Empezar a concentrarme
                  </Button>
                </>
              )}
              {error && <p className="text-sm text-danger">{error}</p>}

              <TodayStrip seconds={todaySeconds} pomodoros={pomodorosToday} cycleDone={cycleDone} cycleSize={cycleSize} nextBreak={nextBreak} />
            </div>
          </Card>

          {!session && (
            <Card
              variant="feature"
              className={cn("overflow-clip", initialJust != null && "outline-4 outline-offset-4 outline-[color-mix(in_srgb,var(--tone)_40%,transparent)]")}
            >
              <Zap className="pointer-events-none absolute -right-8 -top-10 h-48 w-48 rotate-12 text-white/10" strokeWidth={1.5} aria-hidden />
              <div className="relative flex flex-wrap items-center justify-between gap-5">
                <div className="flex min-w-0 flex-1 items-start gap-4">
                  <span className="grid h-12 w-12 shrink-0 place-items-center rounded-[16px] bg-white/20 shadow-[0_1px_0_rgb(255_255_255/0.4)_inset] ring-1 ring-white/30">
                    <Rocket size={22} />
                  </span>
                  <div className="min-w-0">
                    <p className="eyebrow">Truco anti-procrastinación</p>
                    <h2 className="mt-0.5 font-display text-2xl font-bold leading-tight">Just Start</h2>
                    <p className="mt-1 max-w-md text-sm text-muted">¿Sin ganas? No hace falta motivación, solo 2 minutos. Si quieres parar después, para.</p>
                  </div>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  {[2, 5].map((m) => {
                    const hot = (initialJust ?? 2) === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => start("just_start", m * 60)}
                        disabled={pending}
                        className={cn(
                          "press inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-full px-6 text-[15px] font-semibold disabled:pointer-events-none disabled:opacity-50 sm:flex-none",
                          hot
                            ? "shine bg-white text-[color-mix(in_srgb,var(--tone)_75%,#000)] shadow-[0_10px_24px_-10px_rgb(0_0_0/0.35)] hover:bg-white/95"
                            : "bg-white/15 text-white ring-1 ring-inset ring-white/35 hover:bg-white/25",
                        )}
                      >
                        <Zap size={16} className="fill-current" /> {m} min
                      </button>
                    );
                  })}
                </div>
              </div>
              {breakdown && (
                <div className="relative mt-5 rounded-2xl bg-white/15 p-4 text-sm ring-1 ring-inset ring-white/20">
                  <p className="text-muted">
                    Primer paso para <span className="font-semibold text-text">&quot;{taskTitle}&quot;</span>:
                  </p>
                  <p className="mt-1 font-display text-base font-semibold">{breakdown.firstStep}</p>
                  <Link href="/tasks?view=all" className="group mt-2 inline-flex items-center gap-1 text-xs font-semibold text-white/90 hover:text-white">
                    Dividir la tarea en pasos <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </div>
              )}
            </Card>
          )}

          <ManualEntry tasks={tasks} categories={categories} ready={ready} timezone={timezone} today={today} defaultTaskId={taskId} />
        </div>

        <aside className="min-w-0 lg:sticky lg:top-8 lg:self-start">
          <HistoryCard history={history} timezone={timezone} today={today} categories={catById} ready={ready} />
        </aside>
      </div>
    </div>
  );
}

/**
 * Esfera del temporizador. Una vuelta completa es una hora (como un "Time Timer"): la parte de color es
 * el tiempo que queda; las marcas son minutos. Brilla con el tono de la sección.
 */
function Dial({
  value,
  running = false,
  paused = false,
  className,
  children,
}: {
  value: number;
  running?: boolean;
  paused?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  const gid = `dial${useId().replace(/:/g, "")}`;
  const v = Math.max(0, Math.min(1, value));
  const C = 160;
  const R = 140;
  const circ = 2 * Math.PI * R;
  // Mientras corre, el arco avanza segundo a segundo de forma continua; al cambiar la duración, con suavidad.
  const ease = running ? "1s linear" : "600ms cubic-bezier(0.22, 1, 0.36, 1)";
  // Redondeo: Node y el navegador difieren en el último decimal de sin/cos y eso rompería la hidratación.
  const at = (r: number, a: number, f: (x: number) => number) => Math.round((C + r * f(a)) * 100) / 100;
  return (
    <div className={cn("relative grid aspect-square shrink-0 place-items-center", className)}>
      <div
        className={cn(
          "pointer-events-none absolute inset-[14%] rounded-full bg-tone blur-3xl transition-opacity duration-700",
          paused ? "opacity-10" : "opacity-30",
          running && "animate-glow motion-reduce:animate-none",
        )}
        aria-hidden
      />
      <svg viewBox="0 0 320 320" className={cn("absolute inset-0 h-full w-full overflow-visible transition-[filter] duration-500", paused && "saturate-[0.35]")} aria-hidden>
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--tone-2)" />
            <stop offset="100%" stopColor="var(--tone)" />
          </linearGradient>
          <radialGradient id={`${gid}-face`} cx="50%" cy="35%" r="65%">
            <stop offset="0%" stopColor="var(--surface)" stopOpacity="0.95" />
            <stop offset="100%" stopColor="var(--surface)" stopOpacity="0.35" />
          </radialGradient>
        </defs>
        {/* Esfera */}
        <circle cx={C} cy={C} r={126} fill={`url(#${gid}-face)`} stroke="var(--border)" strokeOpacity={0.8} />
        {/* Marcas de minuto: encendidas las que cubre el tiempo */}
        {Array.from({ length: 60 }, (_, i) => {
          const a = (i / 60) * 2 * Math.PI;
          const long = i % 5 === 0;
          const r1 = long ? 106 : 110;
          const r2 = 117;
          const lit = i / 60 < v;
          return (
            <line
              key={i}
              x1={at(r1, a, Math.sin)}
              y1={at(-r1, a, Math.cos)}
              x2={at(r2, a, Math.sin)}
              y2={at(-r2, a, Math.cos)}
              stroke={lit ? "var(--tone)" : "var(--faint)"}
              strokeOpacity={lit ? 0.95 : 0.4}
              strokeWidth={long ? 2.6 : 1.4}
              strokeLinecap="round"
              style={{ transition: "stroke 400ms ease, stroke-opacity 400ms ease" }}
            />
          );
        })}
        {/* Pista */}
        <circle cx={C} cy={C} r={R} fill="none" stroke="var(--tone)" strokeOpacity={0.14} strokeWidth={14} />
        {/* Arco de tiempo */}
        <circle
          cx={C}
          cy={C}
          r={R}
          fill="none"
          stroke={`url(#${gid})`}
          strokeWidth={14}
          strokeLinecap="round"
          strokeDasharray={circ.toFixed(2)}
          strokeDashoffset={(circ * (1 - v)).toFixed(2)}
          transform={`rotate(-90 ${C} ${C})`}
          style={{ transition: `stroke-dashoffset ${ease}`, filter: "drop-shadow(0 0 9px var(--tone))" }}
        />
        {/* Tirador al final del arco */}
        <g style={{ transform: `rotate(${v * 360}deg)`, transformOrigin: `${C}px ${C}px`, transition: `transform ${ease}` }}>
          <circle cx={C} cy={C - R} r={10.5} fill="#fff" stroke="var(--tone)" strokeWidth={4} style={{ filter: "drop-shadow(0 0 7px var(--tone))" }} />
        </g>
      </svg>
      <div className="relative px-6 text-center">{children}</div>
    </div>
  );
}

/** Lanza una celebración al aparecer (chispas desde el centro del elemento). */
function BurstOnMount({ colors, className }: { colors: string[]; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const palette = colors.join("|");
  useEffect(() => {
    const t = setTimeout(() => burst(ref.current, palette.split("|"), { count: 18, spread: 64 }), 120);
    return () => clearTimeout(t);
  }, [palette]);
  return <span ref={ref} className={cn("pointer-events-none absolute h-0 w-0", className)} aria-hidden />;
}

/** Resumen del día bajo el temporizador: tiempo, pomodoros del ciclo y siguiente descanso. */
function TodayStrip({
  seconds,
  pomodoros,
  cycleDone,
  cycleSize,
  nextBreak,
}: {
  seconds: number;
  pomodoros: number;
  cycleDone: number;
  cycleSize: number;
  nextBreak: { minutes: number; long: boolean };
}) {
  return (
    <div className="mt-2 grid w-full max-w-lg grid-cols-3 divide-x divide-border rounded-[20px] border border-border bg-surface/55 py-3.5 backdrop-blur">
      <div className="min-w-0 px-2">
        <p className="text-[11px] font-medium text-muted">Hoy</p>
        <p className="num-xl mt-1.5 text-lg sm:text-xl">{formatDuration(seconds)}</p>
      </div>
      <div className="min-w-0 px-2">
        <p className="text-[11px] font-medium text-muted">Pomodoros</p>
        <p className="num-xl mt-1.5 text-lg sm:text-xl">{pomodoros}</p>
        <div className="mt-1.5 flex justify-center gap-1" title={`${cycleDone} de ${cycleSize} hasta el descanso largo`} aria-hidden>
          {Array.from({ length: Math.min(cycleSize, 8) }, (_, i) => (
            <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i < cycleDone ? "bg-tone shadow-[0_0_6px_var(--tone)]" : "bg-surface-3")} />
          ))}
        </div>
      </div>
      <div className="min-w-0 px-2">
        <p className="text-[11px] font-medium text-muted">Próx. pausa</p>
        <p className="num-xl mt-1.5 text-lg sm:text-xl">{nextBreak.minutes} min</p>
        <p className="mt-1 text-[10.5px] text-muted">{nextBreak.long ? "larga" : "corta"}</p>
      </div>
    </div>
  );
}

const QUALITY_ICON: Record<Quality, LucideIcon> = { 1: Hourglass, 2: TrendingUp, 3: Sparkles };

function QualityPicker({ value, onChange }: { value: Quality | null; onChange: (q: Quality | null) => void }) {
  return (
    <div className="grid grid-cols-3 gap-1.5" role="radiogroup" aria-label="Calidad de la actividad">
      {([1, 2, 3] as Quality[]).map((q) => {
        const Icon = QUALITY_ICON[q];
        const on = value === q;
        return (
          <button
            key={q}
            type="button"
            role="radio"
            aria-checked={on}
            title={QUALITY_HINT[q]}
            onClick={() => onChange(on ? null : q)}
            className={cn(
              "press flex flex-col items-center gap-1 rounded-2xl border px-2 py-2.5 text-xs font-semibold",
              on
                ? q === 1
                  ? "border-warning/40 bg-warning-soft text-warning"
                  : "border-tone/40 bg-tone-soft text-tone-ink shadow-[0_6px_16px_-10px_var(--tone)]"
                : "border-border bg-surface/50 text-muted hover:border-border-strong hover:text-text",
            )}
          >
            <Icon size={16} aria-hidden />
            {QUALITY_LABEL[q]}
          </button>
        );
      })}
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
      className="space-y-3 rounded-[22px] border border-border bg-surface/60 p-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(() => reviewSession(sessionId, { quality, outcome }), onDone);
      }}
      data-testid="review-form"
    >
      <p className="text-sm font-semibold">
        ¿Cómo fue? <span className="font-normal text-muted">(opcional)</span>
      </p>
      <QualityPicker value={quality} onChange={setQuality} />
      <p className="text-xs text-muted">{quality ? QUALITY_HINT[quality] : "Si no la evalúas, cuenta como productiva."}</p>
      <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={2000} placeholder="Notas y resultados: qué aprendiste o terminaste" aria-label="Notas y resultados" className="min-h-16" />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onDone}>
          Ahora no
        </Button>
        <Button type="submit" variant="tone" size="sm" disabled={pending}>
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
    <Card id="registro" className="scroll-mt-24" data-reveal>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-[min(100%,240px)] flex-1 items-center gap-3">
          <span className="tone-chip-soft h-10 w-10 rounded-2xl">
            <PenLine size={18} aria-hidden />
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-[17px] font-semibold leading-tight">Registrar tiempo manual</h2>
            <p className="mt-0.5 text-xs text-muted">¿Trabajaste sin temporizador? Añádelo para que tus horas sean reales.</p>
          </div>
        </div>
        <div className="seg shrink-0" role="tablist" aria-label="Modo de registro">
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
            >
              {m === "quick" ? <Zap size={13} aria-hidden /> : <Clock3 size={13} aria-hidden />}
              {m === "quick" ? "Rápido" : "Con horario"}
            </button>
          ))}
        </div>
      </div>
      <p className="mb-4 flex gap-2 rounded-2xl bg-surface-2/60 px-3 py-2.5 text-xs leading-relaxed text-muted">
        <Info size={14} className="mt-0.5 shrink-0 text-tone" aria-hidden />
        <span>
          Las horas nunca se cuentan dos veces: en modo rápido el bloque se coloca justo antes de tus otras actividades; con horario, si se solapa, no se
          guarda.
        </span>
      </p>
      {mode === "quick" ? (
        <form
          className="space-y-3"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => logManualTime({ minutes: Number(manualMin), task_id: defaultTaskId || null, ...(ready ? extra : { title: extra.title }) }), () =>
              reset("Registrado."),
            );
          }}
        >
          <div className="flex gap-2">
            <div className="relative min-w-0 flex-1">
              <Input
                type="number"
                min={1}
                max={720}
                placeholder="Minutos"
                value={manualMin}
                onChange={(e) => setManualMin(e.target.value)}
                aria-label="Minutos"
                className="h-12 pr-12 text-[15px] [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
              />
              <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm font-medium text-faint" aria-hidden>
                min
              </span>
            </div>
            <Button type="submit" variant="tone" size="lg" disabled={!manualMin || pending}>
              <Plus size={16} /> Añadir
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="mr-0.5 text-xs text-faint">Atajos</span>
            {[15, 30, 45, 60].map((m) => (
              <button
                key={m}
                type="button"
                aria-pressed={manualMin === String(m)}
                onClick={() => setManualMin(String(m))}
                className="press rounded-full border border-border bg-surface/60 px-3 py-1 text-xs font-medium text-muted hover:border-border-strong hover:text-text aria-pressed:border-tone/40 aria-pressed:bg-tone-soft aria-pressed:text-tone-ink"
              >
                {m < 60 ? `${m} min` : "1 h"}
              </button>
            ))}
          </div>
        </form>
      ) : (
        <form
          className="space-y-4"
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
            <p
              className={cn(
                "flex flex-wrap items-center gap-x-2 gap-y-0.5 rounded-2xl px-3 py-2.5 text-sm",
                range.minutes > 720 ? "bg-danger-soft text-danger" : "bg-tone-soft/60 text-muted",
              )}
            >
              <Clock3 size={15} className={range.minutes > 720 ? "" : "text-tone"} aria-hidden />
              Duración efectiva: <span className="font-display text-base font-semibold tabular text-text">{formatDuration(range.minutes * 60)}</span>
              {range.minutes > 720 && " · máximo 12 h por actividad"}
            </p>
          )}
          {ready && (
            <>
              <QualityPicker value={quality} onChange={setQuality} />
              <Textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} maxLength={2000} placeholder="Notas y resultados (opcional)" aria-label="Notas y resultados" className="min-h-16" />
            </>
          )}
          <Button type="submit" variant="tone" disabled={!range || range.minutes < 1 || range.minutes > 720 || pending}>
            <Check size={16} /> Registrar actividad
          </Button>
        </form>
      )}
      {done && !error && (
        <p className="pop-in mt-3 flex items-center gap-1.5 text-sm font-medium text-success">
          <Check size={15} strokeWidth={3} aria-hidden />
          {done}
        </p>
      )}
      {error && (
        <p className="mt-3 text-sm text-danger" role="alert">
          {error}
        </p>
      )}
    </Card>
  );
}

function HistoryCard({
  history,
  timezone,
  today,
  categories,
  ready,
}: {
  history: HistoryItem[];
  timezone: string;
  today: string;
  categories: Map<string, CategoryInfo>;
  ready: boolean;
}) {
  const { run } = useAction();
  const [reviewing, setReviewing] = useState<string | null>(null);
  const [showAll, setShowAll] = useState(false);
  const groups = new Map<string, HistoryItem[]>();
  for (const h of history) {
    const d = localDate(new Date(h.started_at), timezone);
    groups.set(d, [...(groups.get(d) ?? []), h]);
  }
  const counted = (items: HistoryItem[]) => items.filter((i) => i.status === "completed" && i.kind !== "break").reduce((a, i) => a + (i.focus_seconds ?? 0), 0);
  // Barras de los últimos 7 días (incluido hoy).
  const week = eachDay(addDays(today, -6), today).map((day) => ({ day, seconds: counted(groups.get(day) ?? []) }));
  const weekMax = Math.max(1, ...week.map((w) => w.seconds));
  const weekTotal = week.reduce((a, w) => a + w.seconds, 0);
  const longest = Math.max(1, ...history.map((h) => h.focus_seconds ?? 0));
  const timeFmt = new Intl.DateTimeFormat("es", { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  // Los días más recientes primero; el resto, a un clic (en móvil la lista completa sería larguísima).
  const SHOWN_DAYS = 3;
  const dayGroups = [...groups];
  const visibleGroups = showAll ? dayGroups : dayGroups.slice(0, SHOWN_DAYS);
  return (
    <Card>
      <CardTitle icon={<History />} subtitle={history.length ? `${formatDuration(weekTotal)} esta semana` : "Tus sesiones de la última semana"}>
        Historial (7 días)
      </CardTitle>
      {history.length === 0 ? (
        <EmptyState icon={<Timer />} title="Sin sesiones todavía">
          Tu primera sesión aparecerá aquí.
        </EmptyState>
      ) : (
        <>
          <div className="mb-5 rounded-[20px] border border-border bg-surface-2/40 px-3 pb-2 pt-3">
            <div className="flex h-24 items-end gap-1.5">
              {week.map(({ day, seconds }, i) => {
                const isToday = day === today;
                return (
                  <div key={day} className="group flex h-full flex-1 flex-col items-center gap-1.5" title={`${formatLongDate(day)}: ${formatDuration(seconds)}`}>
                    <div className="relative flex w-full flex-1 items-end justify-center">
                      <div
                        className={cn(
                          "grow-up w-full max-w-[22px] rounded-full transition-[filter] group-hover:brightness-110",
                          seconds ? "bg-gradient-to-t from-tone to-tone-2" : "bg-surface-3",
                          seconds > 0 && !isToday && "opacity-70",
                          isToday && seconds > 0 && "shadow-[0_0_14px_-2px_var(--tone)]",
                        )}
                        style={{ height: seconds ? `${Math.max(10, (seconds / weekMax) * 100)}%` : 4, animationDelay: `${i * 60}ms` }}
                      />
                    </div>
                    <span className={cn("text-[10.5px] font-semibold", isToday ? "text-tone-ink" : "text-faint")}>{WEEKDAY_SHORT[weekday(day)]}</span>
                  </div>
                );
              })}
            </div>
          </div>
          <div className="-mr-2 space-y-5 pr-2 lg:max-h-[calc(100dvh-20rem)] lg:overflow-y-auto">
            {visibleGroups.map(([day, items], gi) => (
              <section key={day} data-reveal={gi > 1 ? "" : undefined}>
                <div className="sticky top-0 z-10 mb-2 flex items-center justify-between gap-2 rounded-xl bg-[color-mix(in_srgb,var(--surface)_88%,transparent)] py-1 backdrop-blur-xl">
                  <p className="truncate text-xs font-semibold text-muted">{day === today ? "Hoy" : formatLongDate(day)}</p>
                  <Badge variant={day === today ? "solid" : "tone"}>{formatDuration(counted(items))}</Badge>
                </div>
                <ul className="relative space-y-1 before:absolute before:bottom-4 before:left-[13px] before:top-4 before:w-px before:bg-border">
                  {items.map((h) => {
                    const cat = h.category_id ? categories.get(h.category_id) : undefined;
                    const q = h.quality as Quality | null;
                    const Icon = KIND_ICON[h.kind];
                    const secs = h.focus_seconds ?? 0;
                    return (
                      <li key={h.id} className={cn("group relative pl-10", h.status === "abandoned" && "opacity-55")}>
                        <span
                          className={cn("absolute left-0 top-2.5 grid h-7 w-7 place-items-center rounded-full", cat ? "text-white shadow-[0_4px_10px_-4px_rgb(0_0_0/0.3)]" : "tone-chip-soft")}
                          style={cat ? { background: cat.color } : undefined}
                          aria-hidden
                        >
                          <Icon size={13} />
                        </span>
                        <div className="relative rounded-2xl px-2.5 py-2 transition-colors hover:bg-surface-2/60">
                          <div className="flex items-start justify-between gap-2">
                            <p className="min-w-0 truncate text-sm font-medium">{h.title ?? h.task_title ?? KIND_LABEL[h.kind]}</p>
                            <span className="flex shrink-0 items-center gap-0.5">
                              <span className="tabular text-sm font-semibold">{formatDuration(secs)}</span>
                              {/* Acciones: siempre visibles en táctil; con ratón aparecen sobre la duración al pasar por encima. */}
                              <span className="ml-1 flex items-center gap-0.5 [@media(hover:hover)]:absolute [@media(hover:hover)]:right-1.5 [@media(hover:hover)]:top-1.5 [@media(hover:hover)]:ml-0 [@media(hover:hover)]:rounded-full [@media(hover:hover)]:bg-surface [@media(hover:hover)]:p-0.5 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:shadow-[0_2px_8px_-2px_rgb(0_0_0/0.18),0_0_0_1px_var(--card-edge)] [@media(hover:hover)]:transition-opacity [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:focus-within:opacity-100">
                                {ready && h.status === "completed" && h.kind !== "break" && (
                                  <button
                                    type="button"
                                    onClick={() => setReviewing(reviewing === h.id ? null : h.id)}
                                    className="press rounded-full p-1.5 text-muted hover:bg-tone-soft hover:text-tone-ink"
                                    aria-label="Evaluar actividad"
                                  >
                                    <Star size={13} />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => confirm("¿Eliminar esta sesión del historial?") && run(() => deleteSession(h.id))}
                                  className="press rounded-full p-1.5 text-muted hover:bg-danger-soft hover:text-danger"
                                  aria-label="Eliminar sesión"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </span>
                            </span>
                          </div>
                          <p className="mt-0.5 truncate text-xs text-muted">
                            {timeFmt.format(new Date(h.started_at))}
                            {h.ended_at && `–${timeFmt.format(new Date(h.ended_at))}`} · {cat ? cat.name : KIND_LABEL[h.kind]}
                            {cat && !cat.counts && " (no cuenta)"}
                            {h.interruptions > 0 && ` · ${h.interruptions} interr.`}
                            {h.status === "abandoned" && " · descartada"}
                          </p>
                          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                            <div
                              className="bar-in h-full rounded-full"
                              style={{
                                width: `${Math.max(4, (secs / longest) * 100)}%`,
                                background: cat ? cat.color : "linear-gradient(90deg, var(--tone), var(--tone-2))",
                              }}
                            />
                          </div>
                          {q && (
                            <Badge variant={q === 1 ? "warning" : "tone"} className="mt-1.5">
                              {QUALITY_LABEL[q]}
                              {q === 1 && " · no suma"}
                            </Badge>
                          )}
                          {h.outcome && <p className="mt-1 line-clamp-2 text-xs text-muted">{h.outcome}</p>}
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
              </section>
            ))}
          </div>
          {dayGroups.length > SHOWN_DAYS && (
            <button
              type="button"
              onClick={() => setShowAll(!showAll)}
              aria-expanded={showAll}
              className="press mt-4 flex w-full items-center justify-center gap-1.5 rounded-full border border-border bg-surface/60 py-2 text-xs font-semibold text-muted hover:border-border-strong hover:text-text"
            >
              {showAll ? "Mostrar menos" : `Mostrar ${dayGroups.length - SHOWN_DAYS} días más`}
              <ChevronDown size={14} className={cn("transition-transform duration-300", showAll && "rotate-180")} aria-hidden />
            </button>
          )}
        </>
      )}
    </Card>
  );
}
