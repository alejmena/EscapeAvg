import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowDown,
  ArrowRight,
  Ban,
  BedDouble,
  BookOpen,
  BookOpenText,
  Briefcase,
  Code2,
  Crown,
  Dumbbell,
  Flag,
  GraduationCap,
  Info,
  Languages,
  Library,
  Palette,
  Rocket,
  Settings,
  Star,
  Swords,
  Timer,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getFavoriteQuoteIds, isDisciplineReady, dailyGoal } from "@/lib/data/discipline";
import { goalLabel, rankLabel, RANKS, SYMBOLIC_NOTE } from "@/lib/domain/discipline";
import { QUOTES, quoteOfDay, type Quote } from "@/lib/domain/quotes";
import { REFERENCES } from "@/lib/domain/references";
import { formatDuration } from "@/lib/domain/stats";
import { QuoteCard } from "@/components/discipline/quote-card";
import { Badge, EmptyState } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Filosofía" };

const PRINCIPLES = [
  { title: "Horas con propósito", icon: Timer, text: "Cuenta el tiempo que te desarrolla: estudio, lectura, idiomas, programación, ejercicio, proyectos y cultura con intención de aprender." },
  { title: "La meta tiene un final", icon: Flag, text: "Cuando cumples tu objetivo, la app te lo dice claro: hoy hiciste lo suficiente. No mueve la meta ni te pide más." },
  { title: "El descanso es progreso", icon: BedDouble, text: "Los días de descanso no rompen rachas. Recuperarte es lo que permite sostener la disciplina durante años." },
  { title: "Tú contra ti mismo", icon: Swords, text: "Tu referencia es tu propio historial: ayer, tu media y tu mejor día. El único promedio que hay que superar es el tuyo." },
];

const COUNTS = [
  { text: "Estudio académico y aprendizaje", icon: GraduationCap },
  { text: "Lectura educativa, científica, filosófica o histórica", icon: BookOpen },
  { text: "Idiomas", icon: Languages },
  { text: "Programación, tecnología y habilidades prácticas", icon: Code2 },
  { text: "Ejercicio y entrenamiento físico", icon: Dumbbell },
  { text: "Proyectos personales", icon: Rocket },
  { text: "Habilidades profesionales o económicas", icon: Briefcase },
  { text: "Cultura con objetivo de aprendizaje", icon: Palette },
];

const FILTERS = [
  { id: "all", label: "Todas", glyph: null },
  { id: "china", label: "China", glyph: "中" },
  { id: "rusia", label: "Rusia", glyph: "Я" },
  { id: "fav", label: "Favoritas", glyph: null },
] as const;

// Máximo de la escalera (13 h o más) y de las referencias (en minutos), para las barras.
const LADDER_TOP = RANKS[RANKS.length - 1].minHours + 1;
const REF_TOP = Math.max(...REFERENCES.map((r) => r.minutes));

// Frases por página: la colección es larga, se muestran por tandas con «Ver más».
const PAGE = 24;

export default async function PhilosophyPage({ searchParams }: { searchParams: Promise<{ f?: string; n?: string }> }) {
  const { f, n } = await searchParams;
  const filter = FILTERS.some((x) => x.id === f) ? (f as (typeof FILTERS)[number]["id"]) : "all";
  const { supabase, today, profile } = await requireUser();
  const ready = await isDisciplineReady(supabase);
  const favorites = await getFavoriteQuoteIds(supabase, ready);
  const favSet = new Set(favorites);
  const daily = quoteOfDay(today);
  const goal = ready ? dailyGoal(profile) : 660;

  const chinaCount = QUOTES.filter((q) => q.origin === "china").length;
  const russiaCount = QUOTES.filter((q) => q.origin === "rusia").length;

  const list: Quote[] =
    filter === "fav"
      ? (favorites.map((id) => QUOTES.find((q) => q.id === id)).filter(Boolean) as Quote[])
      : QUOTES.filter((q) => filter === "all" || q.origin === filter);
  const shown = Math.min(list.length, Math.max(PAGE, Math.floor(Number(n) / PAGE) * PAGE || PAGE));
  const moreHref = `/philosophy?${filter === "all" ? "" : `f=${filter}&`}n=${shown + PAGE}#mas-frases`;

  return (
    <div className="stagger space-y-10 sm:space-y-14">
      {/* Portada editorial: el manifiesto. */}
      <section className="card-feature relative overflow-hidden rounded-[34px] px-6 py-8 sm:px-12 sm:py-14">
        <div className="animate-glow pointer-events-none absolute -right-24 -top-28 h-96 w-96 rounded-full bg-[var(--tone-2)] opacity-50 blur-3xl" aria-hidden />
        <span
          className="pointer-events-none absolute -bottom-10 right-2 select-none font-display text-[120px] font-extrabold leading-none tracking-tighter text-white/[0.09] sm:-bottom-16 sm:text-[220px]"
          aria-hidden
        >
          0.0001
        </span>
        <div className="relative max-w-3xl [text-shadow:0_1px_2px_rgb(0_0_0/0.12)]">
          <div className="flex flex-wrap items-center gap-3">
            <span className="tone-chip-soft h-10 w-10 rounded-[14px]">
              <BookOpenText size={20} aria-hidden />
            </span>
            <p className="wordmark text-xs">ESCAPE AVG</p>
            <span className="rounded-full border border-border px-2.5 py-0.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-muted">Manifiesto</span>
          </div>
          <h1 className="mt-6 text-[46px] font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-[76px] lg:text-[88px]">
            Escapar del{" "}
            <span className="relative inline-block whitespace-nowrap">
              <span className="relative z-10">promedio</span>
              {/* Subrayado a mano alzada. */}
              <svg className="absolute -bottom-2 left-0 z-0 h-4 w-full text-white/45 sm:-bottom-3 sm:h-6" viewBox="0 0 300 24" preserveAspectRatio="none" aria-hidden>
                <path d="M4 16 C 60 6, 120 4, 180 10 S 270 18, 296 8" fill="none" stroke="currentColor" strokeWidth="7" strokeLinecap="round" />
              </svg>
            </span>
            .
          </h1>
          <p className="mt-7 max-w-2xl font-display text-[21px] font-semibold leading-snug sm:text-[27px]">
            No estás aquí para estar ocupado. Estás aquí para convertirte en alguien extraordinariamente preparado.
          </p>
          <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted">
            <span className="font-semibold text-text">El 0.0001 %</span> es una idea, no una estadística: el nivel de disciplina de quien usa
            conscientemente su tiempo para desarrollar conocimiento, capacidad intelectual, habilidades, condición física, cultura e idiomas.
            Cada hora bien invertida acerca a esa idea. Y cuando cumples tu meta del día, la app lo reconoce como un logro completo.
          </p>
          <div className="mt-7 flex flex-wrap gap-2">
            <a href="#rangos" className="press inline-flex items-center gap-1.5 rounded-full bg-text px-4 py-2 text-sm font-semibold text-[color-mix(in_srgb,var(--tone)_62%,black)] shadow-[0_10px_24px_-12px_rgb(0_0_0/0.4)] hover:brightness-95">
              <Crown size={15} aria-hidden />
              Ver los rangos
            </a>
            <a href="#frases" className="press inline-flex items-center gap-1.5 rounded-full border border-border-strong bg-surface px-4 py-2 text-sm font-semibold hover:bg-surface-3">
              Leer las frases
              <ArrowDown size={15} aria-hidden />
            </a>
          </div>
        </div>
      </section>

      {/* Principios, numerados como capítulos. */}
      <section className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-2 [scrollbar-width:none] sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 sm:pb-0 lg:grid-cols-4 [&::-webkit-scrollbar]:hidden">
        {PRINCIPLES.map((p, i) => (
          <div key={p.title} className="card-glass spotlight group relative w-[80%] shrink-0 snap-start overflow-hidden rounded-[24px] p-5 sm:w-auto">
            <span className="text-tone-gradient pointer-events-none absolute right-4 top-3 select-none font-display text-[44px] font-extrabold leading-none opacity-30 transition-all duration-500 group-hover:-translate-y-0.5 group-hover:opacity-60" aria-hidden>
              {String(i + 1).padStart(2, "0")}
            </span>
            <span className="tone-chip relative h-10 w-10 rounded-2xl transition-transform duration-300 group-hover:-rotate-6">
              <p.icon size={18} aria-hidden />
            </span>
            <p className="relative mt-4 font-display text-[17px] font-semibold leading-tight">{p.title}</p>
            <p className="relative mt-2 text-sm leading-relaxed text-muted">{p.text}</p>
          </div>
        ))}
      </section>

      <section id="rangos" className="grid scroll-mt-24 gap-5 lg:grid-cols-[1.25fr_1fr]">
        <div data-reveal className="card-glass relative overflow-hidden rounded-[26px] p-5 sm:p-7">
          <div className="pointer-events-none absolute -right-20 -top-24 h-64 w-64 rounded-full bg-tone opacity-[0.12] blur-3xl" aria-hidden />
          <p className="eyebrow">La escalera</p>
          <h2 className="mt-1 text-[26px] font-bold leading-tight sm:text-[30px]">Rangos de disciplina</h2>
          <p className="mt-1.5 text-sm text-muted">Según tus horas productivas del día. Tu objetivo actual: {goalLabel(goal)}.</p>

          <ol className="relative mt-6 space-y-1" aria-label="Rangos de disciplina, de menos a más horas">
            {/* Raíl vertical que une los peldaños. */}
            <span className="absolute bottom-5 left-[calc(5.125rem-0.5px)] top-5 w-px bg-gradient-to-b from-border via-tone/40 to-[var(--gold)]" aria-hidden />
            {RANKS.map((r, i) => {
              const next = RANKS[i + 1];
              const hours = next ? (next.minHours - r.minHours > 1 ? `${r.minHours}–${next.minHours - 1} h` : `${r.minHours} h`) : `${r.minHours} h o más`;
              const elite = r.minHours >= 10;
              const isGoal = goal === r.minHours * 60;
              const width = Math.max(10, ((r.minHours + 1) / LADDER_TOP) * 100);
              return (
                <li
                  key={r.id}
                  className={cn(
                    "relative grid grid-cols-[4rem_1.25rem_1fr] items-center gap-2 rounded-2xl py-2 pr-3 transition-colors",
                    isGoal ? "bg-tone-soft shadow-[0_0_0_1px_color-mix(in_srgb,var(--tone)_30%,transparent)]" : "hover:bg-surface-2/50",
                  )}
                >
                  <span className={cn("text-right text-xs font-semibold tabular", isGoal ? "text-tone-ink" : "text-muted")}>{hours}</span>
                  <span className="relative grid place-items-center" aria-hidden>
                    {isGoal ? (
                      <span className="live-dot !h-3 !w-3" />
                    ) : (
                      <span
                        className={cn(
                          "rounded-full",
                          r.milestone ? "h-3 w-3 shadow-[0_0_0_3px_var(--surface)]" : "h-2 w-2 bg-border-strong",
                          r.milestone && (elite ? "bg-[var(--gold)]" : "bg-tone"),
                        )}
                      />
                    )}
                  </span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold">
                      {elite && <Crown size={14} className="shrink-0 text-[var(--gold)]" />}
                      <span className={cn(elite && "text-gold")}>{rankLabel(r)}</span>
                      {isGoal && <Badge variant="solid">Tu objetivo</Badge>}
                    </div>
                    <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2" aria-hidden>
                      <div
                        className="reveal-grow h-full origin-left rounded-full"
                        style={
                          {
                            width: `${width}%`,
                            background: elite
                              ? "linear-gradient(90deg, var(--gold), var(--gold-2))"
                              : `linear-gradient(90deg, color-mix(in srgb, var(--tone) ${35 + i * 8}%, transparent), color-mix(in srgb, var(--tone) ${60 + i * 5}%, var(--tone-2)))`,
                          } as React.CSSProperties
                        }
                      />
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="mt-5 flex gap-2.5 rounded-2xl bg-warning-soft p-3.5 text-xs leading-relaxed text-warning">
            <Info size={15} className="mt-px shrink-0" />
            <span>
              {SYMBOLIC_NOTE} Sirven para dar forma a tu progreso, no para compararte con nadie. 13 horas no es una meta para todos los días: la
              disciplina sostenible incluye dormir bien y descansar.
            </span>
          </p>
          <p className="mt-4 text-sm">
            <Link href="/settings" className="press group inline-flex items-center gap-2 rounded-full bg-surface-2 px-3.5 py-2 font-semibold text-tone-ink hover:bg-surface-3">
              <Settings size={15} aria-hidden />
              Cambiar mi objetivo diario
              <ArrowRight size={14} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
          </p>
        </div>

        <div className="space-y-5">
          <div data-reveal className="card-glass rounded-[26px] p-5 sm:p-6">
            <h2 className="font-display text-xl font-bold">Qué cuenta como desarrollo</h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
              {COUNTS.map(({ text, icon: Icon }) => (
                <li key={text} className="flex items-center gap-2.5 rounded-2xl bg-surface-2/50 px-2.5 py-2 text-[13px] leading-snug transition-colors hover:bg-tone-soft/60">
                  <span className="tone-chip-soft h-8 w-8 rounded-xl">
                    <Icon size={15} aria-hidden />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
            <p className="mt-4 flex gap-2.5 text-sm leading-relaxed text-muted">
              <Ban size={16} className="mt-0.5 shrink-0 text-faint" aria-hidden />
              <span>
                No cuentan los descansos, ni el tiempo en categorías que marques como no desarrollo (ocio, comidas), ni las actividades que evalúes
                como «solo ocupado». Dos actividades al mismo tiempo nunca suman doble.
              </span>
            </p>
          </div>
          <div data-reveal className="card-tint rounded-[26px] p-5 sm:p-6">
            <div className="flex items-center gap-2.5">
              <span className="tone-chip h-9 w-9 rounded-xl">
                <Library size={17} aria-hidden />
              </span>
              <h2 className="font-display text-xl font-bold">Referencias reales</h2>
            </div>
            <p className="mt-2 text-sm text-muted">
              Estudios sobre trabajo concentrado (solo concentración profunda, sin ejercicio ni lectura ligera). Útiles como contexto:
            </p>
            <ul className="mt-4 space-y-4 text-sm">
              {REFERENCES.map((r) => (
                <li key={r.source}>
                  <div className="flex items-baseline gap-2">
                    <span className="text-tone-gradient shrink-0 font-display text-[22px] font-bold tabular">{formatDuration(r.minutes * 60)}</span>
                    <span className="min-w-0 font-medium leading-snug">· {r.who}</span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                    <div className="h-full rounded-full bg-gradient-to-r from-tone to-tone-2" style={{ width: `${(r.minutes / REF_TOP) * 100}%` }} />
                  </div>
                  <span className="mt-1 block text-xs text-muted">{r.source}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="scroll-mt-24 space-y-6" id="frases">
        <div data-reveal className="flex flex-wrap items-end justify-between gap-4">
          <div className="max-w-2xl">
            <p className="eyebrow">China y Rusia</p>
            <h2 className="mt-1 text-[30px] font-bold leading-tight sm:text-[40px]">Filosofía de disciplina</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Proverbios y textos clásicos de China y Rusia sobre estudio, esfuerzo y perseverancia. Solo frases auténticas: cuando el autor no es
              verificable, se indica como proverbio popular.
            </p>
          </div>
        </div>

        <div data-reveal className="relative grid gap-4 lg:grid-cols-[1fr_260px]">
          <div className="pointer-events-none absolute inset-x-2 -inset-y-3 rounded-[40px] bg-gradient-to-br from-tone/20 via-transparent to-[var(--tone-2)]/20 blur-2xl" aria-hidden />
          <QuoteCard quote={daily} favorite={favSet.has(daily.id)} ready={ready} />
          <Collection china={chinaCount} russia={russiaCount} favorites={favorites.length} />
        </div>

        <div className="-mx-4 overflow-x-auto px-4 pb-1 [scrollbar-width:none] sm:mx-0 sm:px-0 [&::-webkit-scrollbar]:hidden">
          <nav className="seg" aria-label="Filtrar frases">
            {FILTERS.map((x) => {
              const count = x.id === "fav" ? (favorites.length > 0 ? favorites.length : null) : x.id === "all" ? null : QUOTES.filter((q) => q.origin === x.id).length;
              return (
                <Link
                  key={x.id}
                  href={x.id === "all" ? "/philosophy#frases" : `/philosophy?f=${x.id}#frases`}
                  aria-current={filter === x.id ? "page" : undefined}
                >
                  {x.glyph && (
                    <span className="font-display text-[13px] font-bold text-tone-ink" aria-hidden>
                      {x.glyph}
                    </span>
                  )}
                  {x.id === "fav" && <Star size={13} className={cn(filter === "fav" ? "fill-[var(--gold)] text-[var(--gold)]" : "")} aria-hidden />}
                  {x.label}
                  {count != null && (
                    <>
                      {" "}
                      <span className="text-[12px] font-medium tabular text-faint">({count})</span>
                    </>
                  )}
                </Link>
              );
            })}
          </nav>
        </div>

        {list.length === 0 ? (
          <EmptyState
            icon={<Star />}
            title={ready ? "Aún no tienes favoritas" : "Favoritas en camino"}
            action={
              ready ? (
                <Link href="/philosophy#frases" className={buttonClass("tone", "sm")}>
                  Explorar todas las frases
                </Link>
              ) : undefined
            }
          >
            {ready ? "Toca la estrella de una frase para guardarla." : "Las favoritas se activan con la actualización de la base de datos."}
          </EmptyState>
        ) : (
          <>
            <div className="columns-1 gap-4 md:columns-2">
              {list.slice(0, shown).map((q, i) => (
                <div key={q.id} id={i === shown - PAGE ? "mas-frases" : undefined} data-reveal className="mb-4 scroll-mt-24 break-inside-avoid">
                  <QuoteCard quote={q} favorite={favSet.has(q.id)} ready={ready} label="Frase" />
                </div>
              ))}
            </div>
            {list.length > shown && (
              <div className="flex justify-center">
                <Link href={moreHref} scroll={false} className={buttonClass("secondary", "lg")}>
                  Ver más frases ({list.length - shown} restantes)
                </Link>
              </div>
            )}
          </>
        )}
      </section>
    </div>
  );
}

/** La colección de frases: proporción China/Rusia y favoritas guardadas. */
function Collection({ china, russia, favorites }: { china: number; russia: number; favorites: number }) {
  const total = china + russia;
  return (
    <aside className="card-tint relative hidden flex-col overflow-hidden rounded-[26px] p-5 lg:flex">
      <p className="eyebrow">La colección</p>
      <p className="mt-2 font-display text-[44px] font-extrabold leading-none tabular">
        {total}
        <span className="ml-1.5 font-sans text-base font-semibold tracking-normal text-muted">frases</span>
      </p>
      <div className="mt-4 flex h-2.5 gap-1 overflow-hidden rounded-full" aria-hidden>
        <span className="rounded-full bg-tone" style={{ flexBasis: `${(china / total) * 100}%` }} />
        <span className="rounded-full bg-[var(--tone-2)]" style={{ flexBasis: `${(russia / total) * 100}%` }} />
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        <li className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-tone font-display text-base font-bold text-white" aria-hidden>
            中
          </span>
          <span className="flex-1 font-medium">China</span>
          <span className="font-semibold tabular">{china}</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--tone-2)] font-display text-base font-bold text-white" aria-hidden>
            Я
          </span>
          <span className="flex-1 font-medium">Rusia</span>
          <span className="font-semibold tabular">{russia}</span>
        </li>
        <li className="flex items-center gap-3">
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--gold-soft)] text-[var(--gold)]" aria-hidden>
            <Star size={16} fill="currentColor" />
          </span>
          <span className="flex-1 font-medium">Tus favoritas</span>
          <span className="font-semibold tabular">{favorites}</span>
        </li>
      </ul>
      <p className="mt-auto pt-4 text-xs leading-relaxed text-muted">Toca la estrella de cualquier frase para guardarla en tu cuenta.</p>
    </aside>
  );
}
