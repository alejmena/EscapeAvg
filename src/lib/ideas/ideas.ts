import type { Idea, IdeaArea } from "./types";
import { IDEAS, IDEA_BY_KEY } from "./catalog";

/** Doradas: las que más te pueden dar. Criterio transparente: utilidad futura 5 y potencial económico 4 o 5. */
export function isGold(i: Pick<Idea, "future" | "money">): boolean {
  return i.future >= 5 && i.money >= 4;
}

/** Niveles de idioma más rentables por esfuerzo (B1 y B2): se destacan con otro color. */
export function isKeyLevel(i: Pick<Idea, "level">): boolean {
  return i.level === "B1" || i.level === "B2";
}

/** Ideas conectadas: las que esta complementa y las que la citan como complemento. */
export function connections(key: string, all: Idea[] = IDEAS): Idea[] {
  const own = IDEA_BY_KEY.get(key)?.complements ?? [];
  const set = new Set(own);
  for (const i of all) if (i.complements.includes(key)) set.add(i.key);
  set.delete(key);
  return [...set].map((k) => IDEA_BY_KEY.get(k)).filter((x): x is Idea => !!x);
}

const connectionCount = new Map<string, number>();
export function connectionsOf(key: string): number {
  if (!connectionCount.has(key)) connectionCount.set(key, connections(key).length);
  return connectionCount.get(key)!;
}

/** Puntuación para ordenar por valor: futuro pesa doble, luego dinero y cuántas cosas complementa. */
export function valueScore(i: Idea): number {
  return i.future * 2 + i.money + Math.min(3, connectionsOf(i.key) / 2);
}

export type DurationBucket = "short" | "medium" | "long" | "huge";
export const DURATIONS: { key: DurationBucket; label: string; test: (h: number) => boolean }[] = [
  { key: "short", label: "Menos de 20 h", test: (h) => h < 20 },
  { key: "medium", label: "20 – 100 h", test: (h) => h >= 20 && h <= 100 },
  { key: "long", label: "100 – 500 h", test: (h) => h > 100 && h <= 500 },
  { key: "huge", label: "Más de 500 h", test: (h) => h > 500 },
];

export type IdeaSort = "value" | "quick" | "easy" | "az";

export type IdeaFilter = {
  q?: string;
  area?: IdeaArea | null;
  difficulty?: number | null;
  duration?: DurationBucket | null;
  minFuture?: number | null;
  goldOnly?: boolean;
  sort?: IdeaSort;
};

const norm = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase();

export function filterIdeas(f: IdeaFilter, all: Idea[] = IDEAS): Idea[] {
  const q = f.q ? norm(f.q.trim()) : "";
  const dur = f.duration ? DURATIONS.find((d) => d.key === f.duration) : null;
  const out = all.filter(
    (i) =>
      (!f.area || i.area === f.area) &&
      (!f.difficulty || i.difficulty === f.difficulty) &&
      (!dur || dur.test(i.hours)) &&
      (!f.minFuture || i.future >= f.minFuture) &&
      (!f.goldOnly || isGold(i)) &&
      (!q || norm(`${i.title} ${i.how}`).includes(q)),
  );
  const sort = f.sort ?? "value";
  return out.sort((a, b) => {
    if (sort === "quick") return a.hours - b.hours || valueScore(b) - valueScore(a);
    if (sort === "easy") return a.difficulty - b.difficulty || valueScore(b) - valueScore(a);
    if (sort === "az") return a.title.localeCompare(b.title, "es");
    return valueScore(b) - valueScore(a) || a.hours - b.hours;
  });
}

/** Muestra variada para la nube flotante: algunas doradas y el resto mezclado, estable para una semilla. */
export function floatingSample(list: Idea[], n: number, seed: number): Idea[] {
  let s = seed || 1;
  const rand = () => {
    s = (s * 1103515245 + 12345) % 2147483648;
    return s / 2147483648;
  };
  const shuffled = list
    .map((i) => ({ i, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.i);
  const gold = shuffled.filter(isGold).slice(0, Math.ceil(n / 3));
  const rest = shuffled.filter((i) => !gold.includes(i)).slice(0, n - gold.length);
  return [...gold, ...rest]
    .map((i) => ({ i, r: rand() }))
    .sort((a, b) => a.r - b.r)
    .map((x) => x.i);
}

/** "40 h" / "1 200 h". */
export function formatHours(h: number): string {
  return `${h.toLocaleString("es-ES")} h`;
}
