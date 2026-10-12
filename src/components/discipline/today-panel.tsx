"use client";

import { useSyncExternalStore } from "react";
import Link from "next/link";
import { Crown, Flag, Info, MessageCircleHeart, Play, Plus, Sparkles, Target, TrendingUp, Zap } from "lucide-react";
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
import { ProgressRing } from "@/components/ui/card";
import { CountUp } from "@/components/fx/count-up";
import { useNow } from "@/components/focus/use-ticker";
import { RankCelebration } from "./rank-celebration";

/** Escala de la barra: de 0 a 13 h (el rango simbólico máximo). */
const MAX_H = RANKS[RANKS.length - 1].minHours;
const pos = (seconds: number) => Math.min(100, (seconds / 3600 / MAX_H) * 100);

/** Rango con su insignia: corona dorada en élite, rayo desde "Alto rendimiento". */
export function RankBadge({ rank, className }: { rank: Rank; className?: string }) {
  const elite = rank.minHours >= 10;
  const high = !elite && rank.minHours >= 7;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold",
        elite
          ? "bg-[var(--gold-soft)] text-[var(--gold)] ring-1 ring-[var(--gold)]/30"
          : high
            ? "bg-accent-soft text-accent-ink ring-1 ring-accent/20"
            : "bg-surface-2 text-text ring-1 ring-border",
        className,
      )}
    >
      {elite && <Crown size={14} aria-hidden />}
      {high && <Zap size={13} aria-hidden />}
      {rankLabel(rank)}
    </span>
  );
}

/** Barra de rangos (pensada para la tarjeta destacada): cada marca es un rango; la bandera es tu objetivo. */
export function RankLadder({ seconds, goalMinutes }: { seconds: number; goalMinutes: number }) {
  const current = rankIndex(seconds);
  const reached = seconds >= goalMinutes * 60;
  const fill = Math.max(seconds > 0 ? 2 : 0, pos(seconds));
  return (
    <div>
      <div
        className="relative h-3.5 rounded-full bg-black/15 shadow-[inset_0_1px_2px_rgb(0_0_0/0.18)] dark:bg-black/25"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={MAX_H * 60}
        aria-valuenow={Math.round(seconds / 60)}
        aria-label="Horas productivas de hoy en la escala de rangos"
      >
        <div
          className={cn(
            "bar-in absolute inset-y-0 left-0 rounded-full transition-[width] duration-1000",
            reached
              ? "bg-gradient-to-r from-[var(--gold)] to-[var(--gold-2)] shadow-[0_0_18px_-2px_var(--gold-2)]"
              : "bg-gradient-to-r from-white/75 to-white shadow-[0_0_18px_-2px_rgb(255_255_255/0.9)]",
          )}
          style={{ width: `${fill}%` }}
        />
        {RANKS.slice(1).map((r) => (
          <span
            key={r.id}
            className={cn(
              "absolute top-1/2 h-2 w-[2px] -translate-y-1/2 rounded-full",
              seconds >= r.minHours * 3600
                ? reached
                  ? "bg-black/25"
                  : "bg-[color:color-mix(in_srgb,var(--tone)_55%,transparent)]"
                : "bg-white/40",
            )}
            style={{ left: `${pos(r.minHours * 3600)}%` }}
            aria-hidden
          />
        ))}
        {seconds > 0 && (
          <span
            className="absolute top-1/2 h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_5px_rgb(255_255_255/0.22),0_4px_10px_rgb(0_0_0/0.25)] transition-[left] duration-1000"
            style={{ left: `${fill}%` }}
            aria-hidden
          />
        )}
        <span
          className="absolute -top-7 -translate-x-1/2 text-[var(--gold-2)] drop-shadow-[0_2px_4px_rgb(0_0_0/0.3)]"
          style={{ left: `${pos(goalMinutes * 60)}%` }}
          title={`Tu objetivo: ${goalLabel(goalMinutes)}`}
          aria-hidden
        >
          <Flag size={18} fill="currentColor" />
        </span>
      </div>
      <div className="relative mt-2.5 h-4 text-[10.5px] font-medium text-white/65 tabular" aria-hidden>
        {RANKS.slice(1).map((r, i) => (
          <span
            key={r.id}
            className={cn("absolute -translate-x-1/2", i + 1 === current && "font-bold text-white", i % 2 === 1 && "hidden sm:inline")}
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

/**
 * Fondo "noche y oro" de la tarjeta cuando el objetivo del día está cumplido. La tarjeta lleva entonces
 * un contenedor con la clase `dark`: siempre oscura, con los tonos de oro brillantes del tema oscuro.
 */
const GOLD_SURFACE: React.CSSProperties = {
  background:
    "radial-gradient(100% 85% at 100% 0%, color-mix(in srgb, var(--gold) 38%, transparent), transparent 62%), radial-gradient(80% 100% at 0% 100%, color-mix(in srgb, var(--gold-2) 16%, transparent), transparent 70%), linear-gradient(150deg, color-mix(in srgb, var(--gold) 22%, var(--bg)) 0%, var(--bg) 100%)",
  borderColor: "color-mix(in srgb, var(--gold-2) 45%, transparent)",
  boxShadow: "0 1px 0 rgb(255 255 255 / 0.2) inset, 0 28px 56px -22px color-mix(in srgb, var(--gold) 70%, transparent)",
};

/** Botón principal sobre la tarjeta destacada: blanco con el texto del tono. */
export function TodayPanel({
  baseSeconds,
  goalMinutes,
  active,
  today,
}: {
  baseSeconds: number;
  goalMinutes: number;
  active: LiveSession | null;
  today: string;
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
  const ratio = goal ? Math.min(1, seconds / goal) : 0;

  return (
    <div className={reached ? "dark" : undefined}>
      <section
        className="card-feature relative overflow-hidden rounded-[32px] p-6 sm:p-8"
        style={reached ? GOLD_SURFACE : undefined}
        aria-labelledby="today-level"
        data-testid="today-panel"
      >
        {/* Luces de fondo: dan profundidad al degradado. */}
        <div
          className={cn(
            "animate-glow pointer-events-none absolute -right-20 -top-28 -z-10 h-80 w-80 rounded-full blur-3xl",
            reached ? "bg-[var(--gold-2)]/35" : "bg-white/20",
          )}
          aria-hidden
        />
        <div
          className={cn("pointer-events-none absolute -bottom-32 -left-16 -z-10 h-72 w-72 rounded-full blur-3xl", reached ? "bg-[var(--gold)]/15" : "bg-tone-2/40")}
          aria-hidden
        />
        <RankCelebration today={today} seconds={seconds} goalMinutes={goalMinutes} />

        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 id="today-level" className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.18em] text-white/80">
                <Sparkles size={13} aria-hidden />
                Tu nivel de hoy
              </h2>
              {extra > 0 && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-0.5 text-xs font-semibold text-white ring-1 ring-white/25">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" /> en curso
                </span>
              )}
            </div>
            <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1" data-testid="today-hours">
              <span className={cn("num-xl text-[56px] sm:text-[84px]", reached ? "text-gold" : "text-white [text-shadow:0_6px_30px_rgb(0_0_0/0.18)]")}>
                {extra > 0 ? formatDuration(seconds) : <CountUp value={seconds} kind="duration" duration={1400} />}
              </span>
              <span className="text-lg font-medium text-white/75 sm:text-xl">productivos</span>
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
              <span className="text-white/75">Rango actual:</span>
              <RankBadge rank={rank} className="shadow-[0_6px_16px_-8px_rgb(0_0_0/0.4)]" />
            </div>
          </div>

          {/* Anillo del objetivo: cuánto llevas de tu meta del día. */}
          <div className="hidden shrink-0 sm:block" aria-hidden>
            <ProgressRing value={ratio} size={148} stroke={12} color={reached ? "var(--gold-2)" : "#fff"}>
              <span className="grid place-items-center text-center leading-none">
                {reached ? (
                  <Crown size={30} className="text-[var(--gold-2)]" />
                ) : (
                  <span className="num-xl text-[34px]">{Math.floor(ratio * 100)}%</span>
                )}
                <span className="mt-1.5 text-[11px] font-medium text-white/70">{reached ? "cumplido" : "de tu objetivo"}</span>
              </span>
            </ProgressRing>
          </div>
        </div>

        <div className="mt-9">
          <RankLadder seconds={seconds} goalMinutes={goalMinutes} />
        </div>

        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2">
          <div className="flex gap-3 rounded-2xl border border-border bg-surface-2 p-3.5 backdrop-blur-sm sm:p-4">
            <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 text-white sm:grid" aria-hidden>
              <TrendingUp size={17} />
            </span>
            <div className="min-w-0">
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">Próximo rango</dt>
              {reached ? (
                <dd className="mt-1 font-medium">No hace falta. Tu objetivo de hoy está cumplido.</dd>
              ) : next ? (
                <dd className="mt-1" data-testid="next-rank">
                  <span className="font-semibold">{rankLabel(next.rank)}</span>
                  <span className="block text-white/75">Faltan {hoursText(next.missingSeconds)} para alcanzar el siguiente nivel</span>
                </dd>
              ) : (
                <dd className="mt-1 font-medium">Has alcanzado el rango simbólico máximo.</dd>
              )}
            </div>
          </div>
          <div className="flex gap-3 rounded-2xl border border-border bg-surface-2 p-3.5 backdrop-blur-sm sm:p-4">
            <span className="hidden h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/20 text-white sm:grid" aria-hidden>
              <Target size={17} />
            </span>
            <div className="min-w-0">
              <dt className="text-[11px] font-bold uppercase tracking-[0.12em] text-white/70">Objetivo principal</dt>
              <dd className="mt-1">
                <span className="font-semibold" data-testid="goal-label">
                  {goalLabel(goalMinutes)}
                </span>
                <span className="block text-white/75">
                  {reached ? "Cumplido" : `${Math.floor((seconds / goal) * 100)} % · faltan ${hoursText(toGoal)}`}
                </span>
              </dd>
            </div>
          </div>
        </dl>

        <div
          className={cn("mt-3 flex gap-3 rounded-2xl p-4", msg.title ? "bg-black/25 ring-1 ring-[var(--gold-2)]/30" : "bg-white/15 ring-1 ring-white/20")}
          data-testid="day-message"
          aria-live="polite"
        >
          {!msg.title && <MessageCircleHeart size={20} className="mt-0.5 shrink-0 text-white/85" aria-hidden />}
          <div className="min-w-0">
            {msg.title && <p className="text-gold font-display text-2xl font-extrabold tracking-tight sm:text-3xl">{msg.title}</p>}
            <p className={cn(msg.title ? "mt-1 text-sm font-bold uppercase tracking-wide text-[var(--gold-2)]" : "text-[15px] font-medium leading-snug")}>{msg.body}</p>
            {msg.title && msg.kind === "goal" && (
              <p className="mt-2 text-sm text-white/75">El descanso también es progreso. Puedes parar aquí con la conciencia tranquila.</p>
            )}
          </div>
        </div>

        {!reached && (
          <div className="mt-6 flex flex-col gap-2.5 sm:flex-row sm:flex-wrap">
            <Link href="/focus" className={buttonClass("inverse", "lg")}>
              <Play size={18} fill="currentColor" /> Empezar actividad
            </Link>
            <Link href="/focus#registro" className={buttonClass("secondary", "lg", "backdrop-blur-sm")}>
              <Plus size={18} /> Registrar tiempo
            </Link>
          </div>
        )}

        <p className="mt-5 flex items-start gap-1.5 text-xs text-white/65">
          <Info size={13} className="mt-0.5 shrink-0" aria-hidden />
          <span>
            {SYMBOLIC_NOTE}{" "}
            <Link href="/philosophy#rangos" className="font-semibold text-white underline decoration-white/40 underline-offset-2 hover:decoration-white">
              Cómo funcionan
            </Link>
          </span>
        </p>
      </section>
    </div>
  );
}
