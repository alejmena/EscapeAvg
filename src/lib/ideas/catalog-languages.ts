import type { Cefr, Idea, IdeaRow } from "./types";

/**
 * Horas orientativas acumuladas desde cero para cada nivel del MCER. Base: la guía de «horas de
 * aprendizaje guiado» de Cambridge English para inglés (≈ A2 180-200 h, B1 350-400 h, B2 500-600 h,
 * C1 700-800 h, C2 1000-1200 h). Para otros idiomas se ajusta con la dificultad relativa del FSI
 * (Foreign Service Institute de EE. UU.), adaptada a hispanohablantes. Son estimaciones, no promesas.
 */
export const CEFR_HOURS: Record<Cefr, number> = { A1: 100, A2: 200, B1: 400, B2: 600, C1: 800, C2: 1200 };
export const CEFR_LEVELS: Cefr[] = ["A1", "A2", "B1", "B2", "C1", "C2"];
export const CEFR_LABEL: Record<Cefr, string> = {
  A1: "principiante: frases muy básicas",
  A2: "básico: situaciones cotidianas sencillas",
  B1: "intermedio: te defiendes en viajes, trabajo y conversaciones",
  B2: "intermedio alto: trabajas y estudias en el idioma con soltura",
  C1: "avanzado: te expresas con fluidez y precisión",
  C2: "maestría: casi como un nativo culto",
};

type Lang = {
  slug: string;
  name: string;
  /** Multiplicador de horas respecto al inglés para un hispanohablante. */
  factor: number;
  future: number;
  money: number;
  exam: string | null;
};

const LANGS: Lang[] = [
  { slug: "english", name: "inglés", factor: 1, future: 5, money: 5, exam: "Cambridge (B1 Preliminary, B2 First, C1 Advanced, C2 Proficiency) o IELTS/TOEFL" },
  { slug: "chinese", name: "chino mandarín", factor: 2.5, future: 4, money: 4, exam: "HSK (examen oficial de chino; no usa el MCER directamente)" },
  { slug: "german", name: "alemán", factor: 1.3, future: 4, money: 4, exam: "Goethe-Zertifikat" },
  { slug: "french", name: "francés", factor: 0.8, future: 4, money: 3, exam: "DELF / DALF" },
  { slug: "portuguese", name: "portugués", factor: 0.6, future: 4, money: 3, exam: "CAPLE (Portugal) o Celpe-Bras (Brasil)" },
  { slug: "italian", name: "italiano", factor: 0.6, future: 3, money: 2, exam: "CILS o CELI" },
  { slug: "japanese", name: "japonés", factor: 2.5, future: 3, money: 3, exam: "JLPT (N5 a N1; no usa el MCER directamente)" },
  { slug: "korean", name: "coreano", factor: 2.5, future: 3, money: 3, exam: "TOPIK" },
  { slug: "arabic", name: "árabe", factor: 2.5, future: 4, money: 3, exam: null },
  { slug: "russian", name: "ruso", factor: 1.6, future: 3, money: 3, exam: "TORFL (ТРКИ)" },
  { slug: "hindi", name: "hindi", factor: 1.6, future: 3, money: 2, exam: null },
  { slug: "turkish", name: "turco", factor: 1.6, future: 3, money: 2, exam: null },
  { slug: "dutch", name: "neerlandés", factor: 1.1, future: 3, money: 3, exam: "NT2" },
  { slug: "catalan", name: "catalán", factor: 0.4, future: 3, money: 2, exam: "Certificados oficiales de catalán" },
];

const HOW: Record<Cefr, string> = {
  A1: "15 minutos diarios con una app de idiomas y las 300 palabras más frecuentes en Anki. Aprende la pronunciación desde el primer día.",
  A2: "Un libro de curso de nivel A2 y una conversación semanal con un tutor online o un intercambio de idiomas.",
  B1: "Lecturas graduadas, series con subtítulos en el idioma y 2 conversaciones por semana. Escribe un diario breve en el idioma.",
  B2: "Lee artículos y libros originales, escucha pódcast nativos y practica debates. Prepara un examen oficial para tener una meta con fecha.",
  C1: "Consume todo en el idioma (noticias, libros, trabajo) y corrige tus escritos con un profesor.",
  C2: "Lee literatura y textos especializados, escribe ensayos y busca entornos donde solo uses el idioma.",
};

const clamp = (n: number) => Math.max(1, Math.min(5, n));

export function languageIdeas(): Idea[] {
  const out: Idea[] = [];
  for (const l of LANGS) {
    CEFR_LEVELS.forEach((level, i) => {
      const hard = l.factor >= 2;
      out.push({
        key: `lang-${l.slug}-${level.toLowerCase()}`,
        title: `Llegar a ${level} en ${l.name}`,
        area: "lenguas",
        level,
        difficulty: clamp([1, 2, 2, 3, 4, 5][i] + (hard ? 1 : 0)),
        hours: Math.round((CEFR_HOURS[level] * l.factor) / 10) * 10,
        future: clamp(l.future - (i < 2 ? 1 : 0)),
        money: clamp(l.money - (i < 2 ? 2 : i === 2 ? 1 : 0)),
        how: `${HOW[level]}${l.exam && i >= 2 ? ` Certificación: ${l.exam}.` : ""}`,
        complements: [i > 0 ? `lang-${l.slug}-${CEFR_LEVELS[i - 1].toLowerCase()}` : "lenguas-general", ...(i < 5 ? [`lang-${l.slug}-${CEFR_LEVELS[i + 1].toLowerCase()}`] : [])],
      });
    });
  }
  return out;
}

export const LANGUAGE_EXTRAS: IdeaRow[] = [
  ["lenguas-general", "Método para aprender cualquier idioma", 1, 10, 5, 3, "Lee «Fluent Forever» de Gabriel Wyner y monta tu sistema: frecuencia, pronunciación, Anki y conversación.", ["spaced-repetition"]],
  ["spanish-writing", "Ortografía y redacción impecables en español", 2, 30, 5, 4, "Consulta la Ortografía de la RAE y Fundéu; escribe un texto al día y corrígelo.", ["writing"]],
  ["poem-analysis", "Aprender a analizar poemas", 2, 20, 2, 1, "Métrica, rima y figuras retóricas; analiza un poema de Bécquer, Machado o Neruda por semana.", ["poetry-reading", "poetry-writing"]],
  ["spanish-literature", "Literatura en español (Siglo de Oro al boom)", 3, 120, 3, 1, "Lista de lectura: Lazarillo, Quijote, Bécquer, Galdós, Lorca, Borges, Rulfo, García Márquez.", ["literature", "don-quixote"]],
  ["linguistics", "Lingüística", 3, 50, 3, 2, "Lee «El instinto del lenguaje» de Steven Pinker.", ["lenguas-general"]],
  ["phonetics", "Fonética y alfabeto fonético (AFI)", 2, 20, 4, 2, "Aprende el AFI para leer la pronunciación de cualquier idioma en un diccionario.", ["lenguas-general"]],
  ["translation", "Traducción profesional", 4, 300, 4, 4, "Traduce textos reales de tu par de idiomas y compáralos con traducciones profesionales; necesitas nivel C1.", ["lang-english-c1"]],
  ["interpreting", "Interpretación", 5, 400, 4, 5, "Formación específica en interpretación consecutiva tras dominar dos idiomas a nivel C1-C2.", ["translation"]],
  ["latin", "Latín", 4, 150, 2, 1, "«Lingua Latina per se illustrata» de Hans Ørberg, un capítulo por semana.", ["history-ancient"]],
  ["ancient-greek", "Griego antiguo", 5, 200, 2, 1, "Método «Athenaze» y lecturas de la Odisea en versión adaptada.", ["odyssey", "philosophy-intro"]],
  ["chinese-characters", "Los 1000 caracteres chinos más usados", 4, 150, 4, 3, "Aprende radicales primero y luego 10 caracteres al día con Anki y escritura a mano.", ["lang-chinese-a2", "calligraphy"]],
  ["pinyin-tones", "Pinyin y tonos del chino", 2, 15, 4, 2, "Practica pares mínimos de tonos a diario y grábate.", ["lang-chinese-a1"]],
  ["english-pronunciation", "Pronunciación del inglés", 2, 30, 5, 4, "Shadowing: repite audios cortos imitando ritmo y entonación 10 minutos al día.", ["lang-english-b1"]],
  ["business-english", "Inglés para negocios", 3, 60, 5, 5, "Practica correos, reuniones y presentaciones; prepara el Cambridge Business English (BEC).", ["lang-english-b2"]],
  ["language-exchange", "Intercambio de idiomas semanal", 1, 50, 4, 2, "Busca un compañero en apps de intercambio y alterna 30 minutos en cada idioma.", ["lenguas-general"]],
];
