"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Crown, Flag, Info, Play, Plus } from "lucide-react";
import { cn } from "@/lib/cn";
import {
  dayMessage,
  goalLabel,
  hoursText,
  nextRank,
  rankFor,
  rankIndex,
  rankLabel,
  RANKS,
  SYMBOLIC_NOTE,
  type Rank,
} from "@/lib/domain/discipline";
import { formatDuration } from "@/lib/domain/stats";
import { elapsedSeconds, type SessionClock } from "@/lib/domain/timer";
import { buttonClass } from "@/components/ui/button";
import { CountUp } from "@/components/fx/count-up";
import { useNow } from "@/components/focus/use-ticker";
import { RankCelebration } from "./rank-celebration";

/** Escala de la barra: de 0 a 13 h (el rango simbólico máximo). */
const MAX_H = RANKS[RANKS.length - 1].minHours;
const pos = (seconds: number) => Math.min(100, (seconds / 3600 / MAX_H) * 100);

export function RankBadge({ rank, className }: { rank: Rank; className?: string }) {
  const elite = rank.minHours >= 10;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
        elite ? "bg-[var(--gold-soft)] text-[var(--gold)] ring-1 ring-[var(--gold)]/30" : rank.minHours >= 7 ? "bg-accent-soft text-accent" : "bg-surface-2 text-text",
        className,
      )}
    >
      {elite && <Crown size={14} />}
      {rankLabel(rank)}
    </span>
  );
}

/** Barra de rangos: cada marca es un rango; la bandera es tu objetivo. */
export function RankLadder({ seconds, goalMinutes }: { seconds: number; goalMinutes: number }) {
  const current = rankIndex(seconds);
  const reached = seconds >= goalMinutes * 60;
  return (
    <div>
      <div
        className="relative h-3 rounded-full bg-surface-2"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={MAX_H * 60}
        aria-valuenow={Math.round(seconds / 60)}
        aria-label="Horas productivas de hoy en la escala de rangos"
      >
        <div
          className={cn(
            "bar-in absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000",
            reached ? "bg-gradient-to-r from-[var(--gold)] to-[var(--gold-2)]" : "bg-gradient-to-r from-accent to-accent-2",
          )}
          style={{ width: `${Math.max(seconds > 0 ? 1.5 : 0, pos(seconds))}%` }}
        />
        {RANKS.slice(1).map((r) => (
          <span
            key={r.id}
            className={cn("absolute top-1/2 h-5 w-[2px] -translate-y-1/2 rounded-full", seconds >= r.minHours * 3600 ? "bg-white/80" : "bg-muted/40")}
            style={{ left: `${pos(r.minHours * 3600)}%` }}
            aria-hidden
          />
        ))}
        <span
          className="absolute -top-6 -translate-x-1/2 text-[var(--gold)]"
          style={{ left: `${pos(goalMinutes * 60)}%` }}
          title={`Tu objetivo: ${goalLabel(goalMinutes)}`}
          aria-hidden
        >
          <Flag size={16} fill="currentColor" />
        </span>
      </div>
      <div className="relative mt-2 h-4 text-[10px] text-muted tabular" aria-hidden>
        {RANKS.slice(1).map((r, i) => (
          <span
            key={r.id}
            className={cn("absolute -translate-x-1/2", i + 1 === current && "font-bold text-text", i % 2 === 1 && "hidden sm:inline")}
            style={{ left: `${pos(r.minHours * 3600)}%` }}
          >
            {r.minHours}h
          </span>
        ))}
      </div>
    </div>
  );
}

const noop = () => () => {};
/** true solo en el navegador tras hidratar. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}

export type LiveSession = SessionClock & { counts: boolean };

export function TodayPanel({
  baseSeconds,
  goalMinutes,
  active,
  today,
  dateLabel,
  hello,
}: {
  baseSeconds: number;
  goalMinutes: number;
  active: LiveSession | null;
  today: string;
  dateLabel: string;
  hello: string;
}) {
  const live = active?.counts ?? false;
  const now = useNow(live && active?.status === "running");
  // Hasta montar en el navegador se usa el valor del servidor (evita diferencias de hidratación).
  const mounted = useHydrated();
  const extra = live && active && mounted ? elapsedSeconds(active, now) : 0;
  const seconds = baseSeconds + extra;

  const rank = rankFor(seconds);
  const next = nextRank(seconds);
  const goal = goalMinutes * 60;
  const reached = seconds >= goal;
  const msg = dayMessage(seconds, goalMinutes, false);
  const toGoal = Math.max(0, goal - seconds);

  return (
    <section
      className={cn(
        "card-glass relative overflow-hidden rounded-[32px] p-6 sm:p-8",
        reached && "ring-1 ring-[var(--gold)]/40",
      )}
      aria-labelledby="today-level"
      data-testid="today-panel"
    >
      <div
        className={cn(
          "animate-glow pointer-events-none absolute -right-24 -top-32 h-96 w-96 rounded-full blur-3xl",
          reached ? "bg-gradient-to-br from-[var(--gold)]/35 via-[var(--gold-2)]/20 to-transparent" : "bg-gradient-to-br from-accent/40 via-accent-2/25 to-ring-focus/15",
        )}
        aria-hidden
      />
      <RankCelebration today={today} seconds={seconds} goalMinutes={goalMinutes} />

      <div className="relative">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="wordmark text-xs text-text">ESCAPE AVG</p>
          <p className="text-xs font-medium text-muted">
            {hello} · {dateLabel}
          </p>
        </div>

        <h1 id="today-level" className="mt-6 text-xs font-bold uppercase tracking-[0.2em] text-muted">
          <span className="sr-only">{hello}. </span>Tu nivel de hoy
        </h1>
        <p className="mt-2 flex flex-wrap items-baseline gap-x-3" data-testid="today-hours">
          <span className={cn("num-xl text-[52px] sm:text-[76px]", reached ? "text-gold" : "text-gradient")}>
            {extra > 0 ? formatDuration(seconds) : <CountUp value={seconds} kind="duration" duration={1400} />}
          </span>
          <span className="text-lg font-medium text-muted">productivos</span>
          {extra > 0 && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-medium text-success">
              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-success" /> en curso
            </span>
          )}
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted">Rango actual:</span>
          <RankBadge rank={rank} />
        </div>

        <div className="mt-8">
          <RankLadder seconds={seconds} goalMinutes={goalMinutes} />
        </div>

        <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-surface-2/70 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Próximo rango</dt>
            {reached ? (
              <dd className="mt-1 font-medium">No hace falta. Tu objetivo de hoy está cumplido.</dd>
            ) : next ? (
              <dd className="mt-1" data-testid="next-rank">
                <span className="font-semibold">{rankLabel(next.rank)}</span>
                <span className="block text-muted">Faltan {hoursText(next.missingSeconds)} para alcanzar el siguiente nivel</span>
              </dd>
            ) : (
              <dd className="mt-1 font-medium">Has alcanzado el rango simbólico máximo.</dd>
            )}
          </div>
          <div className="rounded-2xl bg-surface-2/70 p-3.5">
            <dt className="text-xs font-semibold uppercase tracking-wider text-muted">Objetivo principal</dt>
            <dd className="mt-1">
              <span className="font-semibold" data-testid="goal-label">
                {goalLabel(goalMinutes)}
              </span>
              <span className="block text-muted">
                {reached ? "Cumplido" : `${Math.floor((seconds / goal) * 100)} % · faltan ${hoursText(toGoal)}`}
              </span>
            </dd>
          </div>
        </dl>

        <div
          className={cn("mt-5 rounded-2xl p-4", msg.title ? "bg-[var(--gold-soft)]" : "bg-accent-soft/60")}
          data-testid="day-message"
          aria-live="polite"
        >
          {msg.title && <p className="text-gold text-2xl font-extrabold tracking-tight sm:text-3xl">{msg.title}</p>}
          <p className={cn(msg.title ? "mt-1 text-sm font-bold uppercase tracking-wide text-[var(--gold)]" : "text-[15px] font-medium")}>{msg.body}</p>
          {msg.title && msg.kind === "goal" && (
            <p className="mt-2 text-sm text-muted">El descanso también es progreso. Puedes parar aquí con la conciencia tranquila.</p>
          )}
        </div>

        {!reached && (
          <div className="mt-6 flex flex-wrap gap-2">
            <Link href="/focus" className={buttonClass("primary", "lg")}>
              <Play size={18} /> Empezar actividad
            </Link>
            <Link href="/focus#registro" className={buttonClass("secondary", "lg")}>
              <Plus size={18} /> Registrar tiempo
            </Link>
          </div>
        )}

        <p className="mt-5 flex items-start gap-1.5 text-xs text-muted">
          <Info size={13} className="mt-0.5 shrink-0" />
          <span>
            {SYMBOLIC_NOTE}{" "}
            <Link href="/philosophy#rangos" className="text-accent hover:underline">
              Cómo funcionan
            </Link>
          </span>
        </p>
      </div>
    </section>
  );
}
