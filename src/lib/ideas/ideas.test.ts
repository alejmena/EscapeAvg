import { describe, expect, it } from "vitest";
import { AREAS, IDEAS, IDEA_BY_KEY } from "./catalog";
import { connections, filterIdeas, floatingSample, isGold, isKeyLevel } from "./ideas";

describe("catálogo de ideas", () => {
  it("tiene cientos de ideas con claves únicas y valores en rango", () => {
    expect(IDEAS.length).toBeGreaterThan(400);
    expect(new Set(IDEAS.map((i) => i.key)).size).toBe(IDEAS.length);
    for (const i of IDEAS) {
      expect(i.difficulty, i.key).toBeGreaterThanOrEqual(1);
      expect(i.difficulty, i.key).toBeLessThanOrEqual(5);
      expect(i.future, i.key).toBeGreaterThanOrEqual(1);
      expect(i.future, i.key).toBeLessThanOrEqual(5);
      expect(i.money, i.key).toBeGreaterThanOrEqual(1);
      expect(i.money, i.key).toBeLessThanOrEqual(5);
      expect(i.hours, i.key).toBeGreaterThan(0);
      expect(i.how.length, i.key).toBeGreaterThan(20);
      expect(i.key.length).toBeLessThanOrEqual(80);
    }
  });

  it("todas las ideas complementarias existen y cada área tiene ideas", () => {
    for (const i of IDEAS) for (const c of i.complements) expect(IDEA_BY_KEY.has(c), `${i.key} → ${c}`).toBe(true);
    for (const a of AREAS) expect(IDEAS.some((i) => i.area === a.key), a.key).toBe(true);
  });

  it("los idiomas usan el MCER, crecen en horas y destacan B1/B2", () => {
    const en = ["a1", "a2", "b1", "b2", "c1", "c2"].map((l) => IDEA_BY_KEY.get(`lang-english-${l}`)!);
    expect(en.map((i) => i.level)).toEqual(["A1", "A2", "B1", "B2", "C1", "C2"]);
    for (let k = 1; k < en.length; k++) expect(en[k].hours).toBeGreaterThan(en[k - 1].hours);
    expect(isKeyLevel(en[2]) && isKeyLevel(en[3])).toBe(true);
    expect(isKeyLevel(en[0])).toBe(false);
    expect(IDEA_BY_KEY.get("lang-chinese-b1")!.hours).toBeGreaterThan(en[2].hours);
  });

  it("las doradas son una minoría y siguen el criterio publicado", () => {
    const gold = IDEAS.filter(isGold);
    expect(gold.length).toBeGreaterThan(20);
    expect(gold.length).toBeLessThan(IDEAS.length / 3);
    expect(isGold(IDEA_BY_KEY.get("ukulele")!)).toBe(false);
    expect(isGold(IDEA_BY_KEY.get("javascript")!)).toBe(true);
  });

  it("filtra por área, dificultad, duración, búsqueda sin tildes y doradas", () => {
    const langs = filterIdeas({ area: "lenguas" });
    expect(langs.every((i) => i.area === "lenguas")).toBe(true);
    expect(filterIdeas({ difficulty: 1 }).every((i) => i.difficulty === 1)).toBe(true);
    expect(filterIdeas({ duration: "short" }).every((i) => i.hours < 20)).toBe(true);
    expect(filterIdeas({ q: "fisica" }).some((i) => i.key === "physics")).toBe(true);
    expect(filterIdeas({ goldOnly: true }).every(isGold)).toBe(true);
    expect(filterIdeas({ sort: "quick" })[0].hours).toBeLessThanOrEqual(filterIdeas({ sort: "quick" })[1].hours);
  });

  it("calcula conexiones en ambos sentidos y una muestra estable", () => {
    expect(connections("css").map((i) => i.key)).toEqual(expect.arrayContaining(["html", "javascript", "tailwind"]));
    const a = floatingSample(IDEAS, 20, 7).map((i) => i.key);
    expect(a).toHaveLength(20);
    expect(floatingSample(IDEAS, 20, 7).map((i) => i.key)).toEqual(a);
  });
});
