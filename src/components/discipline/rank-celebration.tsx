"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Crown } from "lucide-react";
import { GOAL_DONE_BODY, GOAL_DONE_TITLE, rankIndex, rankLabel, rankMessage, RANKS } from "@/lib/domain/discipline";
import { quoteOfDay } from "@/lib/domain/quotes";

type Shown = { kind: "goal" | "rank"; idx: number; seconds: number };

const key = (day: string) => `eavg:celebrated:${day}`;

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
    if (idx > prev.idx || (goal && !prev.goal)) write(today, { idx: Math.max(idx, prev.idx), goal: goal || prev.goal });
    if (!next) return;
    const show = setTimeout(() => setShown(next), 700);
    return () => clearTimeout(show);
    // Solo al cambiar de rango o de estado del objetivo, no a cada segundo.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [today, idx, goal]);

  useEffect(() => {
    if (!shown) return;
    const t = setTimeout(() => setShown(null), 6500);
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
  // Portal: el panel usa backdrop-filter, que recortaría un overlay "fixed" dentro de él.
  return createPortal(
    <div
      className="celebrate-backdrop fixed inset-0 z-[70] grid place-items-center bg-black/55 p-6 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label={shown.kind === "goal" ? "Objetivo cumplido" : `Nuevo rango: ${rankLabel(rank)}`}
      onClick={() => setShown(null)}
      data-testid="celebration"
    >
      <div className="relative grid place-items-center">
        <span className="celebrate-ring absolute h-64 w-64 rounded-full border-2 border-[var(--gold-2)]" aria-hidden />
        <span className="celebrate-ring absolute h-64 w-64 rounded-full border border-[var(--gold)] [animation-delay:350ms]" aria-hidden />
        {Array.from({ length: 16 }, (_, i) => (
          <span
            key={i}
            className="celebrate-spark absolute h-2 w-0.5 rounded-full bg-[var(--gold-2)]"
            style={{ ["--a" as string]: `${i * 22.5}deg`, animationDelay: `${200 + (i % 4) * 90}ms` }}
            aria-hidden
          />
        ))}
        <div className="celebrate-card relative max-w-md rounded-[32px] border border-white/10 bg-[#0b0b0f]/90 px-8 py-9 text-center text-white shadow-2xl">
          <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-[var(--gold)] to-[var(--gold-2)] text-black shadow-lg">
            <Crown size={26} />
          </span>
          {shown.kind === "goal" ? (
            <>
              <p className="text-gold mt-5 text-3xl font-extrabold tracking-tight">{GOAL_DONE_TITLE}</p>
              <p className="mt-2 text-sm font-bold uppercase tracking-wide text-[#f6e3a8]">{GOAL_DONE_BODY}</p>
            </>
          ) : (
            <>
              <p className="mt-5 text-xs font-bold uppercase tracking-[0.25em] text-white/60">Nuevo rango</p>
              <p className="text-gold mt-1 text-3xl font-extrabold tracking-tight">{rankLabel(rank)}</p>
              <p className="mt-3 text-sm text-white/80">{rankMessage(Math.max(shown.seconds, rank.minHours * 3600))}</p>
            </>
          )}
          <figure className="mt-6 border-t border-white/10 pt-5">
            <blockquote className="text-lg" lang={quote.origin === "china" ? "zh" : "ru"}>
              {quote.text}
            </blockquote>
            <figcaption className="mt-1 text-xs text-white/60">
              «{quote.translation}» · {quote.source}
            </figcaption>
          </figure>
          <p className="mt-5 text-[11px] text-white/40">Toca para cerrar</p>
        </div>
      </div>
    </div>,
    document.body,
  );
}
