import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarClock, Flame, Lock, Play, StickyNote, Target, Timer, Trophy, Users } from "lucide-react";
import { Logo } from "@/components/logo";
import { ActivityRings } from "@/components/fx/activity-rings";
import { buttonClass } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function Home() {
  if (supabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  const features = [
    { icon: <Play size={18} />, title: "Just Start", text: "¿Sin ganas? Empieza con 2 minutos. El resto viene solo." },
    { icon: <Timer size={18} />, title: "Concentración real", text: "Pomodoro y cronómetro sincronizados entre dispositivos." },
    { icon: <Flame size={18} />, title: "Hábitos sin castigo", text: "Rachas opcionales que respetan tus descansos." },
    { icon: <BarChart3 size={18} />, title: "Datos, no sensaciones", text: "Estadísticas calculadas solo con lo que registras." },
    { icon: <Target size={18} />, title: "Objetivos medibles", text: "Metas semanales que se actualizan solas." },
    { icon: <StickyNote size={18} />, title: "Tablero libre", text: "Notas adhesivas que se convierten en tareas." },
    { icon: <CalendarClock size={18} />, title: "Plan del día", text: "Un plan realista según tu ritmo real, con el porqué de cada tarea." },
    { icon: <Trophy size={18} />, title: "Progreso que motiva", text: "Niveles, XP y logros que premian la constancia, no el volumen." },
    { icon: <Users size={18} />, title: "Comparación justa", text: "Compárate solo con quien tú elijas y solo si ambos queréis." },
  ];

  return (
    <main className="mx-auto max-w-5xl px-4">
      <header className="flex items-center justify-between py-5">
        <Logo />
        <div className="flex items-center gap-3">
          <ThemeToggle />
          <Link href="/login" className={buttonClass("ghost", "sm")}>
            Entrar
          </Link>
        </div>
      </header>

      <section className="relative grid items-center gap-12 py-16 sm:py-24 lg:grid-cols-[1.2fr_1fr]">
        <div className="page-in text-center lg:text-left">
          <p className="mb-5 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1 text-xs font-medium text-muted backdrop-blur">
            <span className="h-1.5 w-1.5 rounded-full bg-gradient-to-r from-accent to-ring-focus" /> Escape the Average
          </p>
          <h1 className="text-[44px] font-bold leading-[1.02] tracking-tight sm:text-7xl">
            Convierte intenciones en <span className="text-gradient">acciones medibles</span>.
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-muted lg:mx-0">
            Tareas, concentración, hábitos y estadísticas reales en un solo lugar. Diseñado para quienes posponen, se distraen o
            no saben por dónde empezar.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href="/signup" className={buttonClass("primary", "lg", "px-8")}>
              Empezar gratis
            </Link>
            <Link href="/login" className={buttonClass("secondary", "lg", "px-8")}>
              Ya tengo cuenta
            </Link>
          </div>
          <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted lg:justify-start">
            <Lock size={12} /> Tus datos son privados por defecto. Sin anuncios.
          </p>
        </div>

        <div className="page-in relative mx-auto w-full max-w-sm [animation-delay:150ms]" aria-hidden>
          <div className="animate-glow absolute -inset-10 -z-10 rounded-full bg-gradient-to-br from-accent/40 via-ring-focus/25 to-ring-habits/25 blur-3xl" />
          <div className="card-glass rounded-[36px] p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted">Ejemplo · Hoy</p>
            <p className="mt-1 text-2xl font-bold tracking-tight">Hola, Ana.</p>
            <div className="mt-6 flex items-center gap-6">
              <ActivityRings
                size={150}
                stroke={14}
                gap={4}
                rings={[
                  { label: "Concentración", value: 0.82, color: "var(--ring-focus)", color2: "var(--ring-focus-2)" },
                  { label: "Tareas", value: 0.66, color: "var(--ring-tasks)", color2: "var(--ring-tasks-2)" },
                  { label: "Hábitos", value: 1, color: "var(--ring-habits)", color2: "var(--ring-habits-2)" },
                ]}
              />
              <ul className="space-y-2 text-sm">
                <li>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-ring-focus">Enfoque</span>
                  <span className="font-semibold tabular">3 h 05 min</span>
                </li>
                <li>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-ring-tasks">Tareas</span>
                  <span className="font-semibold tabular">4 / 6</span>
                </li>
                <li>
                  <span className="block text-[10px] font-semibold uppercase tracking-wider text-ring-habits">Hábitos</span>
                  <span className="font-semibold tabular">3 / 3</span>
                </li>
              </ul>
            </div>
            <div className="mt-6 rounded-2xl bg-surface-2/70 p-4">
              <p className="text-sm">
                Ayer rendiste al <span className="text-gradient text-2xl font-bold">168 %</span> de tu media.
              </p>
              <p className="mt-1 text-xs text-muted">Calculado solo con tus datos reales.</p>
            </div>
          </div>
        </div>
      </section>

      <section className="stagger grid gap-3 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="lift card-glass rounded-[24px] p-6">
            <div className="mb-4 inline-grid h-11 w-11 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-2 text-accent-fg shadow-float">{f.icon}</div>
            <h2 className="text-[17px] font-semibold">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">Become the 0.1%.</footer>
    </main>
  );
}
