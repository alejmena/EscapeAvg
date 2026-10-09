import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, adminClient, asUser, createUser, rawUpdate, resetDatabase } from "./harness";

const d = TEST_DATABASE_URL ? describe : describe.skip;

d("esquema de base de datos", () => {
  let admin: Client;
  let alice: string;
  let bob: string;

  beforeAll(async () => {
    await resetDatabase();
    admin = await adminClient();
    alice = await createUser(admin, { display_name: "Alice", timezone: "Europe/Madrid" });
    bob = await createUser(admin, { display_name: "Bob", timezone: "Not/AZone" });
  });

  afterAll(async () => {
    await admin?.end();
  });

  describe("alta de usuario", () => {
    it("crea perfil, categorías y tablero por defecto", async () => {
      const profile = await asUser(alice, (c) => c.query("select * from profiles"));
      expect(profile.rows).toHaveLength(1);
      expect(profile.rows[0]).toMatchObject({ display_name: "Alice", timezone: "Europe/Madrid", share_stats: false });
      const cats = await asUser(alice, (c) => c.query("select name from categories order by position"));
      expect(cats.rows.map((r) => r.name)).toEqual([
        "Estudio", "Trabajo", "Proyectos personales", "Ejercicio", "Lectura",
        "Idiomas", "Programación", "Habilidades profesionales", "Cultura",
      ]);
      const boards = await asUser(alice, (c) => c.query("select name from boards"));
      expect(boards.rows).toEqual([{ name: "Mi tablero" }]);
    });

    it("usa UTC si la zona horaria del registro no es válida", async () => {
      const { rows } = await asUser(bob, (c) => c.query("select timezone from profiles"));
      expect(rows[0].timezone).toBe("UTC");
    });

    it("rechaza zonas horarias inválidas al actualizar el perfil", async () => {
      await expect(
        asUser(alice, (c) => c.query("update profiles set timezone = 'Mars/Base' where id = $1", [alice])),
      ).rejects.toThrow(/invalid timezone/);
    });
  });

  describe("privacidad (RLS)", () => {
    it("un usuario no ve ni modifica filas de otro", async () => {
      const { rows } = await asUser(alice, (c) =>
        c.query("insert into tasks (title) values ('Secreto de Alice') returning id"),
      );
      const taskId = rows[0].id;
      const seen = await asUser(bob, (c) => c.query("select * from tasks where id = $1", [taskId]));
      expect(seen.rows).toHaveLength(0);
      const upd = await asUser(bob, (c) => c.query("update tasks set title = 'hack' where id = $1", [taskId]));
      expect(upd.rowCount).toBe(0);
      const del = await asUser(bob, (c) => c.query("delete from tasks where id = $1", [taskId]));
      expect(del.rowCount).toBe(0);
      const profiles = await asUser(bob, (c) => c.query("select id from profiles"));
      expect(profiles.rows.map((r) => r.id)).toEqual([bob]);
    });

    it("no permite insertar filas a nombre de otro usuario", async () => {
      await expect(
        asUser(bob, (c) => c.query("insert into tasks (user_id, title) values ($1, 'x')", [alice])),
      ).rejects.toThrow(/row-level security/);
    });

    it("no permite enlazar una tarea a la categoría de otro usuario", async () => {
      const { rows } = await asUser(alice, (c) => c.query("select id from categories limit 1"));
      await expect(
        asUser(bob, (c) => c.query("insert into tasks (title, category_id) values ('x', $1)", [rows[0].id])),
      ).rejects.toThrow(/foreign key/);
    });

    it("anon no ve nada", async () => {
      const c = await adminClient();
      try {
        await c.query("begin; set local role anon;");
        const { rows } = await c.query("select * from tasks");
        expect(rows).toHaveLength(0);
        await c.query("rollback");
      } finally {
        await c.end();
      }
    });

    it("los eventos de actividad no se pueden falsificar", async () => {
      await expect(
        asUser(alice, (c) =>
          c.query("insert into activity_events (user_id, type, entity_type) values ($1, 'task.completed', 'task')", [alice]),
        ),
      ).rejects.toThrow(/row-level security/);
    });
  });

  describe("tareas", () => {
    it("gestiona completed_at, postergaciones y campos derivados", async () => {
      const id = await asUser(alice, async (c) => {
        const { rows } = await c.query(
          "insert into tasks (title, due_date, actual_seconds) values ('Informe', '2026-10-10', 9999) returning *",
        );
        expect(rows[0].actual_seconds).toBe(0);
        return rows[0].id as string;
      });
      await asUser(alice, (c) => c.query("update tasks set due_date = '2026-10-12', postponed_count = 0 where id = $1", [id]));
      await asUser(alice, (c) => c.query("update tasks set due_date = '2026-10-15' where id = $1", [id]));
      await asUser(alice, (c) => c.query("update tasks set due_date = '2026-10-11' where id = $1", [id]));
      await asUser(alice, (c) => c.query("update tasks set status = 'done', actual_seconds = 5 where id = $1", [id]));
      const { rows } = await asUser(alice, (c) => c.query("select * from tasks where id = $1", [id]));
      expect(rows[0].postponed_count).toBe(2);
      expect(rows[0].actual_seconds).toBe(0);
      expect(rows[0].completed_at).not.toBeNull();

      const events = await asUser(alice, (c) =>
        c.query("select type from activity_events where entity_id = $1", [id]),
      );
      expect(events.rows.map((r) => r.type)).toEqual(["task.completed"]);

      await asUser(alice, (c) => c.query("update tasks set status = 'todo' where id = $1", [id]));
      const reopened = await asUser(alice, (c) => c.query("select completed_at from tasks where id = $1", [id]));
      expect(reopened.rows[0].completed_at).toBeNull();
    });

    it("valida datos en la base de datos aunque el cliente falle", async () => {
      await expect(asUser(alice, (c) => c.query("insert into tasks (title, priority) values ('x', 9)"))).rejects.toThrow(
        /check constraint/,
      );
      await expect(asUser(alice, (c) => c.query("insert into tasks (title) values ('   ')"))).rejects.toThrow(
        /check constraint/,
      );
    });

    it("borra subtareas en cascada", async () => {
      await asUser(alice, async (c) => {
        const parent = await c.query("insert into tasks (title) values ('Proyecto') returning id");
        await c.query("insert into tasks (title, parent_id) values ('Paso 1', $1), ('Paso 2', $1)", [parent.rows[0].id]);
        await c.query("delete from tasks where id = $1", [parent.rows[0].id]);
        const left = await c.query("select count(*)::int as n from tasks where parent_id = $1", [parent.rows[0].id]);
        expect(left.rows[0].n).toBe(0);
      });
    });
  });

  describe("sesiones de concentración", () => {
    it("calcula el tiempo en el servidor, descontando pausas, y lo suma a la tarea", async () => {
      const taskId = await asUser(bob, async (c) => {
        const { rows } = await c.query("insert into tasks (title) values ('Estudiar') returning id");
        return rows[0].id as string;
      });
      const sessionId = await asUser(bob, async (c) => {
        // El cliente intenta mentir sobre el inicio: el trigger lo ignora.
        const { rows } = await c.query(
          "insert into focus_sessions (kind, task_id, started_at, focus_seconds) values ('stopwatch', $1, now() - interval '5 hours', 99999) returning *",
          [taskId],
        );
        expect(rows[0].status).toBe("running");
        expect(rows[0].focus_seconds).toBeNull();
        return rows[0].id as string;
      });

      // Solo una sesión activa por usuario.
      await expect(asUser(bob, (c) => c.query("insert into focus_sessions (kind) values ('stopwatch')"))).rejects.toThrow(
        /focus_sessions_one_active/,
      );

      // Simula que empezó hace 30 min y estuvo 10 min en pausa (pausa ya cerrada).
      await rawUpdate(
        admin,
        "update focus_sessions set started_at = now() - interval '30 minutes', paused_seconds = 600 where id = $1",
        [sessionId],
      );
      await asUser(bob, (c) => c.query("update focus_sessions set status = 'paused' where id = $1", [sessionId]));
      await rawUpdate(admin, "update focus_sessions set paused_at = now() - interval '5 minutes' where id = $1", [sessionId]);
      await asUser(bob, (c) =>
        c.query("insert into session_interruptions (session_id, kind, note) values ($1, 'external', 'llamada')", [sessionId]),
      );
      await asUser(bob, (c) =>
        c.query("update focus_sessions set status = 'completed', focus_seconds = 1 where id = $1", [sessionId]),
      );

      const { rows } = await asUser(bob, (c) => c.query("select * from focus_sessions where id = $1", [sessionId]));
      // 30 min - 10 min - 5 min de la pausa final = 15 min
      expect(rows[0].focus_seconds).toBeGreaterThanOrEqual(899);
      expect(rows[0].focus_seconds).toBeLessThanOrEqual(901);
      expect(rows[0].paused_seconds).toBeGreaterThanOrEqual(899);

      const task = await asUser(bob, (c) => c.query("select actual_seconds from tasks where id = $1", [taskId]));
      expect(task.rows[0].actual_seconds).toBe(rows[0].focus_seconds);

      await expect(
        asUser(bob, (c) => c.query("update focus_sessions set status = 'running' where id = $1", [sessionId])),
      ).rejects.toThrow(/already finished/);

      const ev = await asUser(bob, (c) =>
        c.query("select type, payload from activity_events where entity_id = $1", [sessionId]),
      );
      expect(ev.rows[0].type).toBe("focus.completed");
    });

    it("limita un pomodoro olvidado a su duración planificada", async () => {
      const id = await asUser(bob, async (c) => {
        const { rows } = await c.query("insert into focus_sessions (kind, planned_seconds) values ('pomodoro', 1500) returning id");
        return rows[0].id as string;
      });
      await rawUpdate(admin, "update focus_sessions set started_at = now() - interval '3 hours' where id = $1", [id]);
      await asUser(bob, (c) => c.query("update focus_sessions set status = 'completed' where id = $1", [id]));
      const { rows } = await asUser(bob, (c) => c.query("select focus_seconds from focus_sessions where id = $1", [id]));
      expect(rows[0].focus_seconds).toBe(1500);
    });

    it("acepta registros manuales pasados y rechaza los futuros", async () => {
      const { rows } = await asUser(bob, (c) =>
        c.query(
          // Antes del pomodoro anterior: los registros manuales no pueden solaparse con otras sesiones.
          "insert into focus_sessions (kind, started_at, ended_at) values ('manual', now() - interval '6 hours', now() - interval '5 hours 15 minutes') returning *",
        ),
      );
      expect(rows[0].status).toBe("completed");
      expect(rows[0].focus_seconds).toBe(2700);
      await expect(
        asUser(bob, (c) =>
          c.query("insert into focus_sessions (kind, started_at, ended_at) values ('manual', now(), now() + interval '2 hours')"),
        ),
      ).rejects.toThrow(/past ended_at/);
    });
  });

  describe("hábitos y estadísticas", () => {
    it("un log por hábito y día; stats_daily agrega datos reales por día local", async () => {
      const user = await createUser(admin, { timezone: "America/Mexico_City" });
      const habitId = await asUser(user, async (c) => {
        const { rows } = await c.query("insert into habits (name) values ('Leer') returning id");
        return rows[0].id as string;
      });
      await asUser(user, (c) =>
        c.query("insert into habit_logs (habit_id, log_date) values ($1, current_date - 1), ($1, current_date - 2)", [habitId]),
      );
      await expect(
        asUser(user, (c) => c.query("insert into habit_logs (habit_id, log_date) values ($1, current_date - 1)", [habitId])),
      ).rejects.toThrow(/duplicate key/);

      await asUser(user, (c) =>
        c.query(
          "insert into focus_sessions (kind, started_at, ended_at) values ('manual', now() - interval '1 hour', now() - interval '30 minutes')",
        ),
      );
      await asUser(user, (c) => c.query("insert into tasks (title, status) values ('Hecha', 'done')"));

      const { rows } = await asUser(user, (c) =>
        c.query("select * from stats_daily(current_date - 7, current_date + 1)"),
      );
      expect(rows).toHaveLength(9);
      const totals = rows.reduce(
        (acc, r) => ({
          focus: acc.focus + Number(r.focus_seconds),
          tasks: acc.tasks + r.tasks_completed,
          habits: acc.habits + r.habits_done,
        }),
        { focus: 0, tasks: 0, habits: 0 },
      );
      expect(totals).toEqual({ focus: 1800, tasks: 1, habits: 2 });

      const cats = await asUser(user, (c) => c.query("select * from stats_by_category(current_date - 7, current_date + 1)"));
      expect(cats.rows[0]).toMatchObject({ name: "Sin categoría", tasks_completed: 1 });
      expect(Number(cats.rows[0].focus_seconds)).toBe(1800);

      // Otro usuario no ve nada de esto.
      const other = await asUser(alice, (c) => c.query("select sum(focus_seconds)::int as s from stats_daily(current_date - 7, current_date + 1)"));
      expect(other.rows[0].s).toBe(0);
    });

    it("rechaza rangos de estadísticas absurdos", async () => {
      const { rows } = await asUser(alice, (c) => c.query("select * from stats_daily('2020-01-01', '2026-01-01')"));
      expect(rows).toHaveLength(0);
    });
  });

  describe("notas adhesivas", () => {
    it("limita tamaño y posición y borra notas con su tablero", async () => {
      await asUser(alice, async (c) => {
        const b = await c.query("insert into boards (name) values ('Ideas') returning id");
        await c.query("insert into notes (board_id, content, x, y) values ($1, 'hola', 10, 20)", [b.rows[0].id]);
        await expect(
          c.query("savepoint s").then(() => c.query("insert into notes (board_id, width) values ($1, 5000)", [b.rows[0].id])),
        ).rejects.toThrow(/check constraint/);
        await c.query("rollback to savepoint s");
        await c.query("delete from boards where id = $1", [b.rows[0].id]);
        const n = await c.query("select count(*)::int as n from notes where board_id = $1", [b.rows[0].id]);
        expect(n.rows[0].n).toBe(0);
      });
    });
  });
});
