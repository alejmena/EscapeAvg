"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { ORIGIN_LABEL, type Quote } from "@/lib/domain/quotes";
import { toggleFavoriteQuote } from "@/app/(app)/philosophy/actions";
import { useAction } from "@/components/tasks/use-action";

export function FavoriteButton({ quote, favorite, disabled }: { quote: Quote; favorite: boolean; disabled?: boolean }) {
  const [fav, setFav] = useState(favorite);
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
          run(async () => {
            const res = await toggleFavoriteQuote(quote.id, nextFav);
            if (!res.ok) setFav(!nextFav);
            return res;
          });
        }}
        className={cn(
          "press grid h-9 w-9 place-items-center rounded-full transition-colors disabled:opacity-40",
          fav ? "bg-[var(--gold-soft)] text-[var(--gold)]" : "text-muted hover:bg-surface-2 hover:text-text",
        )}
        aria-pressed={fav}
        aria-label={fav ? "Quitar de favoritas" : "Guardar como favorita"}
        title={disabled ? "Disponible al activar el sistema de disciplina" : fav ? "Quitar de favoritas" : "Guardar como favorita"}
      >
        <Star size={17} fill={fav ? "currentColor" : "none"} />
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
}: {
  quote: Quote;
  favorite: boolean;
  ready: boolean;
  label?: string;
  className?: string;
}) {
  return (
    <figure className={cn("card-glass relative min-w-0 overflow-hidden rounded-[24px] p-5 sm:p-6", className)} data-testid="quote-card">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted">
          {label} · {ORIGIN_LABEL[quote.origin]}
        </p>
        <FavoriteButton key={`${quote.id}-${favorite}`} quote={quote} favorite={favorite} disabled={!ready} />
      </div>
      <blockquote className="mt-3">
        <p className="text-2xl font-semibold leading-snug tracking-tight sm:text-[28px]" lang={quote.origin === "china" ? "zh" : "ru"}>
          {quote.text}
        </p>
        {quote.reading && <p className="mt-1 text-xs italic text-muted">{quote.reading}</p>}
        <p className="mt-3 text-[15px] font-medium">«{quote.translation}»</p>
      </blockquote>
      <figcaption className="mt-2 text-xs text-muted">{quote.source}</figcaption>
      <p className="mt-3 border-t border-border/70 pt-3 text-sm text-muted">{quote.reflection}</p>
    </figure>
  );
}
