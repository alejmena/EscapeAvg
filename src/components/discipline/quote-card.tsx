"use client";

import { useState } from "react";
import { Lightbulb, Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { ORIGIN_LABEL, type Quote } from "@/lib/domain/quotes";
import type { Tone } from "@/lib/sections";
import { toggleFavoriteQuote } from "@/app/(app)/philosophy/actions";
import { useAction } from "@/components/tasks/use-action";

export function FavoriteButton({ quote, favorite, disabled }: { quote: Quote; favorite: boolean; disabled?: boolean }) {
  const [fav, setFav] = useState(favorite);
  // Cambia en cada clic para reiniciar la animación de la estrella.
  const [bump, setBump] = useState(0);
  const { run, pending, error } = useAction();
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      <button
        type="button"
        disabled={pending || disabled}
        onClick={() => {
          const nextFav = !fav;
          setFav(nextFav);
          setBump((b) => b + 1);
          run(async () => {
            const res = await toggleFavoriteQuote(quote.id, nextFav);
            if (!res.ok) setFav(!nextFav);
            return res;
          });
        }}
        className={cn(
          "press relative grid h-10 w-10 place-items-center rounded-full transition-colors disabled:opacity-40",
          fav
            ? "bg-[var(--gold-soft)] text-[var(--gold)] shadow-[0_6px_16px_-8px_var(--gold)] ring-1 ring-[var(--gold)]/30"
            : "bg-surface-2/70 text-muted hover:bg-surface-2 hover:text-text",
        )}
        aria-pressed={fav}
        aria-label={fav ? "Quitar de favoritas" : "Guardar como favorita"}
        title={disabled ? "Disponible al activar el sistema de disciplina" : fav ? "Quitar de favoritas" : "Guardar como favorita"}
      >
        {fav && bump > 0 && <span key={`r${bump}`} className="celebrate-ring absolute inset-0 rounded-full border-2 border-[var(--gold-2)]" aria-hidden />}
        <Star key={bump} size={18} fill={fav ? "currentColor" : "none"} className={cn(bump > 0 && "pop-in")} />
      </button>
    </span>
  );
}

export function QuoteCard({
  quote,
  favorite,
  ready,
  label = "Frase del día",
  className,
  tone = "fuchsia",
}: {
  quote: Quote;
  favorite: boolean;
  ready: boolean;
  label?: string;
  className?: string;
  /** Color de la tarjeta (por defecto, el de Filosofía). */
  tone?: Tone;
}) {
  return (
    <figure
      data-tone={tone}
      className={cn("card-glass spotlight group relative flex min-w-0 flex-col overflow-hidden rounded-[26px] p-5 sm:p-6", className)}
      data-testid="quote-card"
    >
      {/* Comillas gigantes y luz del tono: decoración. */}
      <div className="pointer-events-none absolute -right-16 -top-20 h-52 w-52 rounded-full bg-tone opacity-[0.14] blur-3xl" aria-hidden />
      <span
        className="pointer-events-none absolute left-3 top-8 select-none font-display text-[140px] font-bold leading-none text-tone opacity-[0.08] transition-transform duration-700 group-hover:-translate-y-1 sm:left-4"
        aria-hidden
      >
        &ldquo;
      </span>
      <div className="relative flex items-start justify-between gap-3">
        <p className="flex flex-wrap items-center gap-2">
          <span className="eyebrow">{label}</span>
          <span className="rounded-full bg-tone-soft px-2 py-0.5 text-[11px] font-semibold text-tone-ink">{ORIGIN_LABEL[quote.origin]}</span>
        </p>
        <FavoriteButton key={`${quote.id}-${favorite}`} quote={quote} favorite={favorite} disabled={!ready} />
      </div>
      <blockquote className="relative mt-4">
        <p className="font-display text-[26px] font-semibold leading-snug tracking-tight sm:text-[30px]" lang={quote.origin === "china" ? "zh" : "ru"}>
          {quote.text}
        </p>
        {quote.reading && <p className="mt-1.5 text-xs italic text-muted">{quote.reading}</p>}
        <p className="mt-4 border-l-[3px] border-tone pl-3 text-[15px] font-medium leading-relaxed">«{quote.translation}»</p>
      </blockquote>
      <figcaption className="relative mb-4 mt-2.5 pl-3.5 text-xs font-medium text-muted">— {quote.source}</figcaption>
      <p className="relative mt-auto flex gap-2.5 rounded-2xl bg-tone-soft/60 p-3.5 text-sm leading-relaxed text-text/85">
        <Lightbulb size={16} className="mt-0.5 shrink-0 text-tone-ink" aria-hidden />
        <span>{quote.reflection}</span>
      </p>
    </figure>
  );
}
