"use client";

import { useState } from "react";
import { CalendarDays, LoaderCircle, Sparkles, Swords } from "lucide-react";
import { createGoal } from "@/app/(app)/goals/actions";
import type { ChallengeSuggestion } from "@/lib/domain/gamification";
import { addDays } from "@/lib/domain/dates";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/card";
import { useAction } from "@/components/tasks/use-action";
import { METRIC_META } from "@/components/progress/meta";

/** Desafíos sugeridos: al aceptarlos se crean como objetivos de 7 días que se miden solos. */
export function ChallengeSuggestions({ items, today }: { items: ChallengeSuggestion[]; today: string }) {
  const { run, pending, error } = useAction();
  // Qué tarjeta se está aceptando (para mostrar la carga solo en ella).
  const [busy, setBusy] = useState<string | null>(null);
  if (items.length === 0)
    return (
      <p className="flex items-center gap-3 rounded-2xl bg-tone-soft/60 p-3.5 text-sm text-tone-ink">
        <Swords size={16} className="shrink-0" aria-hidden />
        Ya tienes un desafío activo de cada tipo. ¡A por ellos!
      </p>
    );
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 md:grid-cols-3">
        {items.map((c) => {
          const { tone, icon: Icon } = METRIC_META[c.metric];
          const loading = pending && busy === c.key;
          return (
            <li key={c.key} data-tone={tone} className="card-tint lift group relative flex min-w-0 flex-col gap-3 overflow-hidden rounded-[22px] p-4">
              <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-tone opacity-[0.14] blur-2xl" aria-hidden />
              <div className="relative flex items-start justify-between gap-2">
                <span className="tone-chip h-10 w-10 rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105">
                  <Icon size={18} aria-hidden />
                </span>
                <span data-tone="gold">
                  <Badge variant="solid">
                    <Sparkles size={11} aria-hidden />+{c.xp} XP
                  </Badge>
                </span>
              </div>
              <div className="relative flex-1">
                <p className="font-display text-[15.5px] font-semibold leading-snug">{c.title}</p>
                <p className="mt-1 text-xs leading-relaxed text-muted">{c.description}</p>
              </div>
              <div className="relative flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1 text-[11.5px] font-medium text-muted">
                  <CalendarDays size={13} aria-hidden />
                  {c.days} días
                </span>
                <Button
                  size="sm"
                  variant="tone"
                  disabled={pending}
                  onClick={() => {
                    setBusy(c.key);
                    run(() =>
                      createGoal({
                        title: c.title,
                        description: "Desafío personal de 7 días",
                        metric: c.metric,
                        period: "custom",
                        start_date: today,
                        end_date: addDays(today, c.days - 1),
                        target_value: c.target,
                        category_id: null,
                      }),
                    );
                  }}
                >
                  {loading ? <LoaderCircle size={14} className="animate-spin" aria-hidden /> : <Swords size={14} aria-hidden />}
                  Aceptar desafío
                </Button>
              </div>
            </li>
          );
        })}
      </ul>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
