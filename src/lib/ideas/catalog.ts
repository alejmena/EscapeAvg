import type { Idea, IdeaArea, IdeaRow } from "./types";
import { TECH } from "./catalog-tech";
import { WORK } from "./catalog-work";
import { SELF } from "./catalog-self";
import { LIFE } from "./catalog-life";
import { MORE } from "./catalog-more";
import { LANGUAGE_EXTRAS, languageIdeas } from "./catalog-languages";

export const AREAS: { key: IdeaArea; label: string; emoji: string; color: string }[] = [
  { key: "lenguas", label: "Idiomas y lenguas", emoji: "🗣️", color: "#0ab3ff" },
  { key: "tecnologia", label: "Tecnología y programación", emoji: "💻", color: "#5b4bf5" },
  { key: "datos", label: "Datos e IA", emoji: "🤖", color: "#8b5cf6" },
  { key: "diseno", label: "Diseño y creatividad digital", emoji: "🎨", color: "#ec4899" },
  { key: "negocios", label: "Negocios y emprendimiento", emoji: "🚀", color: "#f59e0b" },
  { key: "finanzas", label: "Finanzas e inversión", emoji: "💰", color: "#16a34a" },
  { key: "marketing", label: "Marketing y ventas", emoji: "📣", color: "#f97316" },
  { key: "oficios", label: "Oficios y trabajo manual", emoji: "🔨", color: "#a16207" },
  { key: "salud", label: "Salud y deporte", emoji: "💪", color: "#ef4444" },
  { key: "mente", label: "Mente y productividad", emoji: "🧠", color: "#6366f1" },
  { key: "filosofia", label: "Filosofía", emoji: "🏛️", color: "#64748b" },
  { key: "lectura", label: "Libros que leer", emoji: "📚", color: "#0ea5e9" },
  { key: "espiritual", label: "Espiritualidad", emoji: "🕊️", color: "#a855f7" },
  { key: "cultura", label: "Cultura, arte e historia", emoji: "🎭", color: "#db2777" },
  { key: "musica", label: "Música", emoji: "🎵", color: "#14b8a6" },
  { key: "social", label: "Social y comunicación", emoji: "🤝", color: "#f43f5e" },
  { key: "familia", label: "Familia y hogar", emoji: "🏡", color: "#84cc16" },
  { key: "cocina", label: "Cocina", emoji: "🍳", color: "#ea580c" },
  { key: "ciencia", label: "Ciencia y matemáticas", emoji: "🔬", color: "#2563eb" },
  { key: "naturaleza", label: "Naturaleza y aire libre", emoji: "🌿", color: "#22c55e" },
  { key: "servicio", label: "Ciudadanía y servicio", emoji: "🫶", color: "#0891b2" },
  { key: "habitos", label: "Hábitos diarios", emoji: "⏰", color: "#eab308" },
];

function fromRows(area: IdeaArea, rows: IdeaRow[]): Idea[] {
  return rows.map(([key, title, difficulty, hours, future, money, how, complements]) => ({
    key,
    title,
    area,
    difficulty,
    hours,
    future,
    money,
    how,
    complements: complements ?? [],
  }));
}

function build(): Idea[] {
  const out: Idea[] = [...languageIdeas(), ...fromRows("lenguas", LANGUAGE_EXTRAS)];
  for (const group of [TECH, WORK, SELF, LIFE, MORE]) {
    for (const [area, rows] of Object.entries(group) as [IdeaArea, IdeaRow[]][]) out.push(...fromRows(area, rows));
  }
  return out;
}

export const IDEAS: Idea[] = build();
export const IDEA_BY_KEY = new Map(IDEAS.map((i) => [i.key, i]));
