import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ArrowRight,
  BarChart3,
  CalendarClock,
  Check,
  CheckSquare,
  Database,
  EyeOff,
  Flame,
  Lock,
  Medal,
  Play,
  ShieldCheck,
  Sparkles,
  Star,
  StickyNote,
  Target,
  Timer,
  Trophy,
  Users,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { Logo } from "@/components/logo";
import { ActivityRings } from "@/components/fx/activity-rings";
import { Interactions } from "@/components/fx/interactions";
import { ProgressBar } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";
import { ThemeToggle } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/sections";
import { supabaseEnv } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type Feature = { icon: LucideIcon; title: string; text: string; tone: Tone; visual?: "focus" | "data" | "progress" };

// Cada función lleva el color de su sección en la app. Las anchas (visual) ocupan dos columnas.
const FEATURES: Feature[] = [
  { icon: Timer, title: "Concentración real", text: "Pomodoro y cronómetro sincronizados entre dispositivos.", tone: "coral", visual: "focus" },
  { icon: Play, title: "Just Start", text: "¿Sin ganas? Empieza con 2 minutos. El resto viene solo.", tone: "pink" },
  { icon: Flame, title: "Hábitos sin castigo", text: "Rachas opcionales que respetan tus descansos.", tone: "orange" },
  { icon: BarChart3, title: "Datos, no sensaciones", text: "Estadísticas calculadas solo con lo que registras.", tone: "cyan", visual: "data" },
  { icon: Target, title: "Objetivos medibles", text: "Metas semanales que se actualizan solas.", tone: "green" },
  { icon: StickyNote, title: "Tablero libre", text: "Notas adhesivas que se convierten en tareas.", tone: "lime" },
  { icon: CalendarClock, title: "Plan del día", text: "Un plan realista según tu ritmo real, con el porqué de cada tarea.", tone: "indigo" },
  { icon: Trophy, title: "Progreso que motiva", text: "Niveles, XP y logros que premian la constancia, no el volumen.", tone: "gold", visual: "progress" },
  { icon: Users, title: "Comparación justa", text: "Compárate solo con quien tú elijas y solo si ambos queréis.", tone: "sky" },
];

const STEPS: { icon: LucideIcon; tone: Tone; title: string; text: string }[] = [
  { icon: CheckSquare, tone: "blue", title: "Apunta lo que pospones", text: "Divide cada tarea en pasos tan pequeños que empezar no dé pereza." },
  { icon: Timer, tone: "coral", title: "Empieza con 2 minutos", text: "Arranca el temporizador y deja que la inercia haga el resto." },
  { icon: BarChart3, tone: "cyan", title: "Mira tus datos reales", text: "Tu progreso se mide con lo que registras, no con sensaciones." },
];

const PRIVACY: { icon: LucideIcon; title: string; text: string }[] = [
  { icon: Lock, title: "Privado por defecto", text: "Solo tu cuenta puede leer y escribir tus registros." },
  { icon: Users, title: "Opcional y recíproco", text: "Compartes con amigos o grupos solo si ambos queréis." },
  { icon: EyeOff, title: "Solo totales", text: "Nunca se comparten títulos ni notas." },
  { icon: Database, title: "Datos reales", text: "Cada cifra sale de lo que registras. Sin anuncios." },
];

export default async function Home() {
  if (supabaseEnv()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/dashboard");
  }

  return (
    <div data-tone="violet" className="relative overflow-x-clip">
      <Interactions />

      {/* Cabecera flotante */}
      <header className="sticky top-0 z-40 px-3 pt-3 sm:px-6">
        <div className="glass mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full border border-card-border py-1.5 pl-3 pr-1.5 shadow-float sm:pl-4">
          <Link href="/" className="shrink-0 rounded-full">
            <Logo />
          </Link>
          <nav className="hidden items-center gap-0.5 md:flex" aria-label="Portada">
            {[
              ["#como-funciona", "Cómo funciona"],
              ["#funciones", "Funciones"],
              ["#privacidad", "Privacidad"],
            ].map(([href, label]) => (
              <a key={href} href={href} className="rounded-full px-3 py-1.5 text-sm font-medium text-muted transition-colors hover:bg-surface-2 hover:text-text">
                {label}
              </a>
            ))}
          </nav>
          <div className="flex items-center gap-1.5">
            <div className="hidden sm:block">
              <ThemeToggle />
            </div>
            <Link href="/login" className={buttonClass("ghost", "sm")}>
              Entrar
            </Link>
            <Link href="/signup" className={buttonClass("primary", "sm")}>
              Empezar
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative mx-auto grid max-w-6xl items-center gap-16 px-4 pb-20 pt-14 sm:px-6 sm:pt-20 lg:grid-cols-[1.08fr_1fr] lg:gap-8 lg:pb-28 lg:pt-24">
        <div className="pointer-events-none absolute inset-x-0 -top-24 -z-10 h-[620px]" aria-hidden>
          <div className="animate-glow absolute left-[6%] top-10 h-72 w-72 rounded-full bg-accent opacity-25 blur-3xl" />
          <div className="animate-glow absolute right-[8%] top-40 h-80 w-80 rounded-full bg-accent-3 opacity-20 blur-3xl [animation-delay:-3s]" />
          <div className="dot-grid absolute inset-0 [mask-image:radial-gradient(60%_55%_at_30%_35%,#000,transparent)]" />
        </div>

        <div className="page-in min-w-0 text-center lg:text-left">
          <p className="mb-6 inline-flex items-center gap-2 rounded-full border border-card-border bg-card px-3 py-1.5 text-xs font-semibold text-muted shadow-soft backdrop-blur">
            <span className="live-dot" aria-hidden /> Escape the Average · gratis y privado
          </p>
          <h1 className="text-balance text-[clamp(44px,10.5vw,96px)] font-extrabold leading-[0.92] tracking-[-0.045em]">
            Escape the Average. <span className="text-gradient">Become the 0.1%.</span>
          </h1>
          <p className="mt-7 font-display text-xl font-semibold tracking-tight text-text sm:text-2xl">Convierte intenciones en acciones medibles.</p>
          <p className="mx-auto mt-3 max-w-xl text-[17px] leading-relaxed text-muted lg:mx-0">
            Tareas, concentración, hábitos y estadísticas reales en un solo lugar. Diseñado para quienes posponen, se distraen o no saben por
            dónde empezar.
          </p>
          <div className="mt-9 flex flex-wrap justify-center gap-3 lg:justify-start">
            <Link href="/signup" className={buttonClass("primary", "lg", "group px-7")}>
              Empezar gratis
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link href="/login" className={buttonClass("secondary", "lg", "px-7")}>
              Ya tengo cuenta
            </Link>
          </div>
          <ul className="mt-7 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-[13px] text-muted lg:justify-start">
            <li className="flex items-center gap-1.5">
              <Lock size={13} className="text-success" aria-hidden /> Tus datos son privados por defecto.
            </li>
            <li className="flex items-center gap-1.5">
              <Sparkles size={13} className="text-accent" aria-hidden /> Sin anuncios.
            </li>
            <li className="flex items-center gap-1.5">
              <Zap size={13} className="text-warning" aria-hidden /> Empiezas en 2 minutos.
            </li>
          </ul>
        </div>

        <HeroPreview />
      </section>

      {/* Cómo funciona */}
      <section id="como-funciona" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <SectionTitle eyebrow="Cómo funciona" title={<>Tres pasos para <span className="text-gradient">dejar de posponer</span></>} />
        <div className="relative">
          <div className="pointer-events-none absolute left-[16%] right-[16%] top-[52px] hidden border-t-2 border-dashed border-border-strong md:block" aria-hidden />
          <ol className="relative grid gap-4 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title} data-tone={s.tone} data-reveal={i * 120} className="card-glass spotlight lift relative overflow-hidden rounded-[26px] p-6">
                <div className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-tone opacity-[0.14] blur-2xl" aria-hidden />
                <div className="relative flex items-center justify-between">
                  <span className="tone-chip h-12 w-12 rounded-[16px]">
                    <s.icon size={22} aria-hidden />
                  </span>
                  <span className="num-xl text-tone-gradient text-[44px]" aria-hidden>
                    0{i + 1}
                  </span>
                </div>
                <h3 className="relative mt-5 font-display text-lg font-semibold">{s.title}</h3>
                <p className="relative mt-1.5 text-sm leading-relaxed text-muted">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Funciones */}
      <section id="funciones" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <SectionTitle eyebrow="Todo en un solo lugar" title={<>Herramientas para <span className="text-gradient">salir de la media</span></>} />
        <div className="grid gap-4 sm:grid-flow-row-dense sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f, i) => (
            <FeatureCard key={f.title} feature={f} delay={(i % 3) * 90} />
          ))}
        </div>
      </section>

      {/* Privacidad */}
      <section id="privacidad" className="mx-auto max-w-6xl scroll-mt-24 px-4 pb-24 sm:px-6">
        <div data-tone="green" data-reveal className="card-tint relative overflow-hidden rounded-[32px] p-6 sm:p-10">
          <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(50%_70%_at_0%_0%,#000,transparent)]" aria-hidden />
          <div className="relative grid items-center gap-8 lg:grid-cols-[1fr_1.15fr] lg:gap-12">
            <div>
              <span className="tone-chip h-12 w-12 rounded-[16px]">
                <ShieldCheck size={22} aria-hidden />
              </span>
              <p className="eyebrow mt-5">Privacidad</p>
              <h2 className="mt-2 text-[32px] font-bold leading-[1.05] sm:text-[40px]">Tus datos son tuyos. Y solo tuyos.</h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted">
                La base de datos solo permite que tu cuenta lea y escriba tus registros. Compartir estadísticas es opcional, recíproco y solo
                incluye totales.
              </p>
            </div>
            <ul className="grid gap-3 sm:grid-cols-2">
              {PRIVACY.map((p) => (
                <li key={p.title} className="flex items-start gap-3 rounded-[20px] border border-card-border bg-surface/70 p-4 shadow-soft backdrop-blur sm:block">
                  <span className="tone-chip-soft h-9 w-9 rounded-xl">
                    <p.icon size={17} aria-hidden />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[15px] font-semibold sm:mt-3">{p.title}</p>
                    <p className="mt-0.5 text-[13px] leading-snug text-muted">{p.text}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Llamada final */}
      <section className="mx-auto max-w-6xl px-4 pb-20 sm:px-6">
        <div data-reveal className="card-feature relative overflow-hidden rounded-[36px] px-6 py-14 text-center sm:px-12 sm:py-20">
          <div className="animate-glow pointer-events-none absolute -left-20 -top-24 h-72 w-72 rounded-full bg-white/20 blur-3xl" aria-hidden />
          <div className="animate-glow pointer-events-none absolute -bottom-28 -right-16 h-80 w-80 rounded-full bg-accent-3/40 blur-3xl [animation-delay:-4s]" aria-hidden />
          <p className="relative text-xs font-bold uppercase tracking-[0.2em] text-white/75">Escape the Average</p>
          <h2 className="relative mx-auto mt-3 max-w-3xl text-balance text-[44px] font-extrabold leading-[0.95] tracking-[-0.04em] sm:text-[72px]">
            Become the 0.1%.
          </h2>
          <p className="relative mx-auto mt-5 max-w-md text-[17px] text-white/85">Empieza hoy. Con dos minutos basta para romper la inercia.</p>
          <div className="relative mt-9 flex flex-wrap justify-center gap-3">
            <Link
              href="/signup"
              className="press shine group inline-flex h-12 items-center gap-2 rounded-full bg-white px-7 text-[15px] font-semibold shadow-[0_18px_40px_-14px_rgb(0_0_0/0.45)] hover:shadow-[0_22px_44px_-12px_rgb(0_0_0/0.5)]"
              style={{ color: "color-mix(in srgb, var(--tone) 72%, black)" }}
            >
              Empezar gratis
              <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
            </Link>
            <Link href="/login" className="press inline-flex h-12 items-center rounded-full border border-white/35 bg-white/10 px-7 text-[15px] font-semibold text-white backdrop-blur hover:bg-white/20">
              Ya tengo cuenta
            </Link>
          </div>
        </div>
      </section>

      <footer className="mx-auto flex max-w-6xl flex-col items-center gap-4 border-t border-border px-4 py-8 text-xs text-muted sm:flex-row sm:justify-between sm:px-6">
        <div className="flex items-center gap-3">
          <Logo />
          <span className="hidden text-faint sm:inline">·</span>
          <span className="font-medium">Become the 0.1%.</span>
        </div>
        <div className="flex items-center gap-3">
          <div className="sm:hidden">
            <ThemeToggle />
          </div>
          <Link href="/login" className="rounded-full px-2 py-1 hover:text-text">
            Entrar
          </Link>
          <Link href="/signup" className="rounded-full px-2 py-1 hover:text-text">
            Crear cuenta
          </Link>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow: string; title: React.ReactNode }) {
  return (
    <div data-reveal className="mx-auto mb-10 max-w-2xl text-center">
      <p className="eyebrow">{eyebrow}</p>
      <h2 className="mt-2 text-balance text-[32px] font-bold leading-[1.05] sm:text-[44px]">{title}</h2>
    </div>
  );
}

/** Vista previa de la app (datos de ejemplo) con tarjetas flotantes. */
function HeroPreview() {
  return (
    <div className="page-in relative mx-auto w-full max-w-[440px] [animation-delay:150ms]" aria-hidden>
      <div className="animate-glow absolute -inset-8 -z-10 rounded-full bg-gradient-to-br from-accent/45 via-ring-focus/25 to-ring-habits/30 blur-3xl" />

      <div className="card-glass relative rounded-[34px] p-6 transition-transform duration-700 ease-[var(--ease-out)] sm:p-7 lg:[transform:perspective(1400px)_rotateY(-6deg)_rotateX(3deg)] lg:hover:[transform:perspective(1400px)_rotateY(0deg)_rotateX(0deg)]">
        <div className="flex items-center justify-between">
          <p className="eyebrow">Ejemplo · Hoy</p>
          <span className="hidden items-center gap-1.5 rounded-full bg-success-soft px-2 py-0.5 text-[11px] font-semibold text-success sm:inline-flex">
            <span className="h-1.5 w-1.5 rounded-full bg-success" /> En racha
          </span>
        </div>
        <p className="mt-1.5 font-display text-[28px] font-bold leading-tight tracking-tight">Hola, Ana.</p>
        <p className="text-sm text-muted">Vas por delante de tu media.</p>
        <div className="mt-6 flex items-center gap-5 sm:gap-7">
          <ActivityRings
            size={150}
            stroke={14}
            gap={4}
            className="shrink-0"
            rings={[
              { label: "Concentración", value: 0.82, color: "var(--ring-focus)", color2: "var(--ring-focus-2)" },
              { label: "Tareas", value: 0.66, color: "var(--ring-tasks)", color2: "var(--ring-tasks-2)" },
              { label: "Hábitos", value: 1, color: "var(--ring-habits)", color2: "var(--ring-habits-2)" },
            ]}
          />
          <ul className="min-w-0 space-y-3 text-sm">
            {[
              ["Enfoque", "3 h 05 min", "bg-ring-focus"],
              ["Tareas", "4 / 6", "bg-ring-tasks"],
              ["Hábitos", "3 / 3", "bg-ring-habits"],
            ].map(([label, value, dot]) => (
              <li key={label} className="flex items-start gap-2">
                <span className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", dot)} />
                <span>
                  <span className="block text-[11px] font-semibold uppercase tracking-wider text-muted">{label}</span>
                  <span className="font-display text-[17px] font-semibold tabular">{value}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-6 flex items-center justify-between gap-3 rounded-2xl bg-surface-2/70 p-4">
          <div>
            <p className="text-sm">Ayer rendiste al</p>
            <p className="mt-0.5 text-xs text-muted">Calculado solo con tus datos reales.</p>
          </div>
          <p className="num-xl text-gradient shrink-0 whitespace-nowrap text-[28px] sm:text-[34px]">168 %</p>
        </div>
      </div>

      {/* Tarjetas flotantes */}
      <div data-tone="coral" className="card-glass animate-float absolute -top-9 right-3 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 sm:-left-12 sm:-top-11 sm:right-auto">
        <span className="tone-chip h-9 w-9 rounded-xl">
          <Timer size={17} />
        </span>
        <div className="leading-tight">
          <p className="flex items-center gap-1.5 text-[11px] font-semibold text-tone-ink">
            <span className="live-dot !h-1.5 !w-1.5" /> En curso
          </p>
          <p className="num-xl text-xl">18:42</p>
        </div>
      </div>
      <div
        data-tone="orange"
        className="card-glass animate-float absolute -right-2 top-[42%] hidden items-center gap-2.5 rounded-2xl px-3 py-2.5 [animation-delay:-2s] sm:-right-8 sm:flex"
      >
        <span className="tone-chip h-9 w-9 rounded-xl">
          <Flame size={17} />
        </span>
        <div className="leading-tight">
          <p className="text-[11px] font-semibold text-muted">Racha</p>
          <p className="font-display text-[17px] font-bold">12 días</p>
        </div>
      </div>
      <div data-tone="blue" className="card-glass animate-float absolute -bottom-8 right-4 flex items-center gap-2.5 rounded-2xl px-3 py-2.5 [animation-delay:-4s] sm:-bottom-7 sm:left-6 sm:right-auto">
        <span className="grid h-7 w-7 place-items-center rounded-full bg-success text-white shadow-[0_6px_14px_-6px_var(--success)]">
          <Check size={15} strokeWidth={3} />
        </span>
        <div className="leading-tight">
          <p className="text-[13px] font-semibold text-muted line-through decoration-2">Leer capítulo 3</p>
          <p className="text-[11px] font-semibold text-tone-ink">Tarea completada</p>
        </div>
        <span className="ml-1 rounded-full bg-gold-soft px-2 py-0.5 text-[11px] font-bold text-[var(--gold)]">+20 XP</span>
      </div>
    </div>
  );
}

function FeatureCard({ feature: f, delay }: { feature: Feature; delay: number }) {
  const Icon = f.icon;
  return (
    <div
      data-tone={f.tone}
      data-reveal={delay || ""}
      className={cn(
        "card-glass spotlight lift group relative min-w-0 overflow-hidden rounded-[26px] p-6",
        f.visual && "sm:col-span-2 sm:flex sm:items-center sm:gap-6",
      )}
    >
      <div
        className="pointer-events-none absolute -right-10 -top-12 h-36 w-36 rounded-full bg-tone opacity-[0.12] blur-2xl transition-opacity duration-500 group-hover:opacity-25"
        aria-hidden
      />
      <div className={cn("relative min-w-0", f.visual ? "sm:flex-1" : "flex items-start gap-4 sm:block")}>
        <span className="tone-chip h-11 w-11 rounded-2xl transition-transform duration-500 ease-[var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-110">
          <Icon size={20} aria-hidden />
        </span>
        <div className="min-w-0">
          <h3 className={cn("font-display text-[18px] font-semibold", f.visual ? "mt-4" : "sm:mt-4")}>{f.title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{f.text}</p>
        </div>
      </div>
      {f.visual && (
        <div className="relative mt-6 flex justify-center sm:mt-0 sm:flex-1" aria-hidden>
          {f.visual === "focus" && <FocusVisual />}
          {f.visual === "data" && <DataVisual />}
          {f.visual === "progress" && <ProgressVisual />}
        </div>
      )}
    </div>
  );
}

function FocusVisual() {
  const r = 52;
  const c = 2 * Math.PI * r;
  return (
    <div className="flex items-center gap-4">
      <div className="relative grid h-36 w-36 place-items-center">
        <svg viewBox="0 0 120 120" className="absolute inset-0 -rotate-90 overflow-visible">
          <defs>
            <linearGradient id="lp-focus" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" style={{ stopColor: "var(--tone)" }} />
              <stop offset="100%" style={{ stopColor: "var(--tone-2)" }} />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="var(--tone)" strokeOpacity={0.14} strokeWidth="9" />
          <circle
            cx="60"
            cy="60"
            r={r}
            fill="none"
            stroke="url(#lp-focus)"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            strokeDashoffset={c * 0.25}
            style={{ filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--tone) 50%, transparent))" }}
          />
        </svg>
        <div className="text-center">
          <p className="num-xl text-[30px]">18:42</p>
          <p className="mt-1 text-[10px] font-bold uppercase tracking-[0.14em] text-tone-ink">Enfoque</p>
        </div>
      </div>
      <div className="space-y-2">
        <span className="flex items-center gap-1.5 rounded-full bg-tone-soft px-2.5 py-1 text-[11.5px] font-semibold text-tone-ink">
          <span className="live-dot !h-1.5 !w-1.5" /> Sincronizado
        </span>
        <div className="flex gap-1">
          {[1, 1, 1, 0].map((done, i) => (
            <span key={i} className={cn("h-2 w-6 rounded-full", done ? "bg-gradient-to-r from-tone to-tone-2" : "bg-surface-3")} />
          ))}
        </div>
        <p className="text-[11px] text-muted">3 de 4 pomodoros</p>
      </div>
    </div>
  );
}

function DataVisual() {
  const bars = [38, 52, 44, 70, 62, 92, 56];
  const days = ["L", "M", "X", "J", "V", "S", "D"];
  return (
    <div className="w-full max-w-xs">
      <div className="relative flex h-32 items-end gap-2">
        <span className="absolute -top-2 left-[71%] -translate-x-1/2 rounded-full bg-text px-2 py-0.5 text-[10.5px] font-semibold text-bg shadow-float">3 h 40 min</span>
        {bars.map((h, i) => (
          <div key={i} className="flex h-full flex-1 flex-col justify-end">
            <div
              className={cn(
                "w-full rounded-b-md rounded-t-[10px] bg-gradient-to-t from-tone to-tone-2",
                i === 5 ? "shadow-[0_0_20px_-4px_var(--tone)]" : "opacity-45",
              )}
              style={{ height: `${h * 0.82}%` }}
            />
          </div>
        ))}
      </div>
      <div className="mt-2 flex gap-2">
        {days.map((d, i) => (
          <span key={d} className={cn("flex-1 text-center text-[10.5px] font-semibold", i === 5 ? "text-tone-ink" : "text-faint")}>
            {d}
          </span>
        ))}
      </div>
    </div>
  );
}

function ProgressVisual() {
  return (
    <div className="w-full max-w-xs space-y-3">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2.5">
          <span className="tone-chip h-11 w-11 rounded-2xl font-display text-lg font-bold">7</span>
          <span className="leading-tight">
            <span className="block font-display text-[16px] font-semibold">Nivel 7</span>
            <span className="block text-[11.5px] text-muted tabular">1.240 / 1.800 XP</span>
          </span>
        </span>
        <span className="rounded-full bg-gradient-to-r from-tone to-tone-2 px-2 py-0.5 text-[11px] font-bold text-white shadow-[0_4px_10px_-4px_var(--tone)]">+20 XP</span>
      </div>
      <ProgressBar value={0.69} size="lg" />
      <div className="flex flex-wrap gap-1.5">
        {[
          [Medal, "Primera semana"],
          [Star, "10 h de enfoque"],
          [Flame, "Racha de 7 días"],
        ].map(([Icon, label]) => {
          const I = Icon as LucideIcon;
          return (
            <span key={label as string} className="inline-flex items-center gap-1 rounded-full bg-tone-soft px-2 py-1 text-[11px] font-semibold text-tone-ink">
              <I size={12} /> {label as string}
            </span>
          );
        })}
      </div>
    </div>
  );
}
