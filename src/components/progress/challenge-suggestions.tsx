"use client";

import { Swords } from "lucide-react";
import { createGoal } from "@/app/(app)/goals/actions";
import type { ChallengeSuggestion } from "@/lib/domain/gamification";
import { addDays } from "@/lib/domain/dates";
import { Button } from "@/components/ui/button";
import { useAction } from "@/components/tasks/use-action";

/** Desafíos sugeridos: al aceptarlos se crean como objetivos de 7 días que se miden solos. */
export function ChallengeSuggestions({ items, today }: { items: ChallengeSuggestion[]; today: string }) {
  const { run, pending, error } = useAction();
  if (items.length === 0) return <p className="text-sm text-muted">Ya tienes un desafío activo de cada tipo. ¡A por ellos!</p>;
  return (
    <div className="space-y-3">
      <ul className="grid gap-3 md:grid-cols-3">
        {items.map((c) => (
          <li key={c.key} className="flex flex-col gap-2 rounded-xl border border-border p-3">
            <p className="flex items-center gap-2 text-sm font-medium">
              <Swords size={15} className="text-accent" />
              {c.title}
            </p>
            <p className="flex-1 text-xs text-muted">{c.description}</p>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs font-medium text-accent">+{c.xp} XP</span>
              <Button
                size="sm"
                variant="secondary"
                disabled={pending}
                onClick={() =>
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
                  )
                }
              >
                Aceptar desafío
              </Button>
            </div>
          </li>
        ))}
      </ul>
      {error && <p className="text-sm text-danger">{error}</p>}
    </div>
  );
}
