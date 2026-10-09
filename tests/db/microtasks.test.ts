import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, adminClient, asUser, createUser, resetDatabase } from "./harness";

const d = TEST_DATABASE_URL ? describe : describe.skip;

d("microtareas y horario", () => {
  let admin: Client;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    await resetDatabase();
    admin = await adminClient();
    alice = await createUser(admin, { display_name: "Alice" });
    bob = await createUser(admin, { display_name: "Bob" });
  });

  afterAll(async () => {
    await admin?.end();
  });

  it("la migración se puede pegar dos veces sin errores", async () => {
    const sql = readFileSync(join(__dirname, "../../supabase/migrations/20261012000000_microtasks_schedule.sql"), "utf8");
    await admin.query(sql);
    await admin.query(sql);
  });

  it("una microtarea completada cuenta como tarea pero no suma tiempo", async () => {
    const today = new Date().toISOString().slice(0, 10);
    await asUser(alice, (c) => c.query("insert into tasks (title, quick, due_date, status) values ('Tender la cama', true, $1, 'done')", [today]));
    const { rows } = await asUser(alice, (c) => c.query("select tasks_completed, focus_seconds from stats_daily($1, $1)", [today]));
    expect(rows[0].tasks_completed).toBe(1);
    expect(Number(rows[0].focus_seconds)).toBe(0);
    const t = await asUser(alice, (c) => c.query("select actual_seconds from tasks where quick"));
    expect(t.rows[0].actual_seconds).toBe(0);
  });

  it("la tarea recurrente se crea una sola vez por día", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const tpl = await asUser(alice, (c) => c.query("insert into quick_task_templates (title, repeat_days) values ('Leer', '{0,1,2,3,4,5,6}') returning id"));
    const id = tpl.rows[0].id;
    await asUser(alice, (c) => c.query("insert into tasks (title, quick, due_date, quick_template_id) values ('Leer', true, $1, $2)", [today, id]));
    await expect(
      asUser(alice, (c) => c.query("insert into tasks (title, quick, due_date, quick_template_id) values ('Leer', true, $1, $2)", [today, id])),
    ).rejects.toThrow(/tasks_quick_template_day/);
  });

  it("plantillas y horario son privados", async () => {
    await asUser(alice, (c) => c.query("insert into schedule_blocks (day_of_week, start_minute, end_minute, title) values (1, 480, 600, 'Matemáticas')"));
    const seen = await asUser(bob, (c) => c.query("select * from schedule_blocks"));
    expect(seen.rows).toHaveLength(0);
    const tpls = await asUser(bob, (c) => c.query("select * from quick_task_templates"));
    expect(tpls.rows).toHaveLength(0);
    await expect(
      asUser(alice, (c) => c.query("insert into schedule_blocks (day_of_week, start_minute, end_minute, title) values (2, 600, 540, 'Al revés')")),
    ).rejects.toThrow(/check/);
  });

  it("no se puede enlazar una tarea con la plantilla de otra persona", async () => {
    const tpl = await asUser(alice, (c) => c.query("select id from quick_task_templates limit 1"));
    await expect(
      asUser(bob, (c) => c.query("insert into tasks (title, quick, quick_template_id) values ('x', true, $1)", [tpl.rows[0].id])),
    ).rejects.toThrow(/foreign key/);
  });
});
