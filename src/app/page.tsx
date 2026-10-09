import Link from "next/link";
import { redirect } from "next/navigation";
import { BarChart3, CalendarClock, Flame, Lock, Play, StickyNote, Target, Timer, Trophy, Users } from "lucide-react";
import { Logo } from "@/components/logo";
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

      <section className="relative py-20 text-center sm:py-28 animate-in">
        <div
          className="animate-glow pointer-events-none absolute inset-x-0 top-10 -z-10 mx-auto h-72 max-w-2xl rounded-full bg-gradient-to-r from-accent/25 to-accent-2/20 blur-3xl"
          aria-hidden
        />
        <p className="mb-4 inline-block rounded-full border border-border px-3 py-1 text-xs text-muted">Escape the Average</p>
        <h1 className="mx-auto max-w-3xl text-[42px] font-bold leading-[1.05] tracking-tight sm:text-7xl">
          Convierte intenciones <br className="hidden sm:block" />
          en <span className="text-gradient">acciones medibles</span>.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-muted">
          Tareas, concentración, hábitos y estadísticas reales en un solo lugar. Diseñado para quienes posponen, se distraen o
          no saben por dónde empezar.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/signup" className={buttonClass("primary", "lg")}>
            Empezar gratis
          </Link>
          <Link href="/login" className={buttonClass("secondary", "lg")}>
            Ya tengo cuenta
          </Link>
        </div>
        <p className="mt-6 flex items-center justify-center gap-1.5 text-xs text-muted">
          <Lock size={12} /> Tus datos son privados por defecto. Sin anuncios.
        </p>
      </section>

      <section className="stagger grid gap-3 pb-24 sm:grid-cols-2 lg:grid-cols-3">
        {features.map((f) => (
          <div key={f.title} className="lift rounded-[22px] border border-border/70 bg-surface p-6 shadow-soft">
            <div className="mb-3 inline-grid h-9 w-9 place-items-center rounded-xl bg-accent-soft text-accent">{f.icon}</div>
            <h2 className="font-medium">{f.title}</h2>
            <p className="mt-1 text-sm text-muted">{f.text}</p>
          </div>
        ))}
      </section>
      <footer className="border-t border-border py-6 text-center text-xs text-muted">Become the 0.1%.</footer>
    </main>
  );
}
