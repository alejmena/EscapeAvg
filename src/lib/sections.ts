import {
  BarChart3,
  BookOpenText,
  CalendarClock,
  CalendarDays,
  CheckSquare,
  Flame,
  LayoutDashboard,
  Lightbulb,
  ListChecks,
  Settings,
  StickyNote,
  Target,
  Timer,
  Trophy,
  Users,
} from "lucide-react";

/**
 * Cada sección tiene su color ("tono"). El AppShell pone `data-tone` en <main> y todo lo que use
 * `var(--tone)` dentro de la página (encabezado, chips, tarjetas destacadas) toma ese color.
 * Los tonos están definidos en globals.css.
 */
export type Tone =
  | "violet"
  | "indigo"
  | "blue"
  | "sky"
  | "cyan"
  | "teal"
  | "green"
  | "lime"
  | "amber"
  | "orange"
  | "coral"
  | "pink"
  | "fuchsia"
  | "gold"
  | "slate";

export type Section = {
  href: string;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
  tone: Tone;
};

export const SECTIONS = {
  dashboard: { href: "/dashboard", label: "Inicio", hint: "Resumen del día", icon: LayoutDashboard, tone: "violet" },
  plan: { href: "/plan", label: "Plan", hint: "Qué hacer hoy", icon: CalendarClock, tone: "indigo" },
  tasks: { href: "/tasks", label: "Tareas", hint: "Tus pendientes", icon: CheckSquare, tone: "blue" },
  focus: { href: "/focus", label: "Concentración", hint: "Temporizador", icon: Timer, tone: "coral" },
  habits: { href: "/habits", label: "Hábitos", hint: "Rutinas y rachas", icon: Flame, tone: "orange" },
  schedule: { href: "/schedule", label: "Horario", hint: "Tu semana tipo", icon: CalendarDays, tone: "teal" },
  ideas: { href: "/ideas", label: "Ideas", hint: "Habilidades para crecer", icon: Lightbulb, tone: "amber" },
  notes: { href: "/notes", label: "Notas", hint: "Tablero de ideas", icon: StickyNote, tone: "lime" },
  goals: { href: "/goals", label: "Objetivos", hint: "Metas medibles", icon: Target, tone: "green" },
  stats: { href: "/stats", label: "Estadísticas", hint: "Tus datos reales", icon: BarChart3, tone: "cyan" },
  progress: { href: "/progress", label: "Progreso", hint: "Nivel, XP y logros", icon: Trophy, tone: "gold" },
  philosophy: { href: "/philosophy", label: "Filosofía", hint: "Rangos y frases", icon: BookOpenText, tone: "fuchsia" },
  social: { href: "/social", label: "Social", hint: "Amigos y grupos", icon: Users, tone: "sky" },
  microtasks: { href: "/microtasks", label: "Tareas rápidas", hint: "Rutinas de cada día", icon: ListChecks, tone: "pink" },
  settings: { href: "/settings", label: "Ajustes", hint: "Tu cuenta y preferencias", icon: Settings, tone: "slate" },
} satisfies Record<string, Section>;

export type SectionKey = keyof typeof SECTIONS;

/** Secciones agrupadas por intención: hacer hoy, organizar y mirar tu evolución. */
export const NAV_GROUPS: { title: string; items: Section[] }[] = [
  { title: "Hoy", items: [SECTIONS.dashboard, SECTIONS.plan, SECTIONS.tasks, SECTIONS.focus, SECTIONS.habits] },
  { title: "Organiza", items: [SECTIONS.schedule, SECTIONS.ideas, SECTIONS.notes, SECTIONS.goals] },
  { title: "Tu evolución", items: [SECTIONS.stats, SECTIONS.progress, SECTIONS.philosophy, SECTIONS.social] },
];

const ALL: Section[] = Object.values(SECTIONS);

/** Sección de una ruta (la más específica que coincida). */
export function sectionFor(pathname: string): Section | null {
  let best: Section | null = null;
  for (const s of ALL) {
    if ((pathname === s.href || pathname.startsWith(`${s.href}/`)) && (!best || s.href.length > best.href.length)) best = s;
  }
  return best;
}
