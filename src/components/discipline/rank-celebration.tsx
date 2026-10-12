"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crown } from "lucide-react";
import { cn } from "@/lib/cn";
import { GOAL_DONE_BODY, GOAL_DONE_TITLE, rankIndex, rankLabel, rankMessage, RANKS } from "@/lib/domain/discipline";
import { quoteOfDay } from "@/lib/domain/quotes";

type Shown = { kind: "goal" | "rank"; idx: number; seconds: number };

const key = (day: string) => `eavg:celebrated:${day}`;
/** La celebración se cierra sola pasado este tiempo. */
const AUTO_CLOSE_MS = 6500;

function read(day: string): { idx: number; goal: boolean } {
  try {
    const v = JSON.parse(localStorage.getItem(key(day)) ?? "null");
    if (v && typeof v.idx === "number") return { idx: v.idx, goal: !!v.goal };
  } catch {}
  return { idx: 0, goal: false };
}

function write(day: string, v: { idx: number; goal: boolean }) {
  try {
    localStorage.setItem(key(day), JSON.stringify(v));
  } catch {}
}

/**
 * Celebración elegante (una sola vez por día y rango) al alcanzar un rango importante o el objetivo.
 * Nada de confeti por cualquier clic: solo metas reales.
 */
export function RankCelebration({ today, seconds, goalMinutes }: { today: string; seconds: number; goalMinutes: number }) {
  const [shown, setShown] = useState<Shown | null>(null);
  const idx = rankIndex(seconds);
  const goal = seconds >= goalMinutes * 60;

  useEffect(() => {
    const prev = read(today);
    let next: Shown | null = null;
    if (goal && !prev.goal) next = { kind: "goal", idx, seconds };
    else if (idx > prev.idx && RANKS[idx].milestone) next = { kind: "rank", idx, seconds };
    // Se guarda al mostrarla (no antes): si el efecto se cancela, la celebración no se pierde.
    const record = () => {
      if (idx > prev.idx || (goal && !prev.goal)) write(today, { idx: Math.max(idx, prev.idx), goal: goal || prev.goal });
    };
    if (!next) {
      record();
      return;
    }
    const show = setTimeout(() => {
      record();
      setShown(next);
    }, 700);
    return () => clearTimeout(show);
    // Solo al cambiar de rango o de estado del objetivo, no a cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, idx, goal]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), AUTO_CLOSE_MS);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setShown(null);
    window.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      window.removeEventListener("keydown", onKey);
    };
  }, [shown]);

  if (!shown) return null;
  const rank = RANKS[shown.idx];
  const quote = quoteOfDay(today, shown.kind === "goal" ? "suficiencia" : "constancia");
  // Portal: así el overlay "fixed" nunca queda recortado por la tarjeta que lo contiene.
  return createPortal(
    <div
      className="celebrate-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/60 p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={shown.kind === "goal" ? "Objetivo cumplido" : `Nuevo rango: ${rankLabel(rank)}`}
      onClick={() => setShown(null)}
      data-testid="celebration"
    >
      <div className="relative grid place-items-center">
        {/* Halo dorado, ondas y chispas: todo decorativo y sin animación con "reducir movimiento". */}
        <span className="animate-glow pointer-events-none absolute h-[26rem] w-[26rem] rounded-full bg-[radial-gradient(circle,var(--gold)_0%,transparent_65%)] opacity-50 blur-2xl" aria-hidden />
        <span className="celebrate-ring absolute h-64 w-64 rounded-full border-2 border-[var(--gold-2)]" aria-hidden />
        <span className="celebrate-ring absolute h-64 w-64 rounded-full border border-[var(--gold)] [animation-delay:350ms]" aria-hidden />
        <span className="celebrate-ring absolute h-64 w-64 rounded-full border border-white/40 [animation-delay:700ms]" aria-hidden />
        {Array.from({ length: 24 }, (_, i) => (
          <span
            key={i}
            className={cn("celebrate-spark absolute w-0.5 rounded-full", i % 3 === 0 ? "h-3 bg-white" : i % 3 === 1 ? "h-2 bg-[var(--gold-2)]" : "h-2.5 bg-[var(--gold)]")}
            style={{ ["--a" as string]: `${i * 15}deg`, animationDelay: `${180 + (i % 5) * 80}ms` }}
            aria-hidden
          />
        ))}
        <div className="celebrate-card dark relative w-full max-w-md overflow-hidden rounded-[32px] border border-[var(--gold-2)]/25 bg-bg/92 px-8 py-9 text-center text-white shadow-[0_40px_80px_-20px_rgb(0_0_0/0.8),0_0_0_1px_rgb(255_255_255/0.04)]">
          <div className="pointer-events-none absolute inset-x-0 -top-24 mx-auto h-48 w-64 rounded-full bg-[var(--gold)] opacity-30 blur-3xl" aria-hidden />
          <span className="animate-float relative mx-auto grid h-16 w-16 place-items-center rounded-[20px] bg-gradient-to-br from-[var(--gold)] to-[var(--gold-2)] text-black shadow-[0_12px_30px_-8px_var(--gold)]">
            <Crown size={30} />
          </span>
          {shown.kind === "goal" ? (
            <>
              <p className="text-gold relative mt-5 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{GOAL_DONE_TITLE}</p>
              <p className="relative mt-2 text-sm font-bold uppercase tracking-wide text-[var(--gold-2)]">{GOAL_DONE_BODY}</p>
            </>
          ) : (
            <>
              <p className="relative mt-5 text-xs font-bold uppercase tracking-[0.25em] text-white/60">Nuevo rango</p>
              <p className="text-gold relative mt-1 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{rankLabel(rank)}</p>
              <p className="relative mt-3 text-sm text-white/80">{rankMessage(Math.max(shown.seconds, rank.minHours * 3600))}</p>
            </>
          )}
          <figure className="relative mt-6 border-t border-white/10 pt-5">
            <blockquote className="font-display text-lg" lang={quote.origin === "china" ? "zh" : "ru"}>
              {quote.text}
            </blockquote>
            <figcaption className="mt-1 text-xs text-white/60">
              «{quote.translation}» · {quote.source}
            </figcaption>
          </figure>
          <p className="relative mt-5 text-[11px] text-white/40">Toca para cerrar</p>
          {/* Cuenta atrás del cierre automático. */}
          <span
            className="bar-in absolute inset-x-0 bottom-0 h-[3px] bg-gradient-to-r from-[var(--gold)] to-[var(--gold-2)]"
            style={{ animationDuration: `${AUTO_CLOSE_MS}ms`, animationDirection: "reverse", animationTimingFunction: "linear" }}
            aria-hidden
          />
        </div>
      </div>
    </div>,
    document.body,
  );
}
