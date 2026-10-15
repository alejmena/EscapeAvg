"use client";

import "./ideas.css";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, CalendarCheck2, CalendarPlus, Clock, Coins, Gauge, Languages, Lightbulb, Link2, Search, Shuffle, Sparkles, Star, TrendingUp, X } from "lucide-react";
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
const GOLD_COUNT = IDEAS.filter(isGold).length;
const PAGE = 48;
const MAX_CEFR = Math.max(...CEFR_LEVELS.map((l) => CEFR_HOURS[l]));

// Destellos decorativos de la tarjeta destacada (posición en %, duración y retraso).
const SPARKS = [
  [6, 18, 3.2, 0],
  [14, 78, 4.1, -1.2],
  [31, 8, 3.6, -2.1],
  [48, 92, 2.8, -0.6],
  [66, 12, 3.9, -1.8],
  [82, 70, 3.1, -2.6],
  [93, 26, 4.4, -0.3],
  [74, 44, 3.4, -1.4],
] as const;

// Colores de cada valoración: tokens del sistema.
const METER = {
  difficulty: "var(--accent)",
  future: "var(--success)",
  money: "var(--gold)",
};

/** Valoración de 1 a 5 como segmentos de color. */
function Dots({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${label}: ${value} de 5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className="h-1.5 w-3 rounded-full" style={{ background: n <= value ? color : "var(--surface-3)" }} />
      ))}
    </span>
  );
}

/** Distintivos: dorada y nivel clave de idioma. */
function Marks({ idea }: { idea: Idea }) {
  const gold = isGold(idea);
  const key = isKeyLevel(idea);
  if (!gold && !key) return null;
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      {gold && (
        <span className="idea-badge-gold inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold">
          <Sparkles size={11} aria-hidden /> Dorada
        </span>
      )}
      {key && <span className="idea-badge-key rounded-full px-2 py-0.5 text-[11px] font-bold">Nivel clave {idea.level}</span>}
    </span>
  );
}

/** Color legible del área sobre la superficie (más oscuro en claro, más claro en oscuro). */
const areaInk = (color: string) => `color-mix(in srgb, ${color} 72%, var(--text))`;

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
  const [area, setArea] = useState<IdeaArea | null>(AREA_BY_KEY.has(initialArea as IdeaArea) ? (initialArea as IdeaArea) : null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [duration, setDuration] = useState<DurationBucket | null>(null);
  const [minFuture, setMinFuture] = useState<number | null>(null);
  const [goldOnly, setGoldOnly] = useState(false);
  const [sort, setSort] = useState<IdeaSort>("value");
  const [seed, setSeed] = useState(7);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Idea | null>(initialIdea ? (IDEA_BY_KEY.get(initialIdea) ?? null) : null);
  const searchRef = useRef<HTMLInputElement>(null);

  const list = useMemo(() => filterIdeas({ q, area, difficulty, duration, minFuture, goldOnly, sort }), [q, area, difficulty, duration, minFuture, goldOnly, sort]);
  const cloud = useMemo(() => floatingSample(list, 18, seed), [list, seed]);
  const filtered = !!(q || area || difficulty || duration || minFuture || goldOnly);
  const mineCount = useMemo(() => new Set((blocks ?? []).map((b) => b.idea_key).filter(Boolean)).size, [blocks]);
  const reset = () => {
    setQ("");
    setArea(null);
    setDifficulty(null);
    setDuration(null);
    setMinFuture(null);
    setGoldOnly(false);
    setLimit(PAGE);
  };

  // Atajo: "/" lleva a la búsqueda.
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
    <div className="space-y-6">
      <PageHeader
        title="Ideas para crecer"
        subtitle={
          <>
            {IDEAS.length.toLocaleString("es-MX")} ideas de habilidades, proyectos, libros, idiomas y hábitos para inspirarte. Las <span className="gold-text font-semibold">doradas</span> son las que más te pueden dar. Elige una y ponla en tu horario.
          </>
        }
        action={
          mineCount > 0 ? (
            <Link href="/schedule" className="press inline-flex h-10 items-center gap-2 rounded-full border border-border bg-surface/80 px-4 text-sm font-semibold shadow-soft hover:border-border-strong">
              <CalendarCheck2 size={16} className="text-tone-ink" /> {mineCount} en tu horario
            </Link>
          ) : undefined
        }
      />

      {/* Protagonista: la nube de ideas */}
      <Card variant="feature" className="p-5 sm:p-7">
        {SPARKS.map(([x, y, t, d], i) => (
          <Sparkles
            key={i}
            size={i % 3 === 0 ? 14 : 10}
            className="idea-spark pointer-events-none absolute text-white"
            style={{ left: `${x}%`, top: `${y}%`, "--t": `${t}s`, "--d": `${d}s` } as React.CSSProperties}
            aria-hidden
          />
        ))}
        <div className="relative flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/80">Para inspirarte</p>
            <h2 className="mt-0.5 font-display text-[22px] font-bold leading-tight sm:text-[26px]">
              {filtered ? "Una muestra de tu búsqueda" : "Una nube de posibilidades"}
            </h2>
          </div>
          <Button variant="secondary" onClick={() => setSeed((s) => s + 1)} className="backdrop-blur">
            <Shuffle size={16} /> Barajar
          </Button>
        </div>

        <div className="relative mt-5 flex min-h-[230px] flex-wrap content-center items-center justify-center gap-x-2.5 gap-y-3.5 py-2" data-testid="idea-cloud">
          {cloud.length === 0 && <p className="text-sm text-white/85">Ninguna idea con estos filtros.</p>}
          {cloud.map((idea, i) => {
            const gold = isGold(idea);
            const key = isKeyLevel(idea);
            const a = AREA_BY_KEY.get(idea.area)!;
            return (
              <button
                key={`${seed}-${idea.key}`}
                type="button"
                onClick={() => setOpen(idea)}
                className={cn(
                  "idea-bubble inline-flex max-w-full items-center gap-2 rounded-full border py-1 pl-1 pr-3 text-[12.5px] font-semibold sm:py-1.5 sm:pl-1.5 sm:pr-4 sm:text-[13px]",
                  i >= 8 && "max-sm:hidden",
                  gold ? "idea-gold sm:text-[15px]" : key ? "idea-key sm:text-sm" : "idea-glass sm:text-sm",
                )}
                style={
                  {
                    "--t": `${5 + ((i * 7) % 5)}s`,
                    "--d": `${-((i * 13) % 7)}s`,
                    "--dx": `${((i % 3) - 1) * 5}px`,
                    "--dy": `${-6 - (i % 4) * 3}px`,
                    "--in": `${i * 35}ms`,
                  } as React.CSSProperties
                }
              >
                <span aria-hidden className={cn("idea-emoji grid h-6 w-6 shrink-0 place-items-center rounded-full text-[13px] sm:h-7 sm:w-7 sm:text-[14px]", (gold || key) && "bg-white/45")}>
                  {gold ? "✨" : a.emoji}
                </span>
                <span className="truncate">{idea.title}</span>
              </button>
            );
          })}
        </div>
        <div className="relative mt-3 flex flex-col items-start gap-1.5 text-xs text-white/90 sm:flex-row sm:flex-wrap sm:items-center sm:justify-center sm:gap-x-4">
          <span className="inline-flex items-center gap-2">
            <span className="idea-badge-gold shrink-0 rounded-full px-2 py-0.5 font-bold">Dorada</span>
            <span>utilidad futura 5/5 y potencial económico 4 o 5 · {GOLD_COUNT} en total</span>
          </span>
          <span className="inline-flex items-center gap-2">
            <span className="idea-key shrink-0 rounded-full border px-2 py-0.5 font-bold">Turquesa</span>
            <span>niveles de idioma B1 y B2, los más útiles por esfuerzo</span>
          </span>
        </div>
      </Card>

      {/* Búsqueda y filtros */}
      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative min-w-[220px] flex-1">
            <span className="tone-chip pointer-events-none absolute left-2 top-1/2 z-10 h-9 w-9 -translate-y-1/2 rounded-xl">
              <Search size={17} aria-hidden />
            </span>
            <Input
              ref={searchRef}
              value={q}
              onChange={(e) => (setQ(e.target.value), setLimit(PAGE))}
              placeholder="Buscar: CSS, chino, carpintería, estoicismo…"
              className="h-13 rounded-2xl! pl-14! pr-11! text-[15px]!"
              aria-label="Buscar ideas"
            />
            {q ? (
              <button type="button" onClick={() => (setQ(""), searchRef.current?.focus())} className="press absolute right-2.5 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-surface-2 text-muted hover:bg-surface-3 hover:text-text" aria-label="Borrar búsqueda">
                <X size={15} />
              </button>
            ) : (
              <kbd className="pointer-events-none absolute right-3.5 top-1/2 hidden h-6 min-w-6 -translate-y-1/2 place-items-center rounded-md border border-border bg-surface-2 px-1.5 font-sans text-xs font-semibold text-muted sm:grid" aria-hidden>
                /
              </kbd>
            )}
          </div>
          <Select value={sort} onChange={(e) => setSort(e.target.value as IdeaSort)} className="h-13 w-auto rounded-2xl! font-medium" aria-label="Ordenar">
            <option value="value">Más valiosas primero</option>
            <option value="quick">Más rápidas primero</option>
            <option value="easy">Más fáciles primero</option>
            <option value="az">A – Z</option>
          </Select>
          <button
            type="button"
            aria-pressed={goldOnly}
            onClick={() => (setGoldOnly((g) => !g), setLimit(PAGE))}
            className={cn("press inline-flex h-13 items-center gap-1.5 rounded-2xl border px-4 text-sm font-semibold transition-colors", goldOnly ? "idea-gold" : "border-border bg-surface/90 hover:border-border-strong")}
          >
            <Sparkles size={15} className={goldOnly ? undefined : "text-[var(--gold)]"} /> Solo doradas
          </button>
        </div>

        <div className="idea-scroll-fade -mx-1 flex gap-1.5 overflow-x-auto px-1 py-1" aria-label="Áreas">
          <button
            type="button"
            aria-pressed={!area}
            onClick={() => setArea(null)}
            className={cn("press shrink-0 rounded-full px-3.5 py-1.5 text-sm font-semibold transition-colors", !area ? "tone-chip" : "bg-surface-2/80 text-muted hover:text-text")}
          >
            Todas
          </button>
          {AREAS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={area === a.key}
              onClick={() => (setArea(area === a.key ? null : a.key), setLimit(PAGE))}
              className="idea-area press shrink-0 rounded-full bg-surface-2/80 px-3.5 py-1.5 text-sm font-medium text-muted"
              style={{ "--a": a.color } as React.CSSProperties}
            >
              <span>{a.emoji}</span> {a.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <div className="flex min-w-0 items-center gap-2">
            <span className="text-xs font-semibold text-muted">Dificultad</span>
            <div className="seg">
              {[1, 2, 3, 4, 5].map((n) => (
                <button key={n} type="button" aria-pressed={difficulty === n} onClick={() => (setDifficulty(difficulty === n ? null : n), setLimit(PAGE))} className="press w-8 justify-center px-0!">
                  {n}
                </button>
              ))}
            </div>
          </div>
          <div className="flex min-w-0 max-w-full items-center gap-2">
            <span className="shrink-0 text-xs font-semibold text-muted">Duración</span>
            <div className="seg max-w-full overflow-x-auto">
              {DURATIONS.map((d) => (
                <button key={d.key} type="button" aria-pressed={duration === d.key} onClick={() => (setDuration(duration === d.key ? null : d.key), setLimit(PAGE))} className="press px-2.5! text-xs!">
                  {d.label}
                </button>
              ))}
            </div>
          </div>
          <label className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted">Utilidad futura</span>
            <Select value={minFuture ?? ""} onChange={(e) => setMinFuture(e.target.value ? Number(e.target.value) : null)} className="h-9 w-auto rounded-full! text-[13px]" aria-label="Utilidad futura mínima">
              <option value="">Cualquiera</option>
              <option value="3">3 o más</option>
              <option value="4">4 o más</option>
              <option value="5">Solo 5</option>
            </Select>
          </label>
          {filtered && (
            <button type="button" onClick={reset} className="press inline-flex items-center gap-1 rounded-full bg-tone-soft px-3 py-1.5 text-xs font-semibold text-tone-ink hover:brightness-95">
              <X size={12} /> Quitar filtros
            </button>
          )}
        </div>
      </Card>

      {area === "lenguas" && (
        <Card variant="tint" tone="teal" className="text-sm">
          <CardTitle icon={<Languages />} subtitle="Horas orientativas desde cero, en inglés">
            Niveles del Marco Común Europeo (MCER)
          </CardTitle>
          <ul className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {CEFR_LEVELS.map((l) => {
              const key = l === "B1" || l === "B2";
              return (
                <li key={l} className={cn("flex flex-col rounded-2xl p-3", key ? "bg-tone-soft ring-1 ring-tone/40" : "bg-surface-2/60")}>
                  <span className={cn("font-display text-xl font-bold", key && "text-tone-ink")}>{l}</span>
                  <span className="text-xs text-muted">{CEFR_LABEL[l]}</span>
                  <span className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3">
                    <span className="bar-in block h-full rounded-full bg-gradient-to-r from-tone to-tone-2" style={{ width: `${(CEFR_HOURS[l] / MAX_CEFR) * 100}%` }} />
                  </span>
                  <span className="mt-1 text-xs font-semibold tabular">≈ {CEFR_HOURS[l]} h en inglés</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Horas orientativas desde cero. Base: guía de horas de aprendizaje guiado de Cambridge English; para otros idiomas se ajusta según la dificultad relativa que publica el Foreign Service Institute (FSI). Cada persona avanza a su ritmo.
          </p>
        </Card>
      )}

      <div>
        <div className="mb-4 flex items-end justify-between gap-3">
          <p className="flex items-baseline gap-2" aria-live="polite">
            <span className="num-xl text-[32px]">{list.length}</span>
            <span className="text-sm font-medium text-muted">{list.length === 1 ? "idea" : "ideas"}</span>
          </p>
          {area && (
            <span className="text-sm font-semibold" style={{ color: areaInk(AREA_BY_KEY.get(area)!.color) }}>
              {AREA_BY_KEY.get(area)!.emoji} {AREA_BY_KEY.get(area)!.label}
            </span>
          )}
        </div>
        {list.length === 0 && (
          <EmptyState icon={<Lightbulb />} title="Ninguna idea con estos filtros" action={<Button variant="secondary" onClick={reset}>Ver todas</Button>}>
            Prueba con otra palabra o quita algún filtro: hay {IDEAS.length} ideas esperándote.
          </EmptyState>
        )}
        <ul className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3" data-testid="idea-list">
          {list.slice(0, limit).map((idea, i) => {
            const a = AREA_BY_KEY.get(idea.area)!;
            const gold = isGold(idea);
            const key = !gold && isKeyLevel(idea);
            return (
              <li key={idea.key} data-reveal={(i % 3) * 60 || ""}>
                <button
                  type="button"
                  onClick={() => setOpen(idea)}
                  className={cn("idea-card lift card-glass group relative flex h-full w-full flex-col gap-3 overflow-hidden rounded-[22px] p-4 text-left", gold && "idea-card-gold", key && "idea-card-key")}
                  style={{ "--a": a.color } as React.CSSProperties}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl text-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6" style={{ background: `color-mix(in srgb, ${a.color} 16%, transparent)` }} aria-hidden>
                      {a.emoji}
                    </span>
                    <Marks idea={idea} />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-display text-[16px] font-semibold leading-snug">{idea.title}</span>
                    <span className="mt-1 block text-xs font-semibold" style={{ color: areaInk(a.color) }}>
                      {a.label}
                    </span>
                  </span>
                  <span className="mt-auto grid grid-cols-3 gap-2 text-[11px] text-muted">
                    <span className="flex flex-col gap-1">
                      Dificultad <Dots value={idea.difficulty} label="Dificultad" color={METER.difficulty} />
                    </span>
                    <span className="flex flex-col gap-1">
                      Futuro <Dots value={idea.future} label="Utilidad futura" color={METER.future} />
                    </span>
                    <span className="flex flex-col gap-1">
                      Dinero <Dots value={idea.money} label="Potencial económico" color={METER.money} />
                    </span>
                  </span>
                  <span className="flex items-center justify-between border-t border-border pt-2.5 text-xs">
                    <span className="inline-flex items-center gap-1 font-semibold text-text tabular">
                      <Clock size={12} className="text-muted" aria-hidden /> ≈ {formatHours(idea.hours)}
                    </span>
                    <span className="inline-flex items-center gap-1 font-semibold text-tone-ink opacity-0 transition-[opacity,transform] duration-300 group-hover:translate-x-0.5 group-hover:opacity-100 [@media(hover:none)]:opacity-100" aria-hidden>
                      Ver <ArrowRight size={12} />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {list.length > limit && (
          <div className="mt-6 text-center">
            <Button variant="secondary" size="lg" onClick={() => setLimit((l) => l + PAGE)}>
              Ver más ({list.length - limit} restantes)
            </Button>
          </div>
        )}
        <p className="mt-6 text-center text-xs text-muted">Dificultad, utilidad futura y potencial económico son valoraciones orientativas de Escape AVG para ayudarte a elegir, no datos medidos.</p>
      </div>

      {open && <IdeaDetail key={open.key} idea={open} blocks={blocks} scheduleReady={scheduleReady} onOpen={setOpen} onClose={() => setOpen(null)} />}
    </div>
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
                {idea.level && <span className="text-xs text-muted">MCER {idea.level}: {CEFR_LABEL[idea.level]}</span>}
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
                <span className="pointer-events-none absolute -right-5 -top-5 h-14 w-14 rounded-full opacity-20 blur-xl" style={{ background: m.color }} aria-hidden />
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
                        <span className="bar-in block h-full rounded-full bg-gradient-to-r from-tone to-tone-2" style={{ width: `${Math.max(4, (w / slowest) * 100)}%` }} />
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
                    className={cn("press rounded-full border px-3 py-1.5 text-xs font-medium transition-colors", isGold(r) ? "idea-gold" : isKeyLevel(r) ? "idea-key" : "border-border bg-surface hover:border-tone hover:bg-tone-soft hover:text-tone-ink")}
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
                Añadida a tu horario ({added} {added === 1 ? "bloque" : "bloques"}). <Link href="/schedule" className="underline">Ver horario</Link>
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
