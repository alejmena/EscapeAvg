import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, adminClient, asUser, createUser, resetDatabase } from "./harness";

const d = TEST_DATABASE_URL ? describe : describe.skip;
const MIGRATION = join(__dirname, "..", "..", "supabase/migrations/20261011000000_discipline.sql");

d("sistema de disciplina", () => {
  let admin: Client;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    await resetDatabase();
    admin = await adminClient();
    alice = await createUser(admin, { display_name: "Alice", timezone: "Europe/Madrid" });
    bob = await createUser(admin, { display_name: "Bob" });
  });

  afterAll(async () => {
    await admin?.end();
  });

  it("la migración es idempotente y no duplica categorías", async () => {
    await admin.query(readFileSync(MIGRATION, "utf8"));
    await admin.query(readFileSync(MIGRATION, "utf8"));
    const { rows } = await asUser(alice, (c) => c.query("select name from categories where name = 'Idiomas'"));
    expect(rows).toHaveLength(1);
  });

  it("añade las categorías de desarrollo a usuarios existentes sin tocar las suyas", async () => {
    // Usuario "antiguo": se borra una categoría por defecto y se renombra otra antes de reaplicar.
    await asUser(bob, (c) => c.query("delete from categories where name = 'Programación'"));
    await asUser(bob, (c) => c.query("update categories set name = 'Gimnasio' where name = 'Ejercicio'"));
    await admin.query(readFileSync(MIGRATION, "utf8"));
    const { rows } = await asUser(bob, (c) => c.query("select name from categories order by position, name"));
    const names = rows.map((r) => r.name);
    expect(names).toContain("Gimnasio");
    expect(names).not.toContain("Ejercicio");
    // La migración vuelve a ofrecer las que falten (aditivo), nunca borra.
    expect(names).toContain("Programación");
  });

  it("perfil con objetivo diario de 11 h por defecto y límites sanos", async () => {
    const { rows } = await asUser(alice, (c) => c.query("select daily_goal_minutes from profiles"));
    expect(rows[0].daily_goal_minutes).toBe(660);
    await asUser(alice, (c) => c.query("update profiles set daily_goal_minutes = 540 where id = $1", [alice]));
    await expect(asUser(alice, (c) => c.query("update profiles set daily_goal_minutes = 2000 where id = $1", [alice]))).rejects.toThrow(
      /daily_goal_minutes_range/,
    );
  });

  it("guarda nombre, categoría, calidad y resultados de una actividad", async () => {
    const { rows } = await asUser(alice, async (c) => {
      const cat = await c.query("select id from categories where name = 'Idiomas'");
      return c.query(
        `insert into focus_sessions (kind, started_at, ended_at, title, category_id, quality, outcome)
         values ('manual', now() - interval '3 hours', now() - interval '2 hours', 'Inglés B2', $1, 3, 'Unidad 4 terminada')
         returning title, quality, outcome, focus_seconds, category_id`,
        [cat.rows[0].id],
      );
    });
    expect(rows[0]).toMatchObject({ title: "Inglés B2", quality: 3, outcome: "Unidad 4 terminada", focus_seconds: 3600 });
  });

  it("la calidad solo admite 1, 2 o 3", async () => {
    await expect(
      asUser(alice, (c) =>
        c.query("insert into focus_sessions (kind, started_at, ended_at, quality) values ('manual', now() - interval '30 hours', now() - interval '29 hours', 7)"),
      ),
    ).rejects.toThrow(/quality_range/);
  });

  it("no deja registrar horas solapadas con otra actividad", async () => {
    await expect(
      asUser(alice, (c) =>
        c.query("insert into focus_sessions (kind, started_at, ended_at) values ('manual', now() - interval '150 minutes', now() - interval '90 minutes')"),
      ),
    ).rejects.toThrow(/focus_sessions_overlap/);
    // Justo a continuación sí se puede.
    await asUser(alice, (c) =>
      c.query("insert into focus_sessions (kind, started_at, ended_at) values ('manual', now() - interval '2 hours', now() - interval '1 hour')"),
    );
  });

  it("tampoco se solapa con una sesión en curso", async () => {
    await asUser(alice, (c) => c.query("insert into focus_sessions (kind) values ('stopwatch')"));
    await expect(
      asUser(alice, (c) =>
        c.query("insert into focus_sessions (kind, started_at, ended_at) values ('manual', now() - interval '20 minutes', now())"),
      ),
    ).rejects.toThrow(/focus_sessions_overlap/);
    await asUser(alice, (c) => c.query("update focus_sessions set status = 'abandoned' where status = 'running'"));
  });

  it("las sesiones de otro usuario no bloquean tus registros", async () => {
    await asUser(bob, (c) =>
      c.query("insert into focus_sessions (kind, started_at, ended_at) values ('manual', now() - interval '150 minutes', now() - interval '90 minutes')"),
    );
  });

  it("las estadísticas por categoría usan la categoría de la actividad", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("select name, focus_seconds from stats_by_category(current_date - 2, current_date + 1) where name = 'Idiomas'"),
    );
    expect(Number(rows[0].focus_seconds)).toBe(3600);
  });

  it("frases favoritas: privadas y sin duplicados", async () => {
    await asUser(alice, (c) => c.query("insert into favorite_quotes (quote_id) values ('cn-mil-millas')"));
    await expect(asUser(alice, (c) => c.query("insert into favorite_quotes (quote_id) values ('cn-mil-millas')"))).rejects.toThrow(/duplicate/);
    await expect(asUser(alice, (c) => c.query("insert into favorite_quotes (quote_id) values ('Mala Frase!')"))).rejects.toThrow();
    const seen = await asUser(bob, (c) => c.query("select * from favorite_quotes"));
    expect(seen.rows).toHaveLength(0);
    await expect(
      asUser(bob, (c) => c.query("insert into favorite_quotes (user_id, quote_id) values ($1, 'ru-gota')", [alice])),
    ).rejects.toThrow(/row-level security/);
  });

  it("una categoría puede marcarse como no desarrollo", async () => {
    const { rows } = await asUser(alice, (c) =>
      c.query("update categories set counts_as_development = false where name = 'Trabajo' returning counts_as_development"),
    );
    expect(rows[0].counts_as_development).toBe(false);
  });
});
