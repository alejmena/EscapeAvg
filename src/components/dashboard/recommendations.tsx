import Link from "next/link";
import { Lightbulb } from "lucide-react";
import type { Recommendation } from "@/lib/domain/recommendations";
import { buttonClass } from "@/components/ui/button";

export function RecommendationList({ items, limit }: { items: Recommendation[]; limit?: number }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return <p className="text-sm text-muted">Aún no hay suficientes datos para recomendaciones fiables. Sigue registrando sesiones, tareas y hábitos.</p>;
  }
  return (
    <ul className="space-y-3">
      {shown.map((r) => (
        <li key={r.id} className="rounded-xl bg-surface-2 p-3">
          <p className="flex items-start gap-2 text-sm font-medium">
            <Lightbulb size={15} className="mt-0.5 shrink-0 text-warning" />
            {r.title}
          </p>
          <p className="mt-1 text-sm text-muted">{r.body}</p>
          <p className="mt-1 text-xs text-muted/80">Dato: {r.evidence}</p>
          {r.action && (
            <Link href={r.action.href} className={buttonClass("secondary", "sm", "mt-2")}>
              {r.action.label}
            </Link>
          )}
        </li>
      ))}
    </ul>
  );
}
