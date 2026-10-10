"use client";

import "./ideas.css";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, Clock, Coins, Link2, Search, Shuffle, Sparkles, Star, TrendingUp, X } from "lucide-react";
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
import { Card } from "@/components/ui/card";
import { Input, Select } from "@/components/ui/form";
import { BlockForm } from "@/components/schedule/block-form";

const AREA_BY_KEY = new Map(AREAS.map((a) => [a.key, a]));
const GOLD_COUNT = IDEAS.filter(isGold).length;
const PAGE = 48;

function Dots({ value, label }: { value: number; label: string }) {
  return (
    <span className="inline-flex gap-0.5" aria-label={`${label}: ${value} de 5`} role="img">
      {[1, 2, 3, 4, 5].map((n) => (
        <span key={n} className={cn("h-1.5 w-1.5 rounded-full", n <= value ? "bg-current" : "bg-current opacity-20")} />
      ))}
    </span>
  );
}

function Tone({ idea }: { idea: Idea }) {
  const gold = isGold(idea);
  const key = isKeyLevel(idea);
  if (!gold && !key) return null;
  return (
    <span className="flex shrink-0 flex-wrap justify-end gap-1">
      {gold && (
        <span className="inline-flex items-center gap-1 rounded-full bg-gradient-to-r from-amber-300 to-amber-500 px-2 py-0.5 text-[11px] font-bold text-amber-950">
          <Sparkles size={11} /> Dorada
        </span>
      )}
      {key && <span className="rounded-full bg-teal-500/15 px-2 py-0.5 text-[11px] font-bold text-teal-600 dark:text-teal-300">Nivel clave {idea.level}</span>}
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
  const [area, setArea] = useState<IdeaArea | null>(AREA_BY_KEY.has(initialArea as IdeaArea) ? (initialArea as IdeaArea) : null);
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [duration, setDuration] = useState<DurationBucket | null>(null);
  const [minFuture, setMinFuture] = useState<number | null>(null);
  const [goldOnly, setGoldOnly] = useState(false);
  const [sort, setSort] = useState<IdeaSort>("value");
  const [seed, setSeed] = useState(7);
  const [limit, setLimit] = useState(PAGE);
  const [open, setOpen] = useState<Idea | null>(initialIdea ? (IDEA_BY_KEY.get(initialIdea) ?? null) : null);

  const list = useMemo(() => filterIdeas({ q, area, difficulty, duration, minFuture, goldOnly, sort }), [q, area, difficulty, duration, minFuture, goldOnly, sort]);
  const cloud = useMemo(() => floatingSample(list, 18, seed), [list, seed]);
  const filtered = !!(q || area || difficulty || duration || minFuture || goldOnly);
  const reset = () => {
    setQ("");
    setArea(null);
    setDifficulty(null);
    setDuration(null);
    setMinFuture(null);
    setGoldOnly(false);
    setLimit(PAGE);
  };

  return (
    <div className="space-y-6">
      <section className="card-glass relative overflow-hidden rounded-[32px] p-6 sm:p-8">
        <div className="animate-glow pointer-events-none absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-amber-300/50 via-accent-2/25 to-ring-habits/20 blur-3xl" aria-hidden />
        <div className="relative flex flex-wrap items-end justify-between gap-4">
          <div className="min-w-0">
            <h1 className="text-[34px] font-bold leading-[1.05] tracking-tight sm:text-[44px]">
              Ideas para <span className="gold-text">crecer</span>
            </h1>
            <p className="mt-2 max-w-xl text-[15px] text-muted">
              {IDEAS.length} habilidades, libros, idiomas y hábitos para inspirarte. Las <span className="font-semibold text-amber-600 dark:text-amber-400">doradas</span> son las que más te pueden dar. Elige una y ponla en tu horario.
            </p>
          </div>
          <Button variant="secondary" onClick={() => setSeed((s) => s + 1)}>
            <Shuffle size={16} /> Barajar
          </Button>
        </div>

        <div className="relative mt-6 flex min-h-[220px] flex-wrap content-center items-center justify-center gap-x-3 gap-y-4 py-2" data-testid="idea-cloud">
          {cloud.length === 0 && <p className="text-sm text-muted">Ninguna idea con estos filtros.</p>}
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
                  "idea-bubble max-w-full rounded-full border px-3.5 py-2 text-[13px] font-semibold shadow-float sm:px-4",
                  i >= 10 && "max-sm:hidden",
                  gold ? "idea-gold sm:text-[15px]" : key ? "idea-key sm:text-sm" : "glass border-border sm:text-sm",
                )}
                style={
                  {
                    "--t": `${5 + ((i * 7) % 5)}s`,
                    "--d": `${-((i * 13) % 7)}s`,
                    "--dx": `${((i % 3) - 1) * 5}px`,
                    "--dy": `${-6 - (i % 4) * 3}px`,
                  } as React.CSSProperties
                }
              >
                <span aria-hidden className="mr-1.5">
                  {gold ? "✨" : a.emoji}
                </span>
                {idea.title}
              </button>
            );
          })}
        </div>
        <p className="relative mt-2 text-center text-xs text-muted">
          <span className="font-semibold text-amber-600 dark:text-amber-400">Dorada</span>: utilidad futura 5/5 y potencial económico 4 o 5 · {GOLD_COUNT} en total ·{" "}
          <span className="font-semibold text-teal-600 dark:text-teal-300">Turquesa</span>: niveles de idioma B1 y B2, los más útiles por esfuerzo
        </p>
      </section>

      <Card className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative min-w-[200px] flex-1">
            <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <Input value={q} onChange={(e) => (setQ(e.target.value), setLimit(PAGE))} placeholder="Buscar: CSS, chino, carpintería, estoicismo…" className="pl-9" aria-label="Buscar ideas" />
          </div>
          <Select value={sort} onChange={(e) => setSort(e.target.value as IdeaSort)} className="w-auto" aria-label="Ordenar">
            <option value="value">Más valiosas primero</option>
            <option value="quick">Más rápidas primero</option>
            <option value="easy">Más fáciles primero</option>
            <option value="az">A – Z</option>
          </Select>
          <button
            type="button"
            aria-pressed={goldOnly}
            onClick={() => (setGoldOnly((g) => !g), setLimit(PAGE))}
            className={cn("press inline-flex h-10 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold", goldOnly ? "idea-gold" : "border-border bg-surface")}
          >
            <Sparkles size={15} /> Solo doradas
          </button>
        </div>

        <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" aria-label="Áreas">
          <button type="button" onClick={() => setArea(null)} className={cn("press shrink-0 rounded-full px-3 py-1.5 text-sm font-medium", !area ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}>
            Todas
          </button>
          {AREAS.map((a) => (
            <button
              key={a.key}
              type="button"
              aria-pressed={area === a.key}
              onClick={() => (setArea(area === a.key ? null : a.key), setLimit(PAGE))}
              className={cn("press shrink-0 rounded-full px-3 py-1.5 text-sm font-medium", area === a.key ? "text-white" : "bg-surface-2 text-muted hover:text-text")}
              style={area === a.key ? { background: a.color } : undefined}
            >
              {a.emoji} {a.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-3 text-sm">
          <div className="flex items-center gap-1.5">
            <span className="text-muted">Dificultad</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-pressed={difficulty === n}
                onClick={() => (setDifficulty(difficulty === n ? null : n), setLimit(PAGE))}
                className={cn("press h-8 w-8 rounded-full text-sm font-semibold", difficulty === n ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}
              >
                {n}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-muted">Duración</span>
            {DURATIONS.map((d) => (
              <button
                key={d.key}
                type="button"
                aria-pressed={duration === d.key}
                onClick={() => (setDuration(duration === d.key ? null : d.key), setLimit(PAGE))}
                className={cn("press rounded-full px-3 py-1.5 text-xs font-medium", duration === d.key ? "bg-accent text-accent-fg" : "bg-surface-2 text-muted")}
              >
                {d.label}
              </button>
            ))}
          </div>
          <label className="flex items-center gap-1.5">
            <span className="text-muted">Utilidad futura</span>
            <Select value={minFuture ?? ""} onChange={(e) => setMinFuture(e.target.value ? Number(e.target.value) : null)} className="h-8 w-auto" aria-label="Utilidad futura mínima">
              <option value="">Cualquiera</option>
              <option value="3">3 o más</option>
              <option value="4">4 o más</option>
              <option value="5">Solo 5</option>
            </Select>
          </label>
          {filtered && (
            <button type="button" onClick={reset} className="inline-flex items-center gap-1 text-xs text-accent hover:underline">
              <X size={12} /> Quitar filtros
            </button>
          )}
        </div>
      </Card>

      {area === "lenguas" && (
        <Card className="text-sm">
          <p className="mb-2 font-semibold">Niveles del Marco Común Europeo (MCER)</p>
          <ul className="grid gap-1.5 sm:grid-cols-2">
            {CEFR_LEVELS.map((l) => (
              <li key={l} className="flex gap-2">
                <span className={cn("w-8 shrink-0 font-bold", l === "B1" || l === "B2" ? "text-teal-600 dark:text-teal-300" : "")}>{l}</span>
                <span className="text-muted">
                  {CEFR_LABEL[l]} · ≈ {CEFR_HOURS[l]} h en inglés
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-3 text-xs text-muted">
            Horas orientativas desde cero. Base: guía de horas de aprendizaje guiado de Cambridge English; para otros idiomas se ajusta según la dificultad relativa que publica el Foreign Service Institute (FSI). Cada persona avanza a su ritmo.
          </p>
        </Card>
      )}

      <div>
        <p className="mb-3 text-sm text-muted" aria-live="polite">
          {list.length} {list.length === 1 ? "idea" : "ideas"}
        </p>
        <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3" data-testid="idea-list">
          {list.slice(0, limit).map((idea) => {
            const a = AREA_BY_KEY.get(idea.area)!;
            return (
              <li key={idea.key}>
                <button
                  type="button"
                  onClick={() => setOpen(idea)}
                  className={cn("lift card-glass flex h-full w-full flex-col gap-2 rounded-[20px] p-4 text-left", isGold(idea) && "ring-2 ring-amber-400/70", !isGold(idea) && isKeyLevel(idea) && "ring-2 ring-teal-400/60")}
                >
                  <span className="flex items-start justify-between gap-2">
                    <span className="text-[15px] font-semibold leading-snug">{idea.title}</span>
                    <Tone idea={idea} />
                  </span>
                  <span className="text-xs" style={{ color: a.color }}>
                    {a.emoji} {a.label}
                  </span>
                  <span className="mt-auto grid grid-cols-2 gap-x-3 gap-y-1 text-xs text-muted">
                    <span className="flex items-center gap-1.5">
                      Dificultad <Dots value={idea.difficulty} label="Dificultad" />
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock size={12} /> ≈ {formatHours(idea.hours)}
                    </span>
                    <span className="flex items-center gap-1.5">
                      Futuro <Dots value={idea.future} label="Utilidad futura" />
                    </span>
                    <span className="flex items-center gap-1.5">
                      Dinero <Dots value={idea.money} label="Potencial económico" />
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
        {list.length > limit && (
          <div className="mt-4 text-center">
            <Button variant="secondary" onClick={() => setLimit((l) => l + PAGE)}>
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

  return (
    <Modal open onClose={onClose} title={adding ? "Añadir a mi horario" : idea.title} sheet className="sm:max-w-xl">
      {adding ? (
        <div className="max-h-[70dvh] overflow-y-auto">
          <p className="mb-3 text-sm text-muted">Elige los días y la hora de cada uno. No tiene que ser la misma hora todos los días.</p>
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
        <div className="max-h-[72dvh] space-y-5 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium" style={{ color: a.color }}>
              {a.emoji} {a.label}
            </span>
            <Tone idea={idea} />
            {idea.level && <span className="text-xs text-muted">MCER {idea.level}: {CEFR_LABEL[idea.level]}</span>}
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              { icon: <Star size={14} />, label: "Dificultad", value: `${idea.difficulty}/5` },
              { icon: <Clock size={14} />, label: "Duración total", value: `≈ ${formatHours(idea.hours)}` },
              { icon: <TrendingUp size={14} />, label: "Utilidad futura", value: `${idea.future}/5` },
              { icon: <Coins size={14} />, label: "Para ganar dinero", value: `${idea.money}/5` },
            ].map((m) => (
              <div key={m.label} className="rounded-2xl bg-surface-2 p-3">
                <p className="flex items-center gap-1 text-[11px] text-muted">
                  {m.icon} {m.label}
                </p>
                <p className="mt-1 text-lg font-bold tabular">{m.value}</p>
              </div>
            ))}
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold">Cómo empezar</p>
            <p className="text-[15px] leading-relaxed">{idea.how}</p>
          </div>

          <div className="rounded-2xl border border-border p-3 text-sm">
            <p className="mb-1 font-semibold">¿Cuánto tardarías?</p>
            {weeks ? (
              <p>
                Con lo que tienes en tu horario ({formatHours(Math.round((perWeek / 60) * 10) / 10)} a la semana) terminarías en unas <b>{weeks} semanas</b>.
              </p>
            ) : (
              <ul className="space-y-0.5 text-muted">
                {[2, 5, 10].map((h) => (
                  <li key={h}>
                    {h} h por semana → unas <b className="text-text">{Math.ceil(idea.hours / h)} semanas</b>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {mine.length > 0 && (
            <div className="text-sm">
              <p className="mb-1 font-semibold">Ya está en tu horario</p>
              <ul className="flex flex-wrap gap-1.5">
                {mine.map((b) => (
                  <li key={b.id} className="rounded-full bg-accent-soft px-2.5 py-1 text-xs text-accent tabular">
                    {WEEKDAY_NAME[b.day_of_week]} {formatTime(b.start_minute)}–{formatTime(b.end_minute)}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {related.length > 0 && (
            <div>
              <p className="mb-1.5 flex items-center gap-1 text-sm font-semibold">
                <Link2 size={14} /> Se complementa con
              </p>
              <div className="flex flex-wrap gap-1.5">
                {related.map((r) => (
                  <button key={r.key} type="button" onClick={() => onOpen(r)} className={cn("press rounded-full border px-2.5 py-1 text-xs", isGold(r) ? "idea-gold" : isKeyLevel(r) ? "idea-key" : "border-border bg-surface hover:border-accent")}>
                    {r.title}
                  </button>
                ))}
              </div>
            </div>
          )}

          {added !== null && (
            <p role="status" className="rounded-2xl bg-success-soft p-3 text-sm font-medium text-success">
              Añadida a tu horario ({added} {added === 1 ? "bloque" : "bloques"}). <Link href="/schedule" className="underline">Ver horario</Link>
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
