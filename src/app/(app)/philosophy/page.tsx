import type { Metadata } from "next";
import Link from "next/link";
import { Crown, Info } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getFavoriteQuoteIds, isDisciplineReady, dailyGoal } from "@/lib/data/discipline";
import { goalLabel, rankLabel, RANKS, SYMBOLIC_NOTE } from "@/lib/domain/discipline";
import { QUOTES, quoteOfDay, type Quote } from "@/lib/domain/quotes";
import { REFERENCES } from "@/lib/domain/references";
import { formatDuration } from "@/lib/domain/stats";
import { QuoteCard } from "@/components/discipline/quote-card";
import { cn } from "@/lib/cn";

export const metadata: Metadata = { title: "Filosofía" };

const PRINCIPLES = [
  { title: "Horas con propósito", text: "Cuenta el tiempo que te desarrolla: estudio, lectura, idiomas, programación, ejercicio, proyectos y cultura con intención de aprender." },
  { title: "La meta tiene un final", text: "Cuando cumples tu objetivo, la app te lo dice claro: hoy hiciste lo suficiente. No mueve la meta ni te pide más." },
  { title: "El descanso es progreso", text: "Los días de descanso no rompen rachas. Recuperarte es lo que permite sostener la disciplina durante años." },
  { title: "Tú contra ti mismo", text: "Tu referencia es tu propio historial: ayer, tu media y tu mejor día. El único promedio que hay que superar es el tuyo." },
];

const COUNTS = [
  "Estudio académico y aprendizaje",
  "Lectura educativa, científica, filosófica o histórica",
  "Idiomas",
  "Programación, tecnología y habilidades prácticas",
  "Ejercicio y entrenamiento físico",
  "Proyectos personales",
  "Habilidades profesionales o económicas",
  "Cultura con objetivo de aprendizaje",
];

const FILTERS = [
  { id: "all", label: "Todas" },
  { id: "china", label: "China" },
  { id: "rusia", label: "Rusia" },
  { id: "fav", label: "Favoritas" },
] as const;

export default async function PhilosophyPage({ searchParams }: { searchParams: Promise<{ f?: string }> }) {
  const { f } = await searchParams;
  const filter = FILTERS.some((x) => x.id === f) ? (f as (typeof FILTERS)[number]["id"]) : "all";
  const { supabase, today, profile } = await requireUser();
  const ready = await isDisciplineReady(supabase);
  const favorites = await getFavoriteQuoteIds(supabase, ready);
  const favSet = new Set(favorites);
  const daily = quoteOfDay(today);
  const goal = ready ? dailyGoal(profile) : 660;

  const list: Quote[] =
    filter === "fav"
      ? (favorites.map((id) => QUOTES.find((q) => q.id === id)).filter(Boolean) as Quote[])
      : QUOTES.filter((q) => filter === "all" || q.origin === filter);

  return (
    <div className="stagger space-y-8">
      <section className="card-glass relative overflow-hidden rounded-[32px] p-6 sm:p-10">
        <div className="animate-glow pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full bg-gradient-to-br from-[var(--gold)]/30 via-accent/20 to-transparent blur-3xl" aria-hidden />
        <div className="relative max-w-3xl">
          <p className="wordmark text-xs">ESCAPE AVG</p>
          <h1 className="mt-4 text-[40px] font-bold leading-[1.02] tracking-tight sm:text-[60px]">
            Escapar del <span className="text-gradient">promedio</span>.
          </h1>
          <p className="mt-5 text-xl font-semibold leading-snug sm:text-2xl">
            No estás aquí para estar ocupado. Estás aquí para convertirte en alguien extraordinariamente preparado.
          </p>
          <p className="mt-4 text-[15px] text-muted">
            <span className="font-semibold text-text">El 0.0001 %</span> es una idea, no una estadística: el nivel de disciplina de quien usa
            conscientemente su tiempo para desarrollar conocimiento, capacidad intelectual, habilidades, condición física, cultura e idiomas.
            Cada hora bien invertida acerca a esa idea. Y cuando cumples tu meta del día, la app lo reconoce como un logro completo.
          </p>
        </div>
      </section>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {PRINCIPLES.map((p) => (
          <div key={p.title} className="card-glass rounded-[24px] p-5">
            <p className="font-semibold">{p.title}</p>
            <p className="mt-2 text-sm text-muted">{p.text}</p>
          </div>
        ))}
      </section>

      <section id="rangos" className="grid scroll-mt-24 gap-4 lg:grid-cols-[1.2fr_1fr]">
        <div className="card-glass rounded-[24px] p-5 sm:p-6">
          <h2 className="text-lg font-semibold">Rangos de disciplina</h2>
          <p className="mt-1 text-sm text-muted">Según tus horas productivas del día. Tu objetivo actual: {goalLabel(goal)}.</p>
          <table className="mt-4 w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-muted">
                <th className="pb-2 font-semibold">Horas productivas</th>
                <th className="pb-2 font-semibold">Rango</th>
              </tr>
            </thead>
            <tbody>
              {RANKS.map((r, i) => {
                const next = RANKS[i + 1];
                const hours = next ? (next.minHours - r.minHours > 1 ? `${r.minHours}–${next.minHours - 1} h` : `${r.minHours} h`) : `${r.minHours} h o más`;
                return (
                  <tr key={r.id} className={cn("border-t border-border/70", goal === r.minHours * 60 && "bg-accent-soft/60")}>
                    <td className="py-2.5 tabular">{hours}</td>
                    <td className="py-2.5 font-medium">
                      <span className="inline-flex items-center gap-1.5">
                        {r.minHours >= 10 && <Crown size={13} className="text-[var(--gold)]" />}
                        {rankLabel(r)}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <p className="mt-4 flex gap-1.5 rounded-xl bg-warning-soft p-3 text-xs text-warning">
            <Info size={14} className="mt-0.5 shrink-0" />
            <span>
              {SYMBOLIC_NOTE} Sirven para dar forma a tu progreso, no para compararte con nadie. 13 horas no es una meta para todos los días: la
              disciplina sostenible incluye dormir bien y descansar.
            </span>
          </p>
          <p className="mt-3 text-sm">
            <Link href="/settings" className="text-accent hover:underline">
              Cambiar mi objetivo diario
            </Link>
          </p>
        </div>

        <div className="space-y-4">
          <div className="card-glass rounded-[24px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Qué cuenta como desarrollo</h2>
            <ul className="mt-3 space-y-1.5 text-sm">
              {COUNTS.map((c) => (
                <li key={c} className="flex gap-2">
                  <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-accent" aria-hidden />
                  {c}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-sm text-muted">
              No cuentan los descansos, ni el tiempo en categorías que marques como no desarrollo (ocio, comidas), ni las actividades que evalúes
              como «solo ocupado». Dos actividades al mismo tiempo nunca suman doble.
            </p>
          </div>
          <div className="card-glass rounded-[24px] p-5 sm:p-6">
            <h2 className="text-lg font-semibold">Referencias reales</h2>
            <p className="mt-1 text-sm text-muted">
              Estudios sobre trabajo concentrado (solo concentración profunda, sin ejercicio ni lectura ligera). Útiles como contexto:
            </p>
            <ul className="mt-3 space-y-2 text-sm">
              {REFERENCES.map((r) => (
                <li key={r.source}>
                  <span className="font-semibold tabular">{formatDuration(r.minutes * 60)}</span> · {r.who}
                  <span className="block text-xs text-muted">{r.source}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <section className="space-y-4" id="frases">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight">Filosofía de disciplina</h2>
          <p className="mt-1 text-sm text-muted">
            Proverbios y textos clásicos de China y Rusia sobre estudio, esfuerzo y perseverancia. Solo frases auténticas: cuando el autor no es
            verificable, se indica como proverbio popular.
          </p>
        </div>
        <QuoteCard quote={daily} favorite={favSet.has(daily.id)} ready={ready} className="lg:max-w-3xl" />
        <nav className="flex flex-wrap gap-1.5" aria-label="Filtrar frases">
          {FILTERS.map((x) => (
            <Link
              key={x.id}
              href={x.id === "all" ? "/philosophy#frases" : `/philosophy?f=${x.id}#frases`}
              aria-current={filter === x.id ? "page" : undefined}
              className={cn(
                "rounded-full px-3.5 py-1.5 text-sm",
                filter === x.id ? "bg-accent font-medium text-accent-fg" : "bg-surface-2 text-muted hover:text-text",
              )}
            >
              {x.label}
              {x.id === "fav" && favorites.length > 0 && ` (${favorites.length})`}
              {x.id !== "fav" && x.id !== "all" && ` (${QUOTES.filter((q) => q.origin === x.id).length})`}
            </Link>
          ))}
        </nav>
        {list.length === 0 ? (
          <p className="text-sm text-muted">
            {ready ? "Aún no tienes favoritas. Toca la estrella de una frase para guardarla." : "Las favoritas se activan con la actualización de la base de datos."}
          </p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {list.map((q) => (
              <QuoteCard key={q.id} quote={q} favorite={favSet.has(q.id)} ready={ready} label="Frase" />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
