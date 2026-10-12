import Link from "next/link";
import { ArrowLeft, BarChart3, Flame, Lock, Sparkles } from "lucide-react";
import { Logo } from "@/components/logo";
import { ActivityRings } from "@/components/fx/activity-rings";
import { ThemeToggle } from "@/components/theme-toggle";

const RINGS = [
  { label: "Concentración", value: 0.82, color: "var(--ring-focus)", color2: "var(--ring-focus-2)" },
  { label: "Tareas", value: 0.66, color: "var(--ring-tasks)", color2: "var(--ring-tasks-2)" },
  { label: "Hábitos", value: 1, color: "var(--ring-habits)", color2: "var(--ring-habits-2)" },
];

const STATS = [
  { label: "Enfoque", value: "3 h 05 min", dot: "bg-ring-focus" },
  { label: "Tareas", value: "4 / 6", dot: "bg-ring-tasks" },
  { label: "Hábitos", value: "3 / 3", dot: "bg-ring-habits" },
];

/** Pantalla partida: panel de marca (escritorio) y formulario limpio. En móvil, centrado. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <main data-tone="violet" className="relative min-h-dvh lg:grid lg:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      {/* Panel de marca */}
      <aside className="relative hidden p-3 lg:block">
        <div className="card-feature sticky top-3 flex h-[calc(100dvh-1.5rem)] min-h-[620px] flex-col justify-between rounded-[32px] p-10 xl:p-12">
          <div className="animate-glow pointer-events-none absolute -left-24 top-1/3 h-80 w-80 rounded-full bg-white/15 blur-3xl" aria-hidden />
          <div className="animate-glow pointer-events-none absolute -bottom-24 -right-10 h-96 w-96 rounded-full bg-accent-3/35 blur-3xl [animation-delay:-4s]" aria-hidden />

          <div className="relative flex items-center justify-between">
            <span className="wordmark text-[12px] text-white/90">ESCAPE AVERAGE</span>
            <Link href="/" className="press inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1.5 text-xs font-semibold text-white backdrop-blur hover:bg-white/20">
              <ArrowLeft size={13} aria-hidden /> Portada
            </Link>
          </div>

          <div className="relative">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-white/70">Escape the Average</p>
            <p className="mt-3 font-display text-[clamp(48px,5.4vw,76px)] font-extrabold leading-[0.92] tracking-[-0.045em]">Become the 0.1%.</p>
            <p className="mt-5 max-w-md text-[17px] leading-relaxed text-white/85">
              Tareas, concentración, hábitos y estadísticas reales en un solo lugar. Un paso pequeño hoy cuenta.
            </p>

            {/* Mini vista previa (datos de ejemplo) */}
            <div className="relative mt-10 max-w-md" aria-hidden>
              <div className="flex items-center gap-6 rounded-[26px] border border-white/20 bg-white/10 p-5 shadow-[0_24px_48px_-24px_rgb(0_0_0/0.45)] backdrop-blur-md">
                <ActivityRings size={112} stroke={11} gap={3} rings={RINGS} className="shrink-0" />
                <ul className="min-w-0 flex-1 space-y-2.5">
                  {STATS.map((s) => (
                    <li key={s.label} className="flex items-center justify-between gap-3 text-sm">
                      <span className="flex items-center gap-2 text-white/75">
                        <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                        {s.label}
                      </span>
                      <span className="font-display font-semibold tabular">{s.value}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="animate-float absolute -right-4 -top-6 flex items-center gap-2 rounded-2xl border border-white/25 bg-white/15 px-3 py-2 shadow-[0_16px_30px_-16px_rgb(0_0_0/0.5)] backdrop-blur-md xl:-right-10">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-white/25">
                  <Flame size={15} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[10.5px] font-semibold text-white/75">Racha</span>
                  <span className="block font-display text-sm font-bold">12 días</span>
                </span>
              </div>
            </div>
          </div>

          <ul className="relative flex flex-wrap gap-x-6 gap-y-2 text-[13px] font-medium text-white/80">
            <li className="flex items-center gap-1.5">
              <Lock size={14} aria-hidden /> Privado por defecto
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles size={14} aria-hidden /> Sin anuncios
            </li>
            <li className="flex items-center gap-1.5">
              <BarChart3 size={14} aria-hidden /> Solo datos reales
            </li>
          </ul>
        </div>
      </aside>

      {/* Formulario */}
      <div className="relative flex min-h-dvh flex-col px-4 py-5 sm:px-8 lg:px-12 xl:px-16">
        <div
          className="animate-glow pointer-events-none absolute left-1/2 top-24 -z-10 h-80 w-80 -translate-x-1/2 rounded-full bg-gradient-to-br from-accent/25 to-accent-2/15 blur-3xl lg:hidden"
          aria-hidden
        />
        <div className="flex items-center justify-between gap-3">
          <Link href="/" className="rounded-full">
            <Logo />
          </Link>
          <ThemeToggle />
        </div>

        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-[400px] animate-in">
            {/* Franja de marca en móvil */}
            <div className="card-feature mb-5 flex items-center gap-4 rounded-[24px] p-4 lg:hidden" aria-hidden>
              <ActivityRings size={60} stroke={7} gap={2} rings={RINGS} className="relative shrink-0" />
              <div className="relative min-w-0">
                <p className="text-[10.5px] font-bold uppercase tracking-[0.18em] text-white/75">Escape the Average</p>
                <p className="font-display text-[22px] font-extrabold leading-tight tracking-tight">Become the 0.1%.</p>
              </div>
            </div>
            <div className="rounded-[28px] border border-card-border bg-card p-6 shadow-float backdrop-blur-xl sm:p-8 lg:border-transparent lg:bg-transparent lg:p-0 lg:shadow-none lg:backdrop-blur-none">
              {children}
            </div>
          </div>
        </div>

        <p className="text-center text-xs text-faint lg:text-left">Escape Average · Become the 0.1%.</p>
      </div>
    </main>
  );
}
