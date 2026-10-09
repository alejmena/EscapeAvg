export type SessionKind = "pomodoro" | "stopwatch" | "just_start" | "manual" | "break";
export type SessionStatus = "running" | "paused" | "completed" | "abandoned";

export type SessionClock = {
  status: SessionStatus;
  started_at: string;
  paused_at: string | null;
  paused_seconds: number;
  planned_seconds: number | null;
  focus_seconds?: number | null;
};

/**
 * Segundos efectivos transcurridos de una sesión, reconstruidos desde los timestamps del servidor.
 * Así el temporizador es idéntico en cualquier dispositivo y sobrevive a recargas.
 */
export function elapsedSeconds(s: SessionClock, now: number = Date.now()): number {
  if (s.status === "completed" || s.status === "abandoned") return s.focus_seconds ?? 0;
  const start = Date.parse(s.started_at);
  const end = s.status === "paused" && s.paused_at ? Date.parse(s.paused_at) : now;
  return Math.max(0, Math.floor((end - start) / 1000) - s.paused_seconds);
}

/** Segundos restantes (null para cronómetro libre). */
export function remainingSeconds(s: SessionClock, now: number = Date.now()): number | null {
  if (s.planned_seconds == null) return null;
  return Math.max(0, s.planned_seconds - elapsedSeconds(s, now));
}

export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = String(m).padStart(2, "0");
  const ss = String(sec).padStart(2, "0");
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export type PomodoroSettings = {
  focus_minutes: number;
  short_break_minutes: number;
  long_break_minutes: number;
  sessions_before_long_break: number;
};

export const DEFAULT_POMODORO: PomodoroSettings = {
  focus_minutes: 25,
  short_break_minutes: 5,
  long_break_minutes: 15,
  sessions_before_long_break: 4,
};

export function normalizePomodoro(raw: unknown): PomodoroSettings {
  const r = (raw && typeof raw === "object" ? raw : {}) as Partial<Record<keyof PomodoroSettings, unknown>>;
  const num = (v: unknown, def: number, min: number, max: number) => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.round(n))) : def;
  };
  return {
    focus_minutes: num(r.focus_minutes, 25, 1, 180),
    short_break_minutes: num(r.short_break_minutes, 5, 1, 60),
    long_break_minutes: num(r.long_break_minutes, 15, 1, 90),
    sessions_before_long_break: num(r.sessions_before_long_break, 4, 1, 12),
  };
}

/** Descanso recomendado tras completar `completedFocusToday` pomodoros. */
export function breakAfter(settings: PomodoroSettings, completedFocusToday: number): { minutes: number; long: boolean } {
  const long = completedFocusToday > 0 && completedFocusToday % settings.sessions_before_long_break === 0;
  return { minutes: long ? settings.long_break_minutes : settings.short_break_minutes, long };
}
