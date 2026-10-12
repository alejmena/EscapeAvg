import Link from "next/link";
import {
  ArrowRight,
  BellOff,
  CalendarCheck,
  CalendarHeart,
  Clock,
  Coffee,
  FolderKanban,
  Hourglass,
  Info,
  Lightbulb,
  Ruler,
  Sprout,
  TrendingDown,
} from "lucide-react";
import type { Recommendation } from "@/lib/domain/recommendations";
import type { Tone } from "@/lib/sections";
import { cn } from "@/lib/cn";
import { buttonClass } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/card";

/** Cada tipo de recomendación tiene su ficha: icono, color y una etiqueta corta. */
const KIND: Record<Recommendation["kind"], { icon: typeof Lightbulb; tone: Tone; tag: string }> = {
  procrastination: { icon: Hourglass, tone: "coral", tag: "Aplazamiento" },
  small_start: { icon: Sprout, tone: "green", tag: "Empezar" },
  best_time: { icon: Clock, tone: "sky", tag: "Tu mejor hora" },
  habit_decline: { icon: TrendingDown, tone: "orange", tag: "Hábitos" },
  estimates: { icon: Ruler, tone: "indigo", tag: "Estimaciones" },
  interruptions: { icon: BellOff, tone: "pink", tag: "Interrupciones" },
  rest: { icon: Coffee, tone: "teal", tag: "Descanso" },
  consistency: { icon: CalendarCheck, tone: "gold", tag: "Constancia" },
  best_day: { icon: CalendarHeart, tone: "amber", tag: "Tu mejor día" },
  project: { icon: FolderKanban, tone: "blue", tag: "Proyectos" },
};

export function RecommendationList({ items, limit, layout = "list" }: { items: Recommendation[]; limit?: number; layout?: "list" | "grid" }) {
  const shown = limit ? items.slice(0, limit) : items;
  if (shown.length === 0) {
    return (
      <EmptyState icon={<Lightbulb />} title="Aún no hay suficientes datos para recomendaciones fiables.">
        Sigue registrando sesiones, tareas y hábitos.
      </EmptyState>
    );
  }
  return (
    <ul className={cn("grid gap-3", layout === "grid" && "md:grid-cols-2 xl:grid-cols-3")}>
      {shown.map((r) => {
        const k = KIND[r.kind] ?? { icon: Lightbulb, tone: "amber" as Tone, tag: "Sugerencia" };
        const Icon = k.icon;
        return (
          <li
            key={r.id}
            data-tone={k.tone}
            className="group relative flex min-w-0 flex-col overflow-hidden rounded-[20px] border border-border/70 bg-surface/50 p-4 transition-[border-color,box-shadow,transform] duration-300 hover:border-[color:color-mix(in_srgb,var(--tone)_35%,var(--border))] hover:shadow-[0_14px_30px_-18px_var(--tone)]"
          >
            <div className="pointer-events-none absolute -right-10 -top-12 h-28 w-28 rounded-full bg-tone opacity-[0.1] blur-2xl transition-opacity duration-300 group-hover:opacity-20" aria-hidden />
            <div className={cn("relative flex min-w-0 flex-col gap-3", layout === "list" && "sm:flex-row sm:gap-3.5")}>
              <span className="tone-chip h-10 w-10 rounded-2xl transition-transform duration-300 group-hover:-rotate-6 group-hover:scale-105 [&_svg]:h-[18px] [&_svg]:w-[18px]" aria-hidden>
                <Icon />
              </span>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="eyebrow mb-1 text-[10px]">{k.tag}</p>
                <p className="font-display text-[15px] font-semibold leading-snug">{r.title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted">{r.body}</p>
                <p className="mt-2.5 flex items-start gap-1.5 rounded-xl bg-surface-2/60 px-2.5 py-1.5 text-xs text-muted">
                  <Info size={12} className="mt-0.5 shrink-0 text-tone-ink" aria-hidden />
                  <span>
                    <span className="font-semibold text-text/80">Dato:</span> {r.evidence}
                  </span>
                </p>
                {r.action && (
                  <Link href={r.action.href} className={buttonClass("tone", "sm", "mt-3 self-start")}>
                    {r.action.label}
                    <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                  </Link>
                )}
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
