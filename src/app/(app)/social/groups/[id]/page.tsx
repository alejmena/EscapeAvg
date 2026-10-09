import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Crown, Lock, Swords, UserPlus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { diffDays, startOfWeek } from "@/lib/domain/dates";
import { challengeState, challengeSummary, challengeValue, SHARED_METRIC_LABEL } from "@/lib/domain/social";
import { getComparison, getGroup, getSocialStats, personName, SocialSetupError } from "@/lib/data/social";
import { formatShortDate } from "@/lib/format";
import { Badge, Card, CardTitle, PageHeader, ProgressBar } from "@/components/ui/card";
import { Comparison, parseMetric } from "@/components/social/comparison";
import { DeleteChallengeButton, InviteBox, LeaveOrDeleteGroup, RemoveMemberButton, SharedChallengeForm } from "@/components/social/social-forms";
import { SocialSetupNotice } from "@/components/social/setup-notice";
import { z } from "zod";

export const metadata: Metadata = { title: "Grupo" };

export default async function GroupPage({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ by?: string }> }) {
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) notFound();
  const by = parseMetric((await searchParams).by);
  const { supabase, profile, user, today } = await requireUser();

  let loaded;
  try {
    const g = await getGroup(supabase, id);
    if (!g) notFound();
    const ids = g.members.map((m) => m.user_id);
    const comparison = profile.share_stats ? await getComparison(supabase, ids, today, startOfWeek(today, profile.week_starts_on)) : null;
    const shown = g.challenges.filter((c) => challengeState(c.start_date, c.end_date, today) !== "finished").concat(
      g.challenges.filter((c) => challengeState(c.start_date, c.end_date, today) === "finished").slice(0, 3),
    );
    const challengeStats = await Promise.all(
      shown.map(async (c) => ({
        challenge: c,
        state: challengeState(c.start_date, c.end_date, today),
        stats: c.start_date > today ? [] : await getSocialStats(supabase, ids, c.start_date, c.end_date < today ? c.end_date : today),
      })),
    );
    loaded = { ...g, comparison, challengeStats };
  } catch (e) {
    if (e instanceof SocialSetupError) return <SocialSetupNotice />;
    throw e;
  }

  const { group, members, comparison, challengeStats } = loaded;
  const isOwner = group.owner_id === user.id;
  const people = new Map(members.map((m) => [m.user_id, { name: personName(m), username: m.username }]));
  const notSharing = members.filter((m) => !m.shares_stats && m.user_id !== user.id);

  return (
    <div className="space-y-6">
      <Link href="/social" className="inline-flex items-center gap-1 text-sm text-muted hover:text-text">
        <ArrowLeft size={14} />
        Social
      </Link>
      <PageHeader
        title={group.name}
        subtitle={group.description ?? `${members.length} ${members.length === 1 ? "persona" : "personas"}`}
        action={<LeaveOrDeleteGroup groupId={group.id} isOwner={isOwner} name={group.name} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardTitle icon={<Users size={16} />}>Esta semana en el grupo</CardTitle>
            {!comparison ? (
              <p className="text-sm text-muted">
                Activa <strong>Compartir mis estadísticas</strong> en <Link href="/social" className="text-accent hover:underline">Social</Link> para
                ver la comparación del grupo. Es recíproco: solo verás a quienes también comparten.
              </p>
            ) : (
              <>
                <Comparison
                  current={comparison.current}
                  previous={comparison.previous}
                  people={people}
                  meId={user.id}
                  by={by}
                  basePath={`/social/groups/${group.id}`}
                  days={comparison.days}
                />
                {notSharing.length > 0 && (
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <Lock size={12} />
                    {notSharing.map(personName).join(", ")} {notSharing.length === 1 ? "no comparte" : "no comparten"} sus estadísticas.
                  </p>
                )}
              </>
            )}
          </Card>

          <Card>
            <CardTitle icon={<Swords size={16} />}>Desafíos del grupo</CardTitle>
            {challengeStats.length === 0 && <p className="mb-4 text-sm text-muted">Aún no hay desafíos. Propón el primero.</p>}
            <ul className="mb-6 space-y-4">
              {challengeStats.map(({ challenge: c, state, stats }) => {
                const unit = SHARED_METRIC_LABEL[c.metric].unit;
                const values = stats.map((s) => ({ id: s.user_id, v: challengeValue(c.metric, s) })).sort((a, b) => b.v - a.v);
                const left = diffDays(c.end_date, today);
                return (
                  <li key={c.id} className="rounded-xl border border-border p-4">
                    <div className="mb-1 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="font-medium">{c.title}</p>
                        <p className="text-xs text-muted">
                          Meta: {c.target_value} {unit} por persona · {formatShortDate(c.start_date)} – {formatShortDate(c.end_date)}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge className="whitespace-nowrap" color={state === "active" ? "var(--accent)" : undefined}>
                          {state === "active" ? (left === 0 ? "Último día" : `Quedan ${left + 1} días`) : state === "upcoming" ? "Próximamente" : "Terminado"}
                        </Badge>
                        {(c.created_by === user.id || isOwner) && <DeleteChallengeButton id={c.id} />}
                      </div>
                    </div>
                    {state !== "upcoming" && (
                      <>
                        <p className="mb-3 text-sm text-muted">{challengeSummary(values.map((x) => x.v), c.target_value)}</p>
                        <ul className="space-y-2">
                          {values.map((x) => (
                            <li key={x.id}>
                              <div className="mb-1 flex justify-between gap-2 text-sm">
                                <span className="truncate">{x.id === user.id ? "Tú" : (people.get(x.id)?.name ?? "Alguien")}</span>
                                <span className="tabular text-muted">
                                  {x.v} / {c.target_value} {unit}
                                </span>
                              </div>
                              <ProgressBar
                                value={x.v / c.target_value}
                                color={x.v >= c.target_value ? "var(--success)" : undefined}
                                label={`Progreso de ${x.id === user.id ? "ti" : (people.get(x.id)?.name ?? "alguien")}`}
                              />
                            </li>
                          ))}
                        </ul>
                        {!profile.share_stats && <p className="mt-2 text-xs text-muted">Activa compartir para ver el progreso de los demás.</p>}
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="mb-2 text-xs font-medium text-muted">Nuevo desafío</p>
            <SharedChallengeForm groupId={group.id} today={today} />
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card>
            <CardTitle icon={<UserPlus size={16} />}>Invitar</CardTitle>
            <InviteBox groupId={group.id} code={group.invite_code} isOwner={isOwner} />
          </Card>
          <Card>
            <CardTitle icon={<Users size={16} />}>Miembros ({members.length})</CardTitle>
            <ul className="space-y-2">
              {members.map((m) => (
                <li key={m.user_id} className="flex items-center justify-between gap-2">
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 truncate text-sm">
                      {m.user_id === user.id ? "Tú" : personName(m)}
                      {m.role === "owner" && <Crown size={13} className="text-warning" aria-label="Creador del grupo" />}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {m.username && `@${m.username}`}
                      {!m.shares_stats && " · No comparte"}
                    </span>
                  </span>
                  {isOwner && m.role !== "owner" && <RemoveMemberButton groupId={group.id} userId={m.user_id} name={personName(m)} />}
                </li>
              ))}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
