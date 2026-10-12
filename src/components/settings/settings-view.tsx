"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CircleCheck,
  Crown,
  EyeOff,
  Flame,
  Globe2,
  Lock,
  Monitor,
  Moon,
  Plus,
  ShieldCheck,
  Sun,
  Tags,
  Timer,
  Trash2,
  UserRound,
  Users,
  type LucideIcon,
} from "lucide-react";
import type { PomodoroSettings } from "@/lib/domain/timer";
import type { Category } from "@/lib/types";
import { createCategory, deleteCategory, updateCategory, updateProfile } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Badge, Card, EmptyState, PageHeader } from "@/components/ui/card";
import { ErrorText, Field, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";
import { WEEKDAY_NAME } from "@/lib/format";
import { formatDuration } from "@/lib/domain/stats";
import { GoalPicker } from "@/components/discipline/goal-picker";
import { setTheme, useTheme, type Theme } from "@/components/theme-toggle";
import { cn } from "@/lib/cn";
import type { Tone } from "@/lib/sections";

type ProfileForm = {
  display_name: string;
  timezone: string;
  week_starts_on: number;
  weekly_focus_goal_minutes: number;
  streaks_enabled: boolean;
  pomodoro_settings: PomodoroSettings;
};

// Secciones de la página (índice lateral y anclas). Cada una con su color.
const NAV: { id: string; label: string; icon: LucideIcon; tone: Tone }[] = [
  { id: "objetivo", label: "Objetivo diario", icon: Crown, tone: "gold" },
  { id: "perfil", label: "Perfil", icon: UserRound, tone: "violet" },
  { id: "concentracion", label: "Concentración", icon: Timer, tone: "coral" },
  { id: "categorias", label: "Categorías", icon: Tags, tone: "teal" },
  { id: "privacidad", label: "Privacidad", icon: ShieldCheck, tone: "green" },
];

/** Sección visible ahora mismo (para resaltar el índice): la última cuyo inicio ya pasó el 30 % superior. */
function useActiveSection() {
  const [active, setActive] = useState(NAV[0].id);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const line = innerHeight * 0.3;
      const atEnd = innerHeight + scrollY >= document.documentElement.scrollHeight - 4;
      let current = NAV[0].id;
      for (const n of NAV) {
        const el = document.getElementById(n.id);
        if (el && el.getBoundingClientRect().top <= line) current = n.id;
      }
      setActive(atEnd ? NAV[NAV.length - 1].id : current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    addEventListener("scroll", onScroll, { passive: true });
    addEventListener("resize", onScroll);
    return () => {
      removeEventListener("scroll", onScroll);
      removeEventListener("resize", onScroll);
      cancelAnimationFrame(frame);
    };
  }, []);
  return [active, setActive] as const;
}

function goTo(id: string, e: React.MouseEvent) {
  const el = document.getElementById(id);
  if (!el) return;
  e.preventDefault();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  el.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  history.replaceState(null, "", `#${id}`);
}

export function SettingsView({
  email,
  profile,
  categories,
  goalMinutes,
  ready,
}: {
  email: string;
  profile: ProfileForm;
  categories: Category[];
  goalMinutes: number;
  ready: boolean;
}) {
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);
  // Última versión guardada: sirve para avisar de cambios pendientes.
  const [snapshot, setSnapshot] = useState(() => JSON.stringify(profile));
  const dirty = JSON.stringify(p) !== snapshot;
  const { run, pending, error } = useAction();
  const [active, setActive] = useActiveSection();
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
    } catch {
      return [profile.timezone];
    }
  }, [profile.timezone]);
  const pom = p.pomodoro_settings;
  const setPom = (k: keyof PomodoroSettings, v: number) => setP({ ...p, pomodoro_settings: { ...pom, [k]: v } });
  const name = p.display_name.trim();
  const city = p.timezone.split("/").pop()?.replace(/_/g, " ") ?? p.timezone;

  return (
    <div>
      <PageHeader title="Ajustes" />

      {/* Tarjeta de la cuenta (protagonista) */}
      <Card variant="feature" tone="indigo" className="mb-6 overflow-hidden sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full border-[28px] border-white/10" aria-hidden />
        <div className="pointer-events-none absolute -bottom-24 right-24 h-48 w-48 rounded-full bg-white/10 blur-2xl" aria-hidden />
        <div className="relative flex flex-wrap items-center gap-4 sm:gap-5">
          <span className="grid h-16 w-16 shrink-0 place-items-center rounded-[22px] bg-white/20 font-display text-[28px] font-bold shadow-[0_1px_0_rgb(255_255_255/0.4)_inset,0_12px_24px_-12px_rgb(0_0_0/0.4)] ring-1 ring-white/30 backdrop-blur sm:h-20 sm:w-20 sm:rounded-[26px] sm:text-[34px]">
            {(name || email).charAt(0).toUpperCase() || "?"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-bold uppercase tracking-[0.16em] text-white/70">Tu cuenta</p>
            <p className="truncate font-display text-[24px] font-bold leading-tight tracking-tight sm:text-[28px]">{name || "Sin nombre"}</p>
            <p className="truncate text-sm text-white/80">{email}</p>
          </div>
        </div>
        <ul className="relative mt-5 flex flex-wrap gap-2 text-[12.5px] font-semibold">
          {[
            { icon: Globe2, text: city },
            { icon: CalendarDays, text: `Semana desde el ${WEEKDAY_NAME[p.week_starts_on]?.toLowerCase() ?? ""}` },
            { icon: Timer, text: `Pomodoro de ${pom.focus_minutes || 0} min` },
            { icon: Flame, text: p.streaks_enabled ? "Rachas visibles" : "Rachas ocultas" },
          ].map(({ icon: Icon, text }) => (
            <li key={text} className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 backdrop-blur">
              <Icon size={14} aria-hidden /> {text}
            </li>
          ))}
        </ul>
      </Card>

      {/* Índice en móvil */}
      <div className="-mx-4 mb-6 overflow-x-auto px-4 [scrollbar-width:none] sm:-mx-6 sm:px-6 lg:hidden">
        <nav className="seg" aria-label="Secciones de ajustes">
          {NAV.map(({ id, label, icon: Icon, tone }) => (
            <a
              key={id}
              href={`#${id}`}
              data-tone={tone}
              aria-current={active === id ? "true" : undefined}
              onClick={(e) => {
                setActive(id);
                goTo(id, e);
              }}
            >
              <Icon size={14} className="text-tone" aria-hidden />
              {label}
            </a>
          ))}
        </nav>
      </div>

      <div className="lg:grid lg:grid-cols-[196px_minmax(0,1fr)] lg:gap-8 xl:gap-10">
        {/* Índice en escritorio */}
        <aside className="hidden lg:block">
          <nav className="sticky top-10" aria-label="Secciones de ajustes">
            <p className="mb-2 px-3 text-[10.5px] font-bold uppercase tracking-[0.14em] text-faint">En esta página</p>
            <ul className="space-y-0.5">
              {NAV.map(({ id, label, icon: Icon, tone }) => {
                const on = active === id;
                return (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      data-tone={tone}
                      aria-current={on ? "true" : undefined}
                      onClick={(e) => {
                        setActive(id);
                        goTo(id, e);
                      }}
                      className={cn(
                        "press group relative flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-sm transition-colors",
                        on ? "bg-surface font-semibold text-text shadow-[0_1px_2px_rgb(21_19_43/0.06),0_0_0_1px_var(--card-edge)] dark:bg-surface-2" : "text-muted hover:bg-surface/60 hover:text-text",
                      )}
                    >
                      <span className={cn("h-7 w-7 rounded-[9px] transition-transform duration-300 group-hover:scale-105", on ? "tone-chip" : "tone-chip-soft")}>
                        <Icon size={14} aria-hidden />
                      </span>
                      {label}
                      {on && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-tone" aria-hidden />}
                    </a>
                  </li>
                );
              })}
            </ul>
          </nav>
        </aside>

        <div className="min-w-0 max-w-3xl space-y-6">
          <section id="objetivo" className="scroll-mt-24">
            <GoalPicker goalMinutes={goalMinutes} ready={ready} />
          </section>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              setSaved(false);
              const submitted = p;
              run(
                () => updateProfile({ ...submitted, display_name: submitted.display_name || null }),
                () => {
                  setSnapshot(JSON.stringify(submitted));
                  setSaved(true);
                },
              );
            }}
            className="space-y-6"
          >
            <section id="perfil" className="scroll-mt-24">
              <Card data-reveal>
                <SectionHeading icon={UserRound} tone="violet" title="Perfil" description="Cómo te llamamos y qué cuenta como «hoy» en tus datos." />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Nombre" htmlFor="dn">
                    <Input id="dn" maxLength={60} value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
                  </Field>
                  <Field label="Zona horaria" htmlFor="tz" hint="Define qué cuenta como 'hoy' en tus estadísticas.">
                    <Select id="tz" value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })}>
                      {(zones.includes(p.timezone) ? zones : [p.timezone, ...zones]).map((z) => (
                        <option key={z} value={z}>
                          {z}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <Field label="La semana empieza el" htmlFor="ws">
                    <Select id="ws" value={p.week_starts_on} onChange={(e) => setP({ ...p, week_starts_on: Number(e.target.value) })}>
                      {[1, 0, 6].map((d) => (
                        <option key={d} value={d}>
                          {WEEKDAY_NAME[d]}
                        </option>
                      ))}
                    </Select>
                  </Field>
                  <div className="sm:col-span-2">
                    <p className="mb-1.5 text-xs font-semibold text-muted">Tema</p>
                    <ThemePicker />
                  </div>
                </div>
              </Card>
            </section>

            <section id="concentracion" className="scroll-mt-24">
              <Card data-reveal>
                <SectionHeading icon={Timer} tone="coral" title="Concentración" description="Tu ritmo de pomodoros y tu meta semanal." />
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <Field label="Pomodoro (min)" htmlFor="pf">
                    <Input id="pf" type="number" min={1} max={180} value={pom.focus_minutes} onChange={(e) => setPom("focus_minutes", Number(e.target.value))} />
                  </Field>
                  <Field label="Descanso corto" htmlFor="ps">
                    <Input id="ps" type="number" min={1} max={60} value={pom.short_break_minutes} onChange={(e) => setPom("short_break_minutes", Number(e.target.value))} />
                  </Field>
                  <Field label="Descanso largo" htmlFor="pl">
                    <Input id="pl" type="number" min={1} max={90} value={pom.long_break_minutes} onChange={(e) => setPom("long_break_minutes", Number(e.target.value))} />
                  </Field>
                  <Field label="Largo cada" htmlFor="pn" hint="pomodoros">
                    <Input
                      id="pn"
                      type="number"
                      min={1}
                      max={12}
                      value={pom.sessions_before_long_break}
                      onChange={(e) => setPom("sessions_before_long_break", Number(e.target.value))}
                    />
                  </Field>
                </div>

                <CyclePreview pom={pom} />

                <div className="mt-5 grid gap-4 sm:grid-cols-2">
                  <Field label="Objetivo semanal de concentración (min)" htmlFor="wg">
                    <Input
                      id="wg"
                      type="number"
                      min={0}
                      max={10080}
                      value={p.weekly_focus_goal_minutes}
                      onChange={(e) => setP({ ...p, weekly_focus_goal_minutes: Number(e.target.value) })}
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1.5">
                      <p className="text-xs text-muted">0 para no mostrarlo.</p>
                      {p.weekly_focus_goal_minutes > 0 && (
                        <p className="inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-2.5 py-1 text-xs font-semibold text-tone-ink" data-tone="coral">
                          <Timer size={12} aria-hidden />
                          {formatDuration(p.weekly_focus_goal_minutes * 60)} a la semana · {formatDuration((p.weekly_focus_goal_minutes * 60) / 7)} al día
                        </p>
                      )}
                    </div>
                  </Field>
                  <label
                    data-tone="orange"
                    className="flex cursor-pointer items-center gap-3 self-start rounded-2xl border border-border bg-surface/60 p-3 text-sm transition-colors hover:bg-surface sm:mt-5"
                  >
                    <span className="tone-chip-soft h-9 w-9 rounded-xl" aria-hidden>
                      <Flame size={17} />
                    </span>
                    <span className="min-w-0 flex-1 leading-snug">Mostrar rachas (los días de descanso nunca las rompen)</span>
                    <Switch checked={p.streaks_enabled} onChange={(v) => setP({ ...p, streaks_enabled: v })} />
                  </label>
                </div>
              </Card>
            </section>

            {/* Barra de guardado: con cambios pendientes flota a la vista mientras sigues editando. */}
            <div className={cn("z-10", dirty ? "sticky bottom-[calc(6.25rem+env(safe-area-inset-bottom))] lg:bottom-6" : "relative")}>
              <div
                className={cn(
                  "glass flex flex-wrap items-center gap-x-3 gap-y-2 rounded-[22px] border p-2 pl-4 shadow-pop transition-colors duration-300",
                  dirty ? "border-warning/40" : "border-card-border",
                )}
              >
                <span className="flex min-w-0 flex-1 items-center gap-2 text-sm">
                  {dirty ? (
                    <>
                      <span className="live-dot shrink-0" data-tone="amber" aria-hidden />
                      <span className="font-medium">Cambios sin guardar</span>
                    </>
                  ) : saved ? (
                    <span className="pop-in flex items-center gap-1.5 font-semibold text-success">
                      <CircleCheck size={17} aria-hidden /> Guardado
                    </span>
                  ) : (
                    <span className="text-muted">Todo al día</span>
                  )}
                </span>
                <ErrorText>{error}</ErrorText>
                <Button type="submit" disabled={pending}>
                  {pending ? "Guardando…" : "Guardar cambios"}
                </Button>
              </div>
            </div>
          </form>

          <section id="categorias" className="scroll-mt-24">
            <CategoriesCard categories={categories} ready={ready} />
          </section>

          <section id="privacidad" className="scroll-mt-24">
            <Card variant="tint" tone="green" data-reveal>
              <SectionHeading icon={ShieldCheck} tone="green" title="Privacidad" description="Lo que guardas es tuyo. Lo que compartes, lo decides tú." />
              <ul className="mb-4 grid gap-2.5 sm:grid-cols-3">
                {[
                  { icon: Lock, title: "Solo tu cuenta", text: "lee y escribe tus registros" },
                  { icon: Users, title: "Opcional y recíproco", text: "con amigos o grupos" },
                  { icon: EyeOff, title: "Solo totales", text: "nunca títulos ni notas" },
                ].map(({ icon: Icon, title, text }) => (
                  <li key={title} className="flex items-center gap-3 rounded-2xl border border-card-border bg-surface/70 p-3">
                    <span className="tone-chip-soft h-9 w-9 rounded-xl" aria-hidden>
                      <Icon size={16} />
                    </span>
                    <span className="min-w-0 leading-tight">
                      <span className="block text-sm font-semibold">{title}</span>
                      <span className="block text-xs text-muted">{text}</span>
                    </span>
                  </li>
                ))}
              </ul>
              <p className="text-sm leading-relaxed text-muted">
                Tus datos son privados: la base de datos solo permite que tu cuenta lea y escriba tus registros. Compartir estadísticas con amigos
                o grupos es opcional y recíproco, y solo incluye totales (nunca títulos ni notas). Lo decides en{" "}
                <Link href="/social" className="group inline-flex items-center gap-0.5 font-semibold text-tone-ink underline-offset-4 hover:underline">
                  Social
                  <ArrowRight size={13} className="transition-transform group-hover:translate-x-0.5" aria-hidden />
                </Link>
                .
              </p>
            </Card>
          </section>
        </div>
      </div>
    </div>
  );
}

/** Cabecera de sección: ficha de icono con su color, título y descripción. */
function SectionHeading({
  icon: Icon,
  tone,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  tone: Tone;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex items-start gap-3.5" data-tone={tone}>
      <span className="tone-chip h-11 w-11 rounded-2xl" aria-hidden>
        <Icon size={20} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 className="flex flex-wrap items-center gap-2 font-display text-[19px] font-semibold leading-tight tracking-tight">{title}</h2>
        {description && <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

/** Interruptor accesible: sigue siendo un checkbox real (con su estado), solo cambia su aspecto. */
function Switch({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <span className="relative inline-flex h-6 w-11 shrink-0">
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        aria-label={label}
        className="peer absolute inset-0 z-10 m-0 h-full w-full cursor-pointer appearance-none rounded-full focus-visible:outline-none disabled:cursor-not-allowed"
      />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-full bg-surface-3 shadow-[inset_0_1px_2px_rgb(21_19_43/0.14)] transition-colors duration-300 peer-checked:bg-gradient-to-r peer-checked:from-tone peer-checked:to-tone-2 peer-focus-visible:shadow-[0_0_0_3px_var(--ring)] peer-disabled:opacity-50"
      />
      {/* Botón blanco sobre la pista de color, como el texto blanco sobre degradados. */}
      <span
        aria-hidden
        className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-[0_2px_5px_rgb(0_0_0/0.22)] transition-transform duration-300 ease-[var(--ease-spring)] peer-checked:translate-x-5"
      />
    </span>
  );
}

/** Un ciclo de pomodoros dibujado a escala: enfoque, descansos cortos y el descanso largo. */
function CyclePreview({ pom }: { pom: PomodoroSettings }) {
  const focus = Math.max(0, pom.focus_minutes || 0);
  const short = Math.max(0, pom.short_break_minutes || 0);
  const long = Math.max(0, pom.long_break_minutes || 0);
  const n = Math.min(12, Math.max(1, Math.round(pom.sessions_before_long_break || 1)));
  const total = n * focus + (n - 1) * short + long;
  const blocks = Array.from({ length: n }, (_, i) => [
    { key: `f${i}`, minutes: focus, tone: "coral" as Tone },
    { key: `b${i}`, minutes: i === n - 1 ? long : short, tone: (i === n - 1 ? "sky" : "teal") as Tone },
  ]).flat();
  return (
    <div className="mt-5 rounded-2xl border border-border bg-surface-2/50 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-sm font-semibold">Tu ciclo</p>
        <p className="text-xs text-muted">
          <span className="font-display text-[15px] font-bold text-text tabular">{formatDuration(total * 60)}</span> hasta el descanso largo incluido
        </p>
      </div>
      <div className="mt-3 flex h-3.5 gap-[3px]" aria-hidden>
        {blocks.map((b) => (
          <span
            key={b.key}
            data-tone={b.tone}
            className="h-full min-w-[3px] rounded-full bg-gradient-to-r from-tone to-tone-2 transition-[flex-grow] duration-500 ease-[var(--ease-out)]"
            style={{ flexGrow: Math.max(b.minutes, 0.5), flexBasis: 0 }}
          />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        {[
          ["coral", "Enfoque"],
          ["teal", "Descanso corto"],
          ["sky", "Descanso largo"],
        ].map(([tone, label]) => (
          <span key={label} className="inline-flex items-center gap-1.5" data-tone={tone}>
            <span className="h-2 w-2 rounded-full bg-tone" aria-hidden />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
}

// --- Tema (claro, oscuro o el del sistema). Comparte estado con el selector de la barra lateral. ---
const THEMES: { value: Theme; label: string; hint: string; icon: LucideIcon; tone: Tone }[] = [
  { value: "light", label: "Claro", hint: "Luminoso y nítido", icon: Sun, tone: "amber" },
  { value: "dark", label: "Oscuro", hint: "Descansa la vista", icon: Moon, tone: "indigo" },
  { value: "system", label: "Sistema", hint: "Sigue a tu dispositivo", icon: Monitor, tone: "slate" },
];

function ThemePicker() {
  const theme = useTheme();
  const choose = setTheme;
  return (
    <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tema">
      {THEMES.map(({ value, label, hint, icon: Icon, tone }) => {
        const on = theme === value;
        return (
          <button
            key={value}
            type="button"
            role="radio"
            aria-checked={on}
            data-tone={tone}
            onClick={() => choose(value)}
            className={cn(
              "press relative flex min-w-0 flex-col items-start gap-2 rounded-2xl border p-3 text-left transition-[border-color,background-color,box-shadow] duration-300",
              on ? "border-tone/50 bg-tone-soft shadow-[0_10px_22px_-14px_var(--tone)]" : "border-border bg-surface/60 hover:bg-surface",
            )}
          >
            <span className={cn("h-9 w-9 rounded-xl transition-transform duration-300", on ? "tone-chip scale-105" : "tone-chip-soft")}>
              <Icon size={17} aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-sm font-semibold">{label}</span>
              <span className="hidden text-xs text-muted sm:block">{hint}</span>
            </span>
            {on && (
              <span className="pop-in absolute right-2.5 top-2.5 grid h-5 w-5 place-items-center rounded-full bg-tone text-white" aria-hidden>
                <CircleCheck size={14} />
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}

// --- Categorías ---
const PRESETS: [string, string][] = [
  ["#6366f1", "índigo"],
  ["#0ea5e9", "cielo"],
  ["#10b981", "esmeralda"],
  ["#f59e0b", "ámbar"],
  ["#ef4444", "rojo"],
  ["#ec4899", "rosa"],
  ["#8b5cf6", "violeta"],
  ["#14b8a6", "turquesa"],
];

function ColorSwatch({ value, onChange, onBlur, label, size = "md" }: { value: string; onChange: (v: string) => void; onBlur?: () => void; label: string; size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "relative shrink-0 rounded-xl ring-1 ring-inset ring-[var(--card-edge)] transition-transform duration-200 focus-within:ring-2 focus-within:ring-[var(--ring)] hover:scale-110",
        size === "sm" ? "h-8 w-8" : "h-10 w-10",
      )}
      style={{ background: value, boxShadow: `0 6px 14px -6px ${value}` }}
    >
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        className="absolute inset-0 h-full w-full cursor-pointer rounded-xl opacity-0"
        aria-label={label}
      />
    </span>
  );
}

function CategoriesCard({ categories, ready }: { categories: Category[]; ready: boolean }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const { run, pending, error } = useAction();
  return (
    <Card data-reveal>
      <SectionHeading
        icon={Tags}
        tone="teal"
        title={
          <>
            Categorías
            <Badge variant="tone" className="font-sans">
              {categories.length}
            </Badge>
          </>
        }
        description="Las horas de una categoría cuentan para tu rango si está marcada como desarrollo. Desmárcala para tiempo que no quieres contar (ocio, comidas, recados)."
      />
      {categories.length === 0 ? (
        <div data-tone="teal" className="mb-4">
          <EmptyState icon={<Tags />} title="Aún no tienes categorías">
            Crea la primera abajo para clasificar tareas, hábitos y actividades.
          </EmptyState>
        </div>
      ) : (
        <ul className="-mx-2 mb-4 space-y-1">
          {categories.map((c) => (
            <CategoryRow key={c.id} category={c} ready={ready} />
          ))}
        </ul>
      )}
      <form
        className="rounded-2xl border border-dashed border-border-strong bg-surface/40 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createCategory({ name, color }), () => setName(""));
        }}
      >
        <div className="flex gap-2">
          <ColorSwatch value={color} onChange={setColor} label="Color" />
          <Input placeholder="Nueva categoría" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de categoría" />
          <Button type="submit" variant="tone" disabled={pending || !name.trim()} data-tone="teal">
            <Plus size={16} aria-hidden />
            Añadir
          </Button>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-1.5">
          <span className="mr-1 text-xs text-muted">Colores rápidos</span>
          {PRESETS.map(([hex, label]) => (
            <button
              key={hex}
              type="button"
              onClick={() => setColor(hex)}
              aria-label={`Color ${label}`}
              aria-pressed={color === hex}
              className={cn(
                "press h-6 w-6 rounded-full ring-offset-2 ring-offset-surface transition-transform hover:scale-110",
                color === hex && "ring-2 ring-[var(--ring)] scale-110",
              )}
              style={{ background: hex }}
            />
          ))}
        </div>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function CategoryRow({ category, ready }: { category: Category; ready: boolean }) {
  const [counts, setCounts] = useState(category.counts_as_development !== false);
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const { run, error } = useAction();
  const save = (n = name, c = color) => {
    if (n.trim() && (n !== category.name || c !== category.color)) run(() => updateCategory(category.id, { name: n, color: c }));
  };
  return (
    <li className="group flex flex-wrap items-center gap-2 rounded-2xl px-2 py-1.5 transition-colors hover:bg-surface-2/60 sm:gap-3">
      <ColorSwatch value={color} onChange={setColor} onBlur={() => save()} label={`Color de ${category.name}`} size="sm" />
      <input
        value={name}
        maxLength={40}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => save()}
        aria-label="Nombre"
        className="h-10 min-w-0 flex-1 rounded-xl border border-transparent bg-transparent px-3 text-sm font-medium text-text transition-[border-color,background-color,box-shadow] hover:border-border hover:bg-surface/70 focus:border-accent focus:bg-surface focus:shadow-[0_0_0_4px_var(--ring)] focus:outline-none"
      />
      {ready && (
        <label className="flex shrink-0 cursor-pointer items-center gap-2 text-xs font-medium text-muted" title="Cuenta para tus horas de desarrollo" data-tone="teal">
          <span className={cn("hidden transition-colors sm:inline", counts && "text-tone-ink")}>Desarrollo</span>
          <Switch
            checked={counts}
            onChange={(v) => {
              setCounts(v);
              run(() => updateCategory(category.id, { name: name.trim() || category.name, color, counts_as_development: v }));
            }}
            label={`${category.name} cuenta como desarrollo`}
          />
        </label>
      )}
      <Button
        variant="ghost"
        size="icon"
        className="hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-focus-within:opacity-100 [@media(hover:hover)]:group-hover:opacity-100"
        aria-label={`Eliminar ${category.name}`}
        onClick={() => confirm(`¿Eliminar "${category.name}"? Sus tareas y hábitos se conservan sin categoría.`) && run(() => deleteCategory(category.id))}
      >
        <Trash2 size={15} aria-hidden />
      </Button>
      {error && <span className="w-full pl-11 text-xs text-danger">{error}</span>}
    </li>
  );
}
