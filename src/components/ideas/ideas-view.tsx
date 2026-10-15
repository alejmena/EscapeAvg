"use client";

import "./ideas.css";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  CalendarCheck2,
  CalendarPlus,
  Check,
  ChevronDown,
  Clock,
  Coins,
  Compass,
  Gauge,
  Languages,
  LayoutGrid,
  Lightbulb,
  Link2,
  Rows3,
  Search,
  Shuffle,
  SlidersHorizontal,
  Sparkles,
  Star,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { AREAS, IDEAS, IDEA_BY_KEY } from "@/lib/ideas/catalog";
import { CEFR_HOURS, CEFR_LABEL, CEFR_LEVELS } from "@/lib/ideas/catalog-languages";
import { connections, DURATIONS, filterIdeas, floatingSample, formatHours, isGold, isKeyLevel, type DurationBucket, type IdeaSort } from "@/lib/ideas/ideas";
import type { Idea, IdeaArea } from "@/lib/ideas/types";
import { formatTime, weeklyMinutes, weeksToFinish } from "@/lib/domain/schedule";
import { WEEKDAY_NAME } from "@/lib/format";
import type { ScheduleBlock } from "@/lib/types";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { BlockForm } from "@/components/schedule/block-form";

const AREA_BY_KEY = new Map(AREAS.map((a) => [a.key, a]));
const AREA_COUNTS = new Map(AREAS.map((a) => [a.key, IDEAS.filter((i) => i.area === a.key).length]));
const GOLD_COUNT = IDEAS.filter(isGold).length;
const PAGE = 48;
const MAX_CEFR = Math.max(...CEFR_LEVELS.map((l) => CEFR_HOURS[l]));
const LEVEL_NAMES = ["", "Muy fácil", "Fácil", "Intermedia", "Avanzada", "Muy avanzada"];
const number = (n: number) => n.toLocaleString("es-MX");
const METER = { difficulty: "var(--accent)", future: "var(--success)", money: "var(--gold)" };
const areaInk = (color: string) => `color-mix(in srgb, ${color} 72%, var(--text))`;

function Dots({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${label}: ${value} de 5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="h-1.5 w-3 rounded-full" style={{ background: n <= value ? color : "var(--surface-3)" }} />
      ))}
    </span>
  );
}

function Marks({ idea }: { idea: Idea }) {
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      {isGold(idea) && (
        <span className="idea-badge-gold inline-flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-bold">
          <Sparkles size={11} aria-hidden /> Dorada
        </span>
      )}
      {isKeyLevel(idea) && <span className="idea-badge-key rounded-full px-2 py-1 text-[10px] font-bold">Nivel clave {idea.level}</span>}
    </span>
  );
}

export function IdeasView({
  blocks,
  scheduleReady,
  initialIdea,
  initialArea,
}: {
  blocks: ScheduleBlock[] | null;
  scheduleReady: boolean;
  initialIdea: string | null;
  initialArea: string | null;
}) {
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [area, setArea] = useState<IdeaArea | null>(AREA_BY_KEY.has(initialArea as IdeaArea) ? (initialArea as IdeaArea) : null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [duration, setDuration] = useState<DurationBucket | null>(null);
  const [minFuture, setMinFuture] = useState<number | null>(null);
  const [goldOnly, setGoldOnly] = useState(false);
  const [sort, setSort] = useState<IdeaSort>("value");
  const [seed, setSeed] = useState(7);
  const [limit, setLimit] = useState(PAGE);
  const [view, setView] = useState<"grid" | "list">("grid");
  const [showFilters, setShowFilters] = useState(false);
  const [showAreas, setShowAreas] = useState(false);
  const [open, setOpen] = useState<Idea | null>(initialIdea ? (IDEA_BY_KEY.get(initialIdea) ?? null) : null);
  const searchRef = useRef<HTMLInputElement>(null);
  const catalogRef = useRef<HTMLDivElement>(null);

  const list = useMemo(
    () => filterIdeas({ q: deferredQ, area, difficulty, duration, minFuture, goldOnly, sort }),
    [deferredQ, area, difficulty, duration, minFuture, goldOnly, sort],
  );
  const cloud = useMemo(() => floatingSample(IDEAS, 18, seed), [seed]);
  const spotlight = cloud[0];
  const scheduledKeys = useMemo(() => new Set((blocks ?? []).map((b) => b.idea_key).filter(Boolean)), [blocks]);
  const activeFilters = [
    ...(q.trim() ? [{ label: `«${q.trim()}»`, clear: () => setQ("") }] : []),
    ...(area ? [{ label: AREA_BY_KEY.get(area)!.label, clear: () => setArea(null) }] : []),
    ...(difficulty ? [{ label: LEVEL_NAMES[difficulty], clear: () => setDifficulty(null) }] : []),
    ...(duration ? [{ label: DURATIONS.find((d) => d.key === duration)!.label, clear: () => setDuration(null) }] : []),
    ...(minFuture ? [{ label: `Utilidad ${minFuture}+/5`, clear: () => setMinFuture(null) }] : []),
    ...(goldOnly ? [{ label: "Solo doradas", clear: () => setGoldOnly(false) }] : []),
  ];
  const extraFilterCount = [difficulty, duration, minFuture, goldOnly].filter(Boolean).length;
  const reset = () => {
    setQ("");
    setArea(null);
    setDifficulty(null);
    setDuration(null);
    setMinFuture(null);
    setGoldOnly(false);
    setLimit(PAGE);
  };
  const explore = () => {
    catalogRef.current?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
    searchRef.current?.focus({ preventScroll: true });
  };
  const preset = (kind: "quick" | "easy" | "gold") => {
    reset();
    if (kind === "quick") {
      setDuration("short");
      setSort("quick");
    }
    if (kind === "easy") {
      setDifficulty(1);
      setSort("easy");
    }
    if (kind === "gold") {
      setGoldOnly(true);
      setSort("value");
    }
    explore();
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement | null;
      if (e.key !== "/" || e.metaKey || e.ctrlKey || t?.closest("input, textarea, select, [contenteditable=true], dialog")) return;
      e.preventDefault();
      searchRef.current?.focus();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div className="ideas-page space-y-6">
      <PageHeader
        title="Ideas para crecer"
        eyebrow="Tu espacio para descubrir"
        subtitle="Aprende algo nuevo, empieza un proyecto o encuentra ese hábito que te hace bien. Tu próximo paso empieza aquí."
        action={
          <Link
            href="/schedule"
            className="press inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface px-4 text-sm font-semibold shadow-soft hover:border-border-strong"
          >
            <CalendarCheck2 size={16} className="text-tone-ink" aria-hidden /> {scheduledKeys.size ? `${scheduledKeys.size} en tu horario` : "Mi horario"}{" "}
            <ArrowRight size={14} aria-hidden />
          </Link>
        }
      />

      <Card variant="feature" className="ideas-hero p-6 sm:p-8">
        <div className="ideas-hero-grid">
          <div className="relative flex flex-col items-start justify-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold">
              <Compass size={14} aria-hidden /> Un mundo por explorar
            </span>
            <h2 className="max-w-lg font-display text-[30px] font-bold leading-[1.08] tracking-tight sm:text-[44px]">Una idea puede cambiar tu semana.</h2>
            <p className="mt-4 max-w-md text-sm leading-relaxed text-white/95 sm:text-[15px]">
              No necesitas hacerlo todo. Solo encontrar algo que te dé curiosidad y darle un lugar en tu día.
            </p>
            <Button variant="inverse" size="lg" onClick={explore} className="mt-6">
              Explorar el catálogo <ArrowDown size={16} aria-hidden />
            </Button>
            <div className="mt-6 grid w-full max-w-sm grid-cols-3 gap-3 border-t border-white/20 pt-5">
              <div>
                <p className="font-display text-[22px] font-bold tabular sm:text-2xl">{number(IDEAS.length)}</p>
                <p className="mt-0.5 text-xs text-white/95">ideas para crecer</p>
              </div>
              <div>
                <p className="font-display text-[22px] font-bold tabular sm:text-2xl">{AREAS.length}</p>
                <p className="mt-0.5 text-xs text-white/95">áreas por descubrir</p>
              </div>
              <div>
                <p className="font-display text-[22px] font-bold tabular sm:text-2xl">{number(GOLD_COUNT)}</p>
                <p className="mt-0.5 text-xs text-white/95">con alto potencial</p>
              </div>
            </div>
          </div>
          <div className="ideas-spotlight relative flex flex-col rounded-[24px] p-5 sm:p-6">
            <div className="flex items-center justify-between gap-2">
              <p className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-[0.12em]">
                <Sparkles size={13} aria-hidden /> Déjate sorprender
              </p>
              <button
                type="button"
                onClick={() => setSeed((s) => s + 1)}
                className="press grid h-9 w-9 shrink-0 place-items-center rounded-full border border-white/25 bg-white/10 transition-colors hover:bg-white/25"
                aria-label="Otra sugerencia"
                title="Otra sugerencia"
              >
                <Shuffle size={15} aria-hidden />
              </button>
            </div>
            {spotlight ? (
              <>
                <span className="mt-6 hidden h-14 w-14 place-items-center rounded-[18px] bg-white/15 text-3xl sm:grid" aria-hidden>
                  {AREA_BY_KEY.get(spotlight.area)!.emoji}
                </span>
                <p className="mb-2 mt-4 text-xs font-semibold text-white/95">{AREA_BY_KEY.get(spotlight.area)!.label}</p>
                <h3 className="line-clamp-3 font-display text-[20px] sm:text-[23px] font-semibold leading-tight">{spotlight.title}</h3>
                <p className="mb-6 mt-3 hidden text-sm leading-relaxed text-white/95 sm:line-clamp-3">{spotlight.how}</p>
                <div className="mt-5 flex items-center justify-between gap-2 border-t border-white/20 pt-4 sm:mt-auto">
                  <span className="flex items-center gap-1.5 text-xs font-medium">
                    <Clock size={14} aria-hidden /> ≈ {formatHours(spotlight.hours)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setOpen(spotlight)}
                    className="press inline-flex items-center gap-2 rounded-full bg-white px-4 py-2.5 text-xs font-bold text-[color:color-mix(in_srgb,var(--tone)_35%,black)]"
                  >
                    Ver esta idea <ArrowRight size={14} aria-hidden />
                  </button>
                </div>
              </>
            ) : (
              <p className="my-auto py-12 text-sm text-white/95">Prueba otros filtros para descubrir más ideas.</p>
            )}
          </div>
        </div>
        <details className="ideas-discovery relative mt-6 border-t border-white/20 pt-4">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-lg py-1 text-sm font-semibold">
            <span className="inline-flex items-center gap-2">
              <Lightbulb size={16} aria-hidden /> Más ideas para inspirarte
            </span>
            <ChevronDown size={16} className="ideas-details-chevron" aria-hidden />
          </summary>
          <div className="mt-4 flex flex-wrap gap-2" data-testid="idea-cloud">
            {cloud.map((idea) => (
              <button
                key={idea.key}
                type="button"
                onClick={() => setOpen(idea)}
                className="idea-suggestion press inline-flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/10 px-3 py-2 text-xs font-medium"
              >
                <span aria-hidden>{AREA_BY_KEY.get(idea.area)!.emoji}</span>
                <span className="truncate">{idea.title}</span>
                <ArrowRight size={12} className="shrink-0 opacity-65" aria-hidden />
              </button>
            ))}
          </div>
        </details>
      </Card>

      <div className="grid gap-2.5 sm:grid-cols-3" aria-label="Formas de explorar">
        {[
          {
            key: "quick" as const,
            icon: Zap,
            title: "Tengo poco tiempo",
            caption: "Ideas de menos de 20 horas",
            active: duration === "short" && sort === "quick",
          },
          {
            key: "easy" as const,
            icon: Compass,
            title: "Quiero empezar fácil",
            caption: "Un primer paso sin complicarte",
            active: difficulty === 1 && sort === "easy",
          },
          { key: "gold" as const, icon: TrendingUp, title: "Busco alto potencial", caption: "Explora las ideas doradas", active: goldOnly },
        ].map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => preset(p.key)}
            aria-pressed={p.active}
            className="idea-preset press group flex items-center gap-3 rounded-[20px] border border-border bg-surface/80 p-4 text-left transition-colors"
          >
            <span className="idea-preset-icon grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-tone-soft text-tone-ink">
              <p.icon size={19} aria-hidden />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-sm font-semibold">{p.title}</span>
              <span className="mt-0.5 block text-xs text-muted">{p.caption}</span>
            </span>
            <ArrowRight size={15} className="shrink-0 text-faint transition-transform group-hover:translate-x-0.5" aria-hidden />
          </button>
        ))}
      </div>

      <div ref={catalogRef} className="scroll-mt-6 space-y-5">
        <Card className="ideas-search-panel space-y-5 p-4 sm:p-6">
          <div className="flex flex-wrap items-center gap-2.5">
            <div className="relative min-w-0 flex-[1_1_220px]">
              <Search size={20} className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-tone-ink" aria-hidden />
              <Input
                ref={searchRef}
                value={q}
                onChange={(e) => {
                  setQ(e.target.value);
                  setLimit(PAGE);
                }}
                placeholder="¿Qué te gustaría aprender o hacer?"
                className="h-14 rounded-2xl! bg-surface-2/70! pl-12! pr-11! text-[15px]!"
                aria-label="Buscar ideas"
              />
              {q ? (
                <button
                  type="button"
                  onClick={() => {
                    setQ("");
                    setLimit(PAGE);
                    searchRef.current?.focus();
                  }}
                  className="press absolute right-3 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted hover:bg-surface-3"
                  aria-label="Borrar búsqueda"
                >
                  <X size={16} aria-hidden />
                </button>
              ) : (
                <kbd
                  className="pointer-events-none absolute right-4 top-1/2 hidden h-6 w-6 -translate-y-1/2 place-items-center rounded-md border border-border bg-surface text-xs text-muted sm:grid"
                  aria-hidden
                >
                  /
                </kbd>
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowFilters((v) => !v)}
              aria-expanded={showFilters}
              aria-controls="idea-filters"
              className={cn(
                "press inline-flex h-14 items-center justify-center gap-2 rounded-2xl border px-4 text-sm font-semibold",
                showFilters || extraFilterCount ? "border-tone/40 bg-tone-soft text-tone-ink" : "border-border bg-surface text-text",
              )}
            >
              <SlidersHorizontal size={17} aria-hidden /> Filtros{" "}
              {extraFilterCount > 0 && <span className="grid h-5 w-5 place-items-center rounded-full bg-tone text-[10px] text-white">{extraFilterCount}</span>}
              <ChevronDown size={14} className={cn("transition-transform", showFilters && "rotate-180")} aria-hidden />
            </button>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-2">
              <p className="text-xs font-bold uppercase tracking-[0.1em] text-muted">Explora por área</p>
              <button
                type="button"
                onClick={() => setShowAreas((v) => !v)}
                aria-expanded={showAreas}
                aria-controls="idea-areas"
                className="press inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold text-tone-ink"
              >
                {showAreas ? "Ver menos" : `Ver las ${AREAS.length} áreas`}
                <ChevronDown size={13} className={cn("transition-transform", showAreas && "rotate-180")} aria-hidden />
              </button>
            </div>
            <div id="idea-areas" className="flex flex-wrap gap-2" aria-label="Áreas">
              <button
                type="button"
                onClick={() => {
                  setArea(null);
                  setLimit(PAGE);
                }}
                aria-pressed={!area}
                className="idea-category idea-category-all press"
              >
                <span className="grid h-6 w-6 place-items-center rounded-lg bg-surface">
                  <LayoutGrid size={13} aria-hidden />
                </span>
                Todas<span className="idea-category-count">{number(IDEAS.length)}</span>
              </button>
              {AREAS.filter((a, i) => showAreas || i < 6 || a.key === area).map((a) => (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => {
                    setArea(area === a.key ? null : a.key);
                    setLimit(PAGE);
                  }}
                  aria-pressed={area === a.key}
                  aria-label={`${a.emoji} ${a.label}`}
                  className="idea-category press"
                  style={{ "--a": a.color } as React.CSSProperties}
                >
                  <span className="text-base" aria-hidden>
                    {a.emoji}
                  </span>
                  {a.label}
                  <span className="idea-category-count">{number(AREA_COUNTS.get(a.key) ?? 0)}</span>
                </button>
              ))}
            </div>
          </div>

          <div id="idea-filters" hidden={!showFilters} className="border-t border-border pt-5">
            <div className="grid gap-4 sm:grid-cols-3">
              <label className="space-y-2 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1.5">
                  <Gauge size={14} aria-hidden /> Dificultad
                </span>
                <Select
                  value={difficulty ?? ""}
                  onChange={(e) => {
                    setDifficulty(e.target.value ? Number(e.target.value) : null);
                    setLimit(PAGE);
                  }}
                  aria-label="Dificultad"
                  className="h-11 text-sm"
                >
                  <option value="">Cualquier nivel</option>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>
                      {n}/5 · {LEVEL_NAMES[n]}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1.5">
                  <Clock size={14} aria-hidden /> Tiempo estimado
                </span>
                <Select
                  value={duration ?? ""}
                  onChange={(e) => {
                    setDuration((e.target.value || null) as DurationBucket | null);
                    setLimit(PAGE);
                  }}
                  aria-label="Duración"
                  className="h-11 text-sm"
                >
                  <option value="">Cualquier duración</option>
                  {DURATIONS.map((d) => (
                    <option key={d.key} value={d.key}>
                      {d.label}
                    </option>
                  ))}
                </Select>
              </label>
              <label className="space-y-2 text-xs font-semibold text-muted">
                <span className="flex items-center gap-1.5">
                  <TrendingUp size={14} aria-hidden /> Utilidad futura
                </span>
                <Select
                  value={minFuture ?? ""}
                  onChange={(e) => {
                    setMinFuture(e.target.value ? Number(e.target.value) : null);
                    setLimit(PAGE);
                  }}
                  aria-label="Utilidad futura mínima"
                  className="h-11 text-sm"
                >
                  <option value="">Cualquiera</option>
                  <option value="3">3 o más</option>
                  <option value="4">4 o más</option>
                  <option value="5">Solo 5</option>
                </Select>
              </label>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setGoldOnly((v) => !v);
                  setLimit(PAGE);
                }}
                aria-pressed={goldOnly}
                className={cn(
                  "press inline-flex min-h-10 items-center gap-2 rounded-full border px-3 text-xs font-semibold",
                  goldOnly ? "idea-gold" : "border-border bg-surface",
                )}
              >
                <Sparkles size={14} aria-hidden /> Solo doradas {goldOnly && <Check size={13} aria-hidden />}
              </button>
              <p className="text-xs leading-relaxed text-muted">Utilidad futura 5/5 y potencial económico 4 o 5.</p>
            </div>
          </div>
        </Card>

        {activeFilters.length > 0 && (
          <div className="flex flex-wrap items-center gap-2" aria-label="Filtros activos">
            {activeFilters.map((f) => (
              <button
                key={f.label}
                type="button"
                onClick={() => {
                  f.clear();
                  setLimit(PAGE);
                }}
                aria-label={`Quitar filtro: ${f.label}`}
                className="press inline-flex min-h-9 max-w-full items-center gap-2 rounded-full border border-tone/20 bg-tone-soft px-3 text-xs font-medium text-tone-ink"
              >
                <span className="truncate">{f.label}</span>
                <X size={12} className="shrink-0" aria-hidden />
              </button>
            ))}
            <button
              type="button"
              onClick={reset}
              className="press rounded-full px-2 py-2 text-xs font-semibold text-muted underline decoration-border-strong underline-offset-4 hover:text-text"
            >
              Quitar filtros
            </button>
          </div>
        )}

        {area === "lenguas" && (
          <Card variant="tint" tone="teal" className="text-sm">
            <CardTitle icon={<Languages />} subtitle="Horas orientativas desde cero, en inglés">
              Niveles del Marco Común Europeo (MCER)
            </CardTitle>
            <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
              {CEFR_LEVELS.map((l) => (
                <li key={l} className={cn("flex flex-col rounded-2xl p-3", l === "B1" || l === "B2" ? "bg-tone-soft ring-1 ring-tone/40" : "bg-surface-2/60")}>
                  <span className="font-display text-xl font-bold">{l}</span>
                  <span className="text-xs text-muted">{CEFR_LABEL[l]}</span>
                  <span className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <span className="block h-full rounded-full bg-tone" style={{ width: `${(CEFR_HOURS[l] / MAX_CEFR) * 100}%` }} />
                  </span>
                  <span className="mt-1 text-xs font-semibold tabular">≈ {CEFR_HOURS[l]} h en inglés</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs leading-relaxed text-muted">
              Estimaciones basadas en Cambridge English y ajustadas para otros idiomas según la dificultad relativa del FSI. Cada persona avanza a su ritmo.
            </p>
          </Card>
        )}

        <section aria-label="Catálogo de ideas" aria-busy={q !== deferredQ}>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-xl font-semibold">{activeFilters.length ? "Tus descubrimientos" : "Encuentra tu próxima idea"}</h2>
              <p className="mt-1 text-sm text-muted" aria-live="polite">
                <span className="font-semibold text-text tabular">{number(list.length)}</span> {list.length === 1 ? "idea disponible" : "ideas disponibles"}
                {area ? ` en ${AREA_BY_KEY.get(area)!.label.toLowerCase()}` : " para explorar"}
              </p>
            </div>
            <div className="flex min-w-0 flex-wrap items-center gap-2">
              <Select
                value={sort}
                onChange={(e) => {
                  setSort(e.target.value as IdeaSort);
                  setLimit(PAGE);
                }}
                className="h-10 w-auto max-w-full rounded-xl! text-xs font-medium"
                aria-label="Ordenar"
              >
                <option value="value">Más valiosas primero</option>
                <option value="quick">Más rápidas primero</option>
                <option value="easy">Más fáciles primero</option>
                <option value="az">A – Z</option>
              </Select>
              <div className="inline-flex gap-1 rounded-xl border border-border bg-surface p-1" role="group" aria-label="Vista del catálogo">
                <button
                  type="button"
                  onClick={() => setView("grid")}
                  aria-pressed={view === "grid"}
                  aria-label="Vista de tarjetas"
                  className={cn(
                    "press grid h-8 w-8 place-items-center rounded-lg",
                    view === "grid" ? "bg-tone-soft text-tone-ink" : "text-muted hover:bg-surface-2",
                  )}
                >
                  <LayoutGrid size={16} aria-hidden />
                </button>
                <button
                  type="button"
                  onClick={() => setView("list")}
                  aria-pressed={view === "list"}
                  aria-label="Vista de lista"
                  className={cn(
                    "press grid h-8 w-8 place-items-center rounded-lg",
                    view === "list" ? "bg-tone-soft text-tone-ink" : "text-muted hover:bg-surface-2",
                  )}
                >
                  <Rows3 size={16} aria-hidden />
                </button>
              </div>
            </div>
          </div>
          {list.length === 0 && (
            <EmptyState
              icon={<Search />}
              title="Todavía no encontramos esa idea"
              action={
                <Button variant="secondary" onClick={reset}>
                  Explorar todas las ideas
                </Button>
              }
            >
              Prueba una palabra más corta o elimina un filtro. Hay {number(IDEAS.length)} posibilidades esperándote.
            </EmptyState>
          )}
          <ul className={cn("idea-catalog grid gap-3.5", view === "grid" && "sm:grid-cols-2 xl:grid-cols-3")} data-view={view} data-testid="idea-list">
            {list.slice(0, limit).map((idea) => (
              <li key={idea.key}>
                <IdeaCatalogCard idea={idea} scheduled={scheduledKeys.has(idea.key)} onOpen={() => setOpen(idea)} />
              </li>
            ))}
          </ul>
          {list.length > 0 && (
            <div className="mx-auto mt-8 flex max-w-sm flex-col items-center gap-3 text-center">
              <p className="text-xs text-muted">
                Mostrando <span className="font-semibold text-text">{number(Math.min(limit, list.length))}</span> de {number(list.length)} ideas
              </p>
              <div className="h-1 w-36 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                <div className="h-full rounded-full bg-tone" style={{ width: `${Math.max(3, Math.min(limit / list.length, 1) * 100)}%` }} />
              </div>
              {list.length > limit && (
                <Button variant="secondary" size="lg" onClick={() => setLimit((l) => l + PAGE)} className="mt-1">
                  Ver {Math.min(PAGE, list.length - limit)} ideas más <ArrowDown size={16} aria-hidden />
                </Button>
              )}
            </div>
          )}
          <p className="mt-6 text-center text-[11px] leading-relaxed text-muted">
            La dificultad, las horas y el potencial son orientativos. Elige por curiosidad y avanza a tu ritmo.
          </p>
        </section>
      </div>
      {open && <IdeaDetail key={open.key} idea={open} blocks={blocks} scheduleReady={scheduleReady} onOpen={setOpen} onClose={() => setOpen(null)} />}
    </div>
  );
}

function IdeaCatalogCard({ idea, scheduled, onOpen }: { idea: Idea; scheduled: boolean; onOpen: () => void }) {
  const a = AREA_BY_KEY.get(idea.area)!;
  return (
    <button
      type="button"
      onClick={onOpen}
      aria-label={idea.title}
      className={cn(
        "idea-card group relative flex h-full w-full flex-col overflow-hidden rounded-[22px] border border-border bg-surface p-5 text-left",
        isGold(idea) && "idea-card-gold",
        !isGold(idea) && isKeyLevel(idea) && "idea-card-key",
      )}
      style={{ "--a": a.color } as React.CSSProperties}
    >
      <span className="idea-card-top flex items-start justify-between gap-3">
        <span
          className="idea-card-icon grid h-11 w-11 shrink-0 place-items-center rounded-[14px] text-xl"
          style={{ background: `color-mix(in srgb, ${a.color} 12%, var(--surface))` }}
          aria-hidden
        >
          {a.emoji}
        </span>
        <Marks idea={idea} />
      </span>
      <span className="idea-card-content mt-4 block min-w-0">
        <span className="mb-2 block text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: areaInk(a.color) }}>
          {a.label}
        </span>
        <span className="idea-card-title line-clamp-2 font-display text-[18px] font-semibold leading-snug">{idea.title}</span>
        <span className="idea-card-excerpt mt-2 line-clamp-2 text-[13px] leading-relaxed text-muted">{idea.how}</span>
      </span>
      <span className="idea-card-ratings mt-auto grid grid-cols-3 gap-2 pb-4 pt-5 text-[10px] text-muted">
        {[
          { name: "Dificultad", value: idea.difficulty, color: METER.difficulty },
          { name: "Futuro", value: idea.future, color: METER.future },
          { name: "Dinero", value: idea.money, color: METER.money },
        ].map((m) => (
          <span key={m.name} className="flex flex-col gap-1.5">
            <span className="flex items-center gap-1">
              {m.name}
              <span className="font-semibold text-text">{m.value}/5</span>
            </span>
            <Dots value={m.value} label={m.name} color={m.color} />
          </span>
        ))}
      </span>
      <span className="idea-card-footer flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
        <span className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 font-semibold tabular">
            <Clock size={13} className="text-muted" aria-hidden /> ≈ {formatHours(idea.hours)}
          </span>
          {scheduled && (
            <span className="inline-flex items-center gap-1 rounded-full bg-success-soft px-2 py-1 text-[10px] font-medium text-success">
              <CalendarCheck2 size={11} aria-hidden /> En tu horario
            </span>
          )}
        </span>
        <span className="idea-card-link inline-flex items-center gap-1.5 font-semibold text-tone-ink">
          Ver idea <ArrowRight size={14} aria-hidden />
        </span>
      </span>
    </button>
  );
}

function IdeaDetail({
  idea,
  blocks,
  scheduleReady,
  onOpen,
  onClose,
}: {
  idea: Idea;
  blocks: ScheduleBlock[] | null;
  scheduleReady: boolean;
  onOpen: (i: Idea) => void;
  onClose: () => void;
}) {
  const [adding, setAdding] = useState(false);
  const [added, setAdded] = useState<number | null>(null);
  const a = AREA_BY_KEY.get(idea.area)!;
  const mine = (blocks ?? []).filter((b) => b.idea_key === idea.key);
  const perWeek = weeklyMinutes(blocks ?? [], idea.key);
  const weeks = weeksToFinish(idea.hours, perWeek);
  const related = connections(idea.key).slice(0, 10);
  const paces = [2, 5, 10];
  const slowest = Math.ceil(idea.hours / paces[0]);

  return (
    <Modal open onClose={onClose} title={adding ? "Añadir a mi horario" : idea.title} sheet className="sm:max-w-xl">
      {adding ? (
        <div className="max-h-[70dvh] overflow-y-auto">
          <p className="mb-4 text-sm text-muted">Elige los días y la hora de cada uno. No tiene que ser la misma hora todos los días.</p>
          <BlockForm
            initialTitle={idea.title.slice(0, 80)}
            initialColor={isGold(idea) ? "#f59e0b" : a.color}
            ideaKey={idea.key}
            onDone={(n) => {
              setAdded(n);
              setAdding(false);
            }}
          />
        </div>
      ) : (
        <div className="-mx-1 max-h-[72dvh] space-y-5 overflow-y-auto px-1">
          {/* Cabecera con el color del área */}
          <div
            className="relative flex items-center gap-3 overflow-hidden rounded-[22px] p-3.5"
            style={{ background: `linear-gradient(135deg, color-mix(in srgb, ${a.color} 22%, transparent), color-mix(in srgb, ${a.color} 5%, transparent))` }}
          >
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-surface/70 text-[28px] shadow-soft" aria-hidden>
              {a.emoji}
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-semibold" style={{ color: areaInk(a.color) }}>
                {a.label}
              </p>
              <div className="flex flex-wrap items-center gap-1.5">
                <Marks idea={idea} />
                {idea.level && (
                  <span className="text-xs text-muted">
                    MCER {idea.level}: {CEFR_LABEL[idea.level]}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: <Gauge size={14} />, label: "Dificultad", value: `${idea.difficulty}/5`, color: METER.difficulty, n: idea.difficulty },
              { icon: <Clock size={14} />, label: "Duración total", value: `≈ ${formatHours(idea.hours)}`, color: "var(--tone)", n: 0 },
              { icon: <TrendingUp size={14} />, label: "Utilidad futura", value: `${idea.future}/5`, color: METER.future, n: idea.future },
              { icon: <Coins size={14} />, label: "Para ganar dinero", value: `${idea.money}/5`, color: METER.money, n: idea.money },
            ].map((m) => (
              <div key={m.label} className="relative overflow-hidden rounded-2xl border border-border bg-surface-2/50 p-3">
                <span
                  className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full opacity-20 blur-xl"
                  style={{ background: m.color }}
                  aria-hidden
                />
                <p className="flex items-center gap-1.5 text-[11px] font-medium text-muted">
                  <span className="grid h-5 w-5 place-items-center rounded-md text-white" style={{ background: m.color }} aria-hidden>
                    {m.icon}
                  </span>
                  {m.label}
                </p>
                <p className="mt-1.5 font-display text-xl font-bold tabular">{m.value}</p>
                {m.n > 0 && (
                  <span className="mt-1.5 flex gap-0.5" aria-hidden>
                    {[1, 2, 3, 4, 5].map((k) => (
                      <span key={k} className="h-1 flex-1 rounded-full" style={{ background: k <= m.n ? m.color : "var(--surface-3)" }} />
                    ))}
                  </span>
                )}
              </div>
            ))}
          </div>

          <div className="card-tint rounded-2xl p-4">
            <p className="mb-1.5 flex items-center gap-2 text-sm font-semibold">
              <span className="tone-chip h-6 w-6 rounded-lg">
                <Lightbulb size={13} aria-hidden />
              </span>
              Cómo empezar
            </p>
            <p className="text-[15px] leading-relaxed">{idea.how}</p>
          </div>

          <div className="rounded-2xl border border-border p-4 text-sm">
            <p className="mb-2 flex items-center gap-2 font-semibold">
              <Star size={15} className="text-tone-ink" aria-hidden /> ¿Cuánto tardarías?
            </p>
            {weeks ? (
              <p>
                Con lo que tienes en tu horario ({formatHours(Math.round((perWeek / 60) * 10) / 10)} a la semana) terminarías en unas <b>{weeks} semanas</b>.
              </p>
            ) : (
              <ul className="space-y-2 text-muted">
                {paces.map((h) => {
                  const w = Math.ceil(idea.hours / h);
                  return (
                    <li key={h} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1">
                      <span>
                        {h} h por semana → unas <b className="text-text">{w} semanas</b>
                      </span>
                      <span className="col-span-2 h-1.5 overflow-hidden rounded-full bg-surface-2">
                        <span
                          className="bar-in block h-full rounded-full bg-gradient-to-r from-tone to-tone-2"
                          style={{ width: `${Math.max(4, (w / slowest) * 100)}%` }}
                        />
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          {mine.length > 0 && (
            <div className="text-sm">
              <p className="mb-1.5 font-semibold">Ya está en tu horario</p>
              <ul className="flex flex-wrap gap-1.5">
                {mine.map((b) => (
                  <li key={b.id} className="inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-2.5 py-1 text-xs font-semibold text-tone-ink tabular">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: b.color }} aria-hidden />
                    {WEEKDAY_NAME[b.day_of_week]} {formatTime(b.start_minute)}–{formatTime(b.end_minute)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {related.length > 0 && (
            <div>
              <p className="mb-2 flex items-center gap-1.5 text-sm font-semibold">
                <Link2 size={14} className="text-tone-ink" aria-hidden /> Se complementa con
              </p>
              <div className="flex flex-wrap gap-1.5">
                {related.map((r) => (
                  <button
                    key={r.key}
                    type="button"
                    onClick={() => onOpen(r)}
                    className={cn(
                      "press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      isGold(r)
                        ? "idea-gold"
                        : isKeyLevel(r)
                          ? "idea-key"
                          : "border-border bg-surface hover:border-tone hover:bg-tone-soft hover:text-tone-ink",
                    )}
                  >
                    {r.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {added !== null && (
            <p role="status" className="pop-in flex items-center gap-2 rounded-2xl bg-success-soft p-3 text-sm font-medium text-success">
              <CalendarCheck2 size={16} className="shrink-0" aria-hidden />
              <span>
                Añadida a tu horario ({added} {added === 1 ? "bloque" : "bloques"}).{" "}
                <Link href="/schedule" className="underline">
                  Ver horario
                </Link>
              </span>
            </p>
          )}

          {scheduleReady ? (
            <Button className="w-full" size="lg" onClick={() => setAdding(true)}>
              <CalendarPlus size={18} /> Añadir a mi horario
            </Button>
          ) : (
            <p className="text-center text-sm text-muted">El horario se está activando; pronto podrás añadir ideas.</p>
          )}
        </div>
      )}
    </Modal>
  );
}
