"use client";

import { useState } from "react";
import { Brain, CalendarCheck, Check, Clock, Flame, Gauge, Lock, Moon, Play, Sparkles, Star, Sunrise, Target, Undo2, Zap } from "lucide-react";
import type { Achievement } from "@/lib/domain/gamification";
import { cn } from "@/lib/cn";
import { Badge, ProgressBar, ProgressRing } from "@/components/ui/card";
import { TIER_META } from "@/components/progress/meta";

const ICONS: Record<Achievement["icon"], typeof Play> = {
  play: Play,
  zap: Zap,
  brain: Brain,
  clock: Clock,
  check: Check,
  flame: Flame,
  sunrise: Sunrise,
  moon: Moon,
  undo: Undo2,
  target: Target,
  gauge: Gauge,
  calendar: CalendarCheck,
  star: Star,
};

/** Logro ya preparado en el servidor (fechas formateadas). */
export type AchievementItem = {
  id: string;
  title: string;
  description: string;
  icon: Achievement["icon"];
  tier: Achievement["tier"];
  current: number;
  target: number;
  /** "12 oct" si está desbloqueado. */
  unlocked: string | null;
  recent: boolean;
};

type Filter = "all" | "done" | "todo";

// Borde dorado de las medallas conseguidas.
const GOLD_RIM = "conic-gradient(from 210deg, var(--gold), var(--gold-2), var(--gold), var(--gold-2), var(--gold))";

/** Vitrina de logros: medallas a color (conseguidas) y en gris con su progreso (pendientes). */
export function AchievementsGrid({ items }: { items: AchievementItem[] }) {
  const [filter, setFilter] = useState<Filter>("all");
  const done = items.filter((a) => a.unlocked);
  const todo = items.filter((a) => !a.unlocked);
  const shown = filter === "done" ? done : filter === "todo" ? todo : items;
  const tiers = ([1, 2, 3, 4] as const).map((t) => ({
    tier: t,
    got: done.filter((a) => a.tier === t).length,
    of: items.filter((a) => a.tier === t).length,
  }));

  return (
    <div>
      <div className="mb-5 grid gap-4 rounded-[22px] bg-surface-2/50 p-4 sm:grid-cols-[1fr_auto] sm:items-center">
        <div className="min-w-0">
          <div className="mb-2 flex items-baseline justify-between gap-2">
            <p className="text-sm font-semibold">
              <span className="num-xl text-[26px]">{done.length}</span>
              <span className="text-muted"> / {items.length} medallas</span>
            </p>
            <span className="text-xs font-semibold text-tone-ink tabular">{Math.round((done.length / Math.max(1, items.length)) * 100)} %</span>
          </div>
          <ProgressBar value={done.length / Math.max(1, items.length)} label="Logros conseguidos" />
        </div>
        <ul className="flex flex-wrap gap-1.5" aria-label="Medallas por categoría">
          {tiers.map((t) => (
            <li key={t.tier} data-tone={TIER_META[t.tier].tone} className="inline-flex items-center gap-1.5 rounded-full bg-surface/80 py-1 pl-1 pr-2.5 text-xs shadow-[0_0_0_1px_var(--card-edge)]">
              <span className="tone-chip h-5 w-5 rounded-full text-[9px] font-bold">{"I".repeat(t.tier).replace("IIII", "IV")}</span>
              <span className="font-medium">{TIER_META[t.tier].label}</span>
              <span className="text-muted tabular">
                {t.got}/{t.of}
              </span>
            </li>
          ))}
        </ul>
      </div>

      <div className="seg mb-5 flex w-full sm:inline-flex sm:w-auto [&>button]:flex-1 [&>button]:justify-center [&>button]:px-2 sm:[&>button]:flex-none sm:[&>button]:px-3" role="group" aria-label="Filtrar logros">
        {(
          [
            ["all", "Todos", items.length],
            ["done", "Conseguidos", done.length],
            ["todo", "Pendientes", todo.length],
          ] as const
        ).map(([key, label, n]) => (
          <button key={key} type="button" aria-pressed={filter === key} onClick={() => setFilter(key)}>
            {label}
            <span className="rounded-full bg-surface-2 px-1.5 text-[11px] tabular text-muted">{n}</span>
          </button>
        ))}
      </div>

      {/* La clave reinicia la entrada escalonada al cambiar de filtro. */}
      <ul key={filter} className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {shown.map((a) => (
          <Medal key={a.id} a={a} />
        ))}
      </ul>
    </div>
  );
}

function Medal({ a }: { a: AchievementItem }) {
  const Icon = ICONS[a.icon];
  const tier = TIER_META[a.tier];
  const ratio = Math.min(1, a.current / a.target);
  const almost = !a.unlocked && ratio >= 0.75;

  if (a.unlocked) {
    return (
      <li
        className={cn(
          "lift group relative flex min-w-0 flex-col items-center overflow-hidden rounded-[22px] border bg-surface/70 px-3 pb-4 pt-5 text-center",
          "border-[color-mix(in_srgb,var(--gold)_32%,var(--border))]",
          a.recent && "ring-2 ring-[var(--gold)]/60 ring-offset-2 ring-offset-bg",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-[radial-gradient(60%_100%_at_50%_0%,color-mix(in_srgb,var(--gold)_22%,transparent),transparent)]" aria-hidden />
        {a.recent && (
          <span className="absolute right-2.5 top-2.5">
            <Badge variant="solid">
              <Sparkles size={10} aria-hidden />
              Nuevo
            </Badge>
          </span>
        )}
        <span className="relative grid h-[68px] w-[68px] place-items-center rounded-full p-1 shadow-[0_10px_22px_-10px_var(--gold),inset_0_1px_0_rgb(255_255_255/0.6)]" style={{ background: GOLD_RIM }}>
          <span data-tone={tier.tone} className="tone-chip relative h-full w-full overflow-hidden rounded-full [&_svg]:h-6 [&_svg]:w-6">
            <Icon aria-hidden className="transition-transform duration-500 group-hover:scale-110 group-hover:-rotate-6" />
            {/* Destello que cruza la medalla al pasar por encima. */}
            <span className="pointer-events-none absolute inset-0 -translate-x-full bg-[linear-gradient(100deg,transparent_30%,rgb(255_255_255/0.55)_50%,transparent_70%)] transition-transform duration-700 group-hover:translate-x-full" aria-hidden />
          </span>
        </span>
        <p className="relative mt-3 text-sm font-semibold leading-tight">{a.title}</p>
        <p className="relative mt-1 text-xs leading-snug text-muted">{a.description}</p>
        <div className="relative mt-auto flex flex-wrap items-center justify-center gap-1.5 pt-3">
          <span data-tone={tier.tone}>
            <Badge variant="tone">{tier.label}</Badge>
          </span>
          <span className="text-[11px] font-medium text-tone-ink">Desbloqueado el {a.unlocked}</span>
        </div>
      </li>
    );
  }

  return (
    <li className="group relative flex min-w-0 flex-col items-center rounded-[22px] border border-dashed border-border-strong/80 bg-surface/30 px-3 pb-4 pt-5 text-center transition-colors hover:bg-surface/60">
      {almost && (
        <span className="absolute right-2.5 top-2.5">
          <Badge variant="tone">Casi</Badge>
        </span>
      )}
      <ProgressRing value={ratio} size={68} stroke={4}>
        <span className="grid h-[52px] w-[52px] place-items-center rounded-full bg-surface-2 text-faint transition-colors group-hover:text-muted">
          <Lock size={18} aria-hidden />
        </span>
      </ProgressRing>
      <p className="mt-3 text-sm font-semibold leading-tight text-muted">{a.title}</p>
      <p className="mt-1 text-xs leading-snug text-muted">{a.description}</p>
      <div className="mt-auto flex w-full items-center gap-2 pt-3">
        <ProgressBar value={ratio} size="sm" label={`Progreso de ${a.title}`} />
        <span className="shrink-0 text-[11px] font-medium tabular text-muted">
          {a.current}/{a.target}
        </span>
      </div>
    </li>
  );
}
