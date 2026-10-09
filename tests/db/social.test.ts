import type { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TEST_DATABASE_URL, adminClient, asUser, createUser, resetDatabase } from "./harness";

const d = TEST_DATABASE_URL ? describe : describe.skip;

async function setUsername(user: string, username: string, share = false) {
  await asUser(user, (c) => c.query("update profiles set username = $1, share_stats = $2 where id = auth.uid()", [username, share]));
}

async function addActivity(user: string) {
  await asUser(user, async (c) => {
    await c.query(
      "insert into focus_sessions (kind, started_at, ended_at) values ('manual', now() - interval '2 hours', now() - interval '1 hour')",
    );
    await c.query("insert into tasks (title, status) values ('Privada', 'done')");
  });
}

const stats = (viewer: string, ids: string[]) =>
  asUser(viewer, (c) => c.query("select * from social_stats($1::uuid[], current_date - 7, current_date + 1)", [ids])).then((r) => r.rows);

d("funciones sociales", () => {
  let admin: Client;
  let ana: string;
  let ben: string;
  let cris: string;

  beforeAll(async () => {
    await resetDatabase();
    admin = await adminClient();
    ana = await createUser(admin, { display_name: "Ana" });
    ben = await createUser(admin, { display_name: "Ben" });
    cris = await createUser(admin, { display_name: "Cris" });
    await setUsername(ana, "ana");
    await setUsername(ben, "ben");
    await setUsername(cris, "cris");
    await addActivity(ana);
    await addActivity(ben);
    await addActivity(cris);
  });

  afterAll(async () => {
    await admin?.end();
  });

  it("los perfiles ajenos siguen siendo privados", async () => {
    const { rows } = await asUser(ana, (c) => c.query("select id from profiles"));
    expect(rows.map((r) => r.id)).toEqual([ana]);
  });

  it("solicitudes de amistad: enviar, duplicar, aceptar y permisos", async () => {
    expect((await asUser(ana, (c) => c.query("select send_friend_request('nadie') as r"))).rows[0].r).toBe("not_found");
    expect((await asUser(ana, (c) => c.query("select send_friend_request(' ANA ') as r"))).rows[0].r).toBe("self");
    expect((await asUser(ana, (c) => c.query("select send_friend_request('Ben') as r"))).rows[0].r).toBe("sent");
    expect((await asUser(ana, (c) => c.query("select send_friend_request('ben') as r"))).rows[0].r).toBe("already_sent");

    // No se pueden crear amistades directamente ni aceptarlas en nombre de otro.
    await expect(
      asUser(cris, (c) => c.query("insert into friendships (requester_id, addressee_id, status) values ($1, $2, 'accepted')", [cris, ana])),
    ).rejects.toThrow();
    const req = (await asUser(ben, (c) => c.query("select * from list_friends()"))).rows[0];
    expect(req).toMatchObject({ user_id: ana, username: "ana", status: "pending", incoming: true, shares_stats: false });
    await expect(asUser(ana, (c) => c.query("select respond_friend_request($1, true)", [req.friendship_id]))).rejects.toThrow();
    await expect(asUser(cris, (c) => c.query("select respond_friend_request($1, true)", [req.friendship_id]))).rejects.toThrow();
    expect((await asUser(cris, (c) => c.query("select * from friendships"))).rows).toHaveLength(0);

    await asUser(ben, (c) => c.query("select respond_friend_request($1, true)", [req.friendship_id]));
    expect((await asUser(ana, (c) => c.query("select status from list_friends()"))).rows[0].status).toBe("accepted");
    expect((await asUser(ben, (c) => c.query("select send_friend_request('ana') as r"))).rows[0].r).toBe("already_friends");
  });

  it("una solicitud cruzada se acepta sola y se puede rechazar o eliminar", async () => {
    expect((await asUser(cris, (c) => c.query("select send_friend_request('ana') as r"))).rows[0].r).toBe("sent");
    expect((await asUser(ana, (c) => c.query("select send_friend_request('cris') as r"))).rows[0].r).toBe("accepted");
    // Ana elimina la amistad con Cris.
    await asUser(ana, (c) => c.query("delete from friendships where $1 in (requester_id, addressee_id)", [cris]));
    expect((await asUser(cris, (c) => c.query("select * from list_friends()"))).rows).toHaveLength(0);
    // Cris envía otra y Ana la rechaza.
    await asUser(cris, (c) => c.query("select send_friend_request('ana')"));
    const id = (await asUser(ana, (c) => c.query("select friendship_id from list_friends() where incoming"))).rows[0].friendship_id;
    await asUser(ana, (c) => c.query("select respond_friend_request($1, false)", [id]));
    expect((await asUser(cris, (c) => c.query("select * from list_friends()"))).rows).toHaveLength(0);
  });

  it("las estadísticas solo se ven con amistad aceptada Y consentimiento de ambas partes", async () => {
    // Ben es amigo de Ana pero aún no comparte.
    expect((await stats(ana, [ana, ben, cris])).map((r) => r.user_id)).toEqual([ana]);
    await setUsername(ben, "ben", true);
    await setUsername(cris, "cris", true);
    // Ana todavía no comparte: tampoco ve a los demás (es recíproco).
    expect((await stats(ana, [ana, ben, cris])).map((r) => r.user_id)).toEqual([ana]);
    await setUsername(ana, "ana", true);
    const rows = await stats(ana, [ana, ben, cris]);
    // Cris comparte, pero no es amiga de Ana: no aparece.
    expect(rows.map((r) => r.user_id).sort()).toEqual([ana, ben].sort());
    const b = rows.find((r) => r.user_id === ben);
    expect(Number(b.focus_seconds)).toBe(3600);
    expect(b).toMatchObject({ tasks_completed: 1, habits_done: 0, active_days: 1, weekly_focus_goal_minutes: 600 });
    // Sin sesión no se ve nada.
    const anon = await admin.query("select * from social_stats($1::uuid[], current_date - 7, current_date + 1)", [[ana, ben]]);
    expect(anon.rows).toHaveLength(0);
    // Rangos absurdos no devuelven nada.
    const big = await asUser(ana, (c) => c.query("select * from social_stats($1::uuid[], '2020-01-01', '2026-01-01')", [[ana]]));
    expect(big.rows).toHaveLength(0);
  });

  it("grupos: crear, unirse por código, ver miembros, desafíos y salir", async () => {
    const group = (await asUser(ana, (c) => c.query("select create_group('Estudio', 'Exámenes') as id"))).rows[0].id as string;
    const code = (await asUser(ana, (c) => c.query("select invite_code from groups where id = $1", [group]))).rows[0].invite_code;

    // Quien no es miembro no ve el grupo ni sus miembros ni puede crear desafíos.
    expect((await asUser(cris, (c) => c.query("select * from groups"))).rows).toHaveLength(0);
    expect((await asUser(cris, (c) => c.query("select * from group_members_list($1)", [group]))).rows).toHaveLength(0);
    await expect(
      asUser(cris, (c) =>
        c.query(
          "insert into shared_challenges (group_id, title, metric, target_value, start_date, end_date) values ($1, 'x', 'focus_minutes', 60, current_date, current_date + 6)",
          [group],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
    // Tampoco puede meterse directamente como miembro.
    await expect(asUser(cris, (c) => c.query("insert into group_members (group_id, user_id) values ($1, $2)", [group, cris]))).rejects.toThrow();

    expect((await asUser(cris, (c) => c.query("select join_group('noexiste') as g"))).rows[0].g).toBeNull();
    expect((await asUser(cris, (c) => c.query("select join_group($1) as g", [code.toUpperCase()]))).rows[0].g).toBe(group);
    const members = (await asUser(cris, (c) => c.query("select * from group_members_list($1)", [group]))).rows;
    expect(members.map((m) => [m.username, m.role])).toEqual([
      ["ana", "owner"],
      ["cris", "member"],
    ]);

    // Al compartir grupo, Ana ve a Cris (que comparte) aunque no sean amigas.
    expect((await stats(ana, [cris])).map((r) => r.user_id)).toEqual([cris]);

    await asUser(cris, (c) =>
      c.query(
        "insert into shared_challenges (group_id, title, metric, target_value, start_date, end_date) values ($1, '5 h', 'focus_minutes', 300, current_date, current_date + 6)",
        [group],
      ),
    );
    expect((await asUser(ana, (c) => c.query("select title from shared_challenges"))).rows).toEqual([{ title: "5 h" }]);

    // El dueño no puede salir (debe borrar el grupo); un miembro no puede expulsar a otros.
    await asUser(ana, (c) => c.query("delete from group_members where user_id = auth.uid()"));
    expect((await asUser(ana, (c) => c.query("select count(*)::int as n from group_members"))).rows[0].n).toBe(2);
    await asUser(cris, (c) => c.query("delete from group_members where user_id = $1", [ana]));
    expect((await asUser(ana, (c) => c.query("select count(*)::int as n from group_members"))).rows[0].n).toBe(2);
    // Cris no puede cambiar el código ni el nombre.
    await expect(asUser(cris, (c) => c.query("select rotate_group_code($1)", [group]))).rejects.toThrow();
    await asUser(cris, (c) => c.query("update groups set name = 'Hackeado' where id = $1", [group]));
    expect((await asUser(ana, (c) => c.query("select name from groups"))).rows[0].name).toBe("Estudio");

    // El código viejo deja de funcionar al rotarlo.
    const newCode = (await asUser(ana, (c) => c.query("select rotate_group_code($1) as c", [group]))).rows[0].c;
    expect(newCode).not.toBe(code);
    expect((await asUser(ben, (c) => c.query("select join_group($1) as g", [code]))).rows[0].g).toBeNull();

    // Cris sale; ya no ve el grupo y Ana deja de ver sus estadísticas.
    await asUser(cris, (c) => c.query("delete from group_members where user_id = auth.uid()"));
    expect((await asUser(cris, (c) => c.query("select * from groups"))).rows).toHaveLength(0);
    expect(await stats(ana, [cris])).toHaveLength(0);

    // Borrar el grupo borra miembros y desafíos.
    await asUser(ana, (c) => c.query("delete from groups where id = $1", [group]));
    const left = await admin.query("select (select count(*) from group_members)::int as m, (select count(*) from shared_challenges)::int as s");
    expect(left.rows[0]).toEqual({ m: 0, s: 0 });
  });

  it("borrar una cuenta borra sus amistades y membresías", async () => {
    await asUser(ana, (c) => c.query("select create_group('Temporal')"));
    await admin.query("delete from auth.users where id = $1", [ana]);
    const { rows } = await admin.query(
      "select (select count(*) from friendships)::int as f, (select count(*) from groups)::int as g, (select count(*) from group_members)::int as m",
    );
    expect(rows[0]).toEqual({ f: 0, g: 0, m: 0 });
  });
});
