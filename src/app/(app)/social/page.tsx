import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, Lock, ShieldCheck, Users, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { startOfWeek } from "@/lib/domain/dates";
import { suggestUsername } from "@/lib/domain/social";
import { getComparison, getFriends, getMyGroups, personName, SocialSetupError } from "@/lib/data/social";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { Comparison, parseMetric } from "@/components/social/comparison";
import {
  AddFriendForm,
  CreateGroupForm,
  FriendRequestActions,
  JoinGroupForm,
  RemoveFriendButton,
  SocialProfileForm,
} from "@/components/social/social-forms";
import { SocialSetupNotice } from "@/components/social/setup-notice";

export const metadata: Metadata = { title: "Social" };

export default async function SocialPage({ searchParams }: { searchParams: Promise<{ by?: string }> }) {
  const { supabase, profile, user, today } = await requireUser();
  const by = parseMetric((await searchParams).by);

  let data;
  try {
    const [friends, groups] = await Promise.all([getFriends(supabase), getMyGroups(supabase)]);
    const accepted = friends.filter((f) => f.status === "accepted");
    const comparison = profile.share_stats
      ? await getComparison(supabase, [user.id, ...accepted.map((f) => f.user_id)], today, startOfWeek(today, profile.week_starts_on))
      : null;
    data = { friends, accepted, groups, comparison };
  } catch (e) {
    if (e instanceof SocialSetupError) return <SocialSetupNotice />;
    throw e;
  }
  const { friends, accepted, groups, comparison } = data;
  const incoming = friends.filter((f) => f.status === "pending" && f.incoming);
  const outgoing = friends.filter((f) => f.status === "pending" && !f.incoming);
  const people = new Map(accepted.map((f) => [f.user_id, { name: personName(f), username: f.username }]));
  const notSharing = accepted.filter((f) => !f.shares_stats);

  return (
    <div className="space-y-6">
      <PageHeader title="Social" subtitle="Compárate solo con quien tú elijas, y solo si ambos queréis compartir." />

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardTitle icon={<Users size={16} />}>Esta semana con tus amigos</CardTitle>
            {!profile.share_stats ? (
              <p className="text-sm text-muted">
                Activa <strong>Compartir mis estadísticas</strong> para ver la comparación. Es recíproco: tus amigos solo te ven si compartes, y tú solo
                los ves a ellos si también comparten.
              </p>
            ) : accepted.length === 0 ? (
              <EmptyState icon={<Users size={26} />} title="Aún no tienes amigos aquí">
                Añade a alguien por su nombre de usuario. Cuando acepte, veréis vuestra semana lado a lado.
              </EmptyState>
            ) : (
              comparison && (
                <>
                  <Comparison
                    current={comparison.current}
                    previous={comparison.previous}
                    people={people}
                    meId={user.id}
                    by={by}
                    basePath="/social"
                    days={comparison.days}
                  />
                  {notSharing.length > 0 && (
                    <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                      <Lock size={12} />
                      {notSharing.map(personName).join(", ")} {notSharing.length === 1 ? "no comparte" : "no comparten"} sus estadísticas.
                    </p>
                  )}
                </>
              )
            )}
            <p className="mt-4 border-t border-border pt-3 text-xs text-muted">
              Por defecto ordenamos por constancia: cada persona tiene objetivos distintos, así que los días activos y el % del objetivo propio son
              más justos que las horas totales. Sin percentiles ni rankings globales: solo posiciones dentro de tu círculo.
            </p>
          </Card>

          <Card>
            <CardTitle icon={<UsersRound size={16} />}>Grupos</CardTitle>
            {groups.length === 0 ? (
              <p className="mb-4 text-sm text-muted">
                Crea un grupo para estudiar o trabajar con otras personas, compararos dentro del grupo y lanzar desafíos compartidos.
              </p>
            ) : (
              <ul className="mb-4 divide-y divide-border">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link href={`/social/groups/${g.id}`} className="flex items-center gap-3 py-3 hover:text-accent">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium">{g.name}</span>
                        <span className="text-xs text-muted">
                          {g.members} {g.members === 1 ? "persona" : "personas"}
                          {g.owner_id === user.id && " · creado por ti"}
                        </span>
                      </span>
                      <ChevronRight size={16} className="text-muted" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Crear un grupo</p>
                <CreateGroupForm />
              </div>
              <div>
                <p className="mb-2 text-xs font-medium text-muted">Unirme con un código</p>
                <JoinGroupForm />
              </div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardTitle icon={<ShieldCheck size={16} />}>Tu perfil social</CardTitle>
            <SocialProfileForm
              username={profile.username}
              shareStats={profile.share_stats}
              suggestion={suggestUsername(profile.display_name, user.email ?? "")}
            />
          </Card>

          <Card>
            <CardTitle
              icon={<Users size={16} />}
              action={incoming.length > 0 ? <Badge color="var(--accent)">{incoming.length} nueva{incoming.length === 1 ? "" : "s"}</Badge> : undefined}
            >
              Amigos
            </CardTitle>
            {!profile.username && <p className="mb-3 text-xs text-muted">Guarda tu nombre de usuario para que puedan encontrarte.</p>}
            <AddFriendForm />

            {incoming.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-medium text-muted">Solicitudes recibidas</h3>
                <ul className="space-y-2">
                  {incoming.map((f) => (
                    <li key={f.friendship_id} className="flex flex-wrap items-center justify-between gap-2">
                      <PersonLabel name={personName(f)} username={f.username} />
                      <FriendRequestActions id={f.friendship_id} incoming />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {accepted.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-medium text-muted">Tus amigos</h3>
                <ul className="space-y-1">
                  {accepted.map((f) => (
                    <li key={f.friendship_id} className="flex items-center justify-between gap-2">
                      <PersonLabel name={personName(f)} username={f.username} note={f.shares_stats ? undefined : "No comparte"} />
                      <RemoveFriendButton id={f.friendship_id} name={personName(f)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {outgoing.length > 0 && (
              <section className="mt-5">
                <h3 className="mb-2 text-xs font-medium text-muted">Esperando respuesta</h3>
                <ul className="space-y-2">
                  {outgoing.map((f) => (
                    <li key={f.friendship_id} className="flex flex-wrap items-center justify-between gap-2">
                      <PersonLabel name={personName(f)} username={f.username} />
                      <FriendRequestActions id={f.friendship_id} incoming={false} />
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function PersonLabel({ name, username, note }: { name: string; username: string | null; note?: string }) {
  return (
    <span className="min-w-0">
      <span className="block truncate text-sm">{name}</span>
      <span className="block truncate text-xs text-muted">
        {username && `@${username}`}
        {note && ` · ${note}`}
      </span>
    </span>
  );
}
