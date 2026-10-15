import type { Idea } from "./types";

type Format = {
  id: string;
  title: (seed: string) => string;
  how: (seed: string) => string;
  hours: number;
};

const FORMATS: Format[] = [
  {
    id: "semana",
    title: (seed) => `Reto de 7 días: ${seed}`,
    how: (seed) => `Dedica 15 minutos diarios durante una semana a «${seed}». Fija una meta pequeña, marca cada sesión y anota un avance concreto.`,
    hours: 2,
  },
  {
    id: "proyecto",
    title: (seed) => `Mini proyecto: ${seed}`,
    how: (seed) => `Convierte «${seed}» en un resultado visible: define algo que puedas terminar en una tarde, reúne lo necesario y compártelo al concluir.`,
    hours: 3,
  },
  {
    id: "explicarlo",
    title: (seed) => `Explícalo con tus palabras: ${seed}`,
    how: (seed) => `Practica «${seed}» y explícaselo a otra persona en cinco minutos sin leer apuntes. Anota lo que no pudiste explicar y repasa ese punto.`,
    hours: 1,
  },
  {
    id: "reto-practico",
    title: (seed) => `Resuelve un reto de: ${seed}`,
    how: (seed) => `Elige un problema real relacionado con «${seed}», prueba una solución pequeña y registra qué funcionó, cuánto tardaste y qué cambiarías.`,
    hours: 4,
  },
  {
    id: "bitacora",
    title: (seed) => `Bitácora de progreso: ${seed}`,
    how: (seed) => `Durante dos semanas registra cada sesión de «${seed}»: minutos, avance y una pregunta. Al final compara tus notas y decide el siguiente paso.`,
    hours: 3,
  },
  {
    id: "vida-diaria",
    title: (seed) => `Llévalo a la práctica: ${seed}`,
    how: (seed) => `Busca esta semana una oportunidad para usar «${seed}» en casa, estudio o trabajo. Hazlo y pide una sugerencia concreta para mejorar.`,
    hours: 2,
  },
];

function stableHash(value: string): string {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash = Math.imul(hash ^ value.charCodeAt(i), 16777619);
  }
  return (hash >>> 0).toString(36);
}

/** Completa el catálogo con retos concretos derivados de sus temas existentes. */
export function addInspirationIdeas(seeds: Idea[], targetCount: number): Idea[] {
  const missing = Math.max(0, targetCount - seeds.length);
  if (!missing || !seeds.length) return seeds;

  const generated: Idea[] = [];
  const usedKeys = new Set(seeds.map((seed) => seed.key));
  for (let round = 0; generated.length < missing; round += 1) {
    const format = FORMATS[round % FORMATS.length];
    const countThisRound = Math.min(seeds.length, missing - generated.length);
    for (let i = 0; i < countThisRound; i += 1) {
      const seedIndex = countThisRound === seeds.length ? i : Math.floor((i * seeds.length) / countThisRound);
      const seed = seeds[seedIndex];
      const baseKey = `inspire-${format.id}-${round}-${stableHash(seed.key)}`;
      let key = baseKey;
      let collision = 1;
      while (usedKeys.has(key)) {
        key = `${baseKey}-${collision}`;
        collision += 1;
      }
      usedKeys.add(key);
      generated.push({
        key,
        title: format.title(seed.title),
        area: seed.area,
        difficulty: seed.difficulty,
        hours: format.hours,
        future: seed.future,
        money: seed.money,
        how: format.how(seed.title),
        complements: [seed.key],
        ...(seed.level ? { level: seed.level } : {}),
      });
    }
  }

  return [...seeds, ...generated];
}
