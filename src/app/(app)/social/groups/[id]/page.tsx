import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, CheckCircle2, Crown, Lock, Plus, Sparkles, Swords, UserPlus, Users } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { diffDays, startOfWeek } from "@/lib/domain/dates";
import { challengeState, challengeSummary, challengeValue, SHARED_METRIC_LABEL } from "@/lib/domain/social";
import { getComparison, getGroup, getSocialStats, personName, SocialSetupError } from "@/lib/data/social";
import { formatShortDate } from "@/lib/format";
import { Badge, Card, CardTitle, EmptyState, PageHeader, ProgressBar } from "@/components/ui/card";
import { Avatar, AvatarStack } from "@/components/social/avatar";
import { Comparison, parseMetric } from "@/components/social/comparison";
import { SHARED_METRIC_META } from "@/components/social/meta";
import { DeleteChallengeButton, InviteBox, LeaveOrDeleteGroup, RemoveMemberButton, SharedChallengeForm } from "@/components/social/social-forms";
import { SocialSetupNotice } from "@/components/social/setup-notice";
import { cn } from "@/lib/cn";
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
  const myName = profile.display_name || profile.username || "Tú";
  const active = challengeStats.filter((c) => c.state === "active").length;
  const count = `${members.length} ${members.length === 1 ? "persona" : "personas"}`;

  return (
    <div className="space-y-6">
      <Link
        href="/social"
        className="press inline-flex items-center gap-1.5 rounded-full border border-border bg-surface/70 px-3 py-1.5 text-sm font-medium text-muted backdrop-blur hover:border-border-strong hover:text-text"
      >
        <ArrowLeft size={14} />
        Social
      </Link>
      <PageHeader
        title={group.name}
        subtitle={
          <span className="flex flex-col gap-3">
            {group.description && <span>{group.description}</span>}
            <span className="flex flex-wrap items-center gap-2.5 text-sm">
              <AvatarStack people={members.map((m) => ({ id: m.user_id, name: m.user_id === user.id ? myName : personName(m), me: m.user_id === user.id }))} />
              <span className="font-medium text-text">{count}</span>
              {active > 0 && (
                <Badge variant="tone">
                  <Swords size={11} aria-hidden />
                  {active} {active === 1 ? "desafío activo" : "desafíos activos"}
                </Badge>
              )}
            </span>
          </span>
        }
        action={<LeaveOrDeleteGroup groupId={group.id} isOwner={isOwner} name={group.name} />}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardTitle icon={<Users size={16} />} subtitle="Quién lleva mejor ritmo esta semana">
              Esta semana en el grupo
            </CardTitle>
            {!comparison ? (
              <div className="flex items-start gap-3 rounded-[20px] border border-dashed border-border-strong bg-surface/40 p-4">
                <span className="tone-chip h-10 w-10 rounded-2xl">
                  <Lock size={17} aria-hidden />
                </span>
                <p className="text-sm leading-relaxed text-muted">
                  Activa <strong className="text-text">Compartir mis estadísticas</strong> en{" "}
                  <Link href="/social#perfil-social" className="font-semibold text-tone-ink hover:underline">
                    Social
                  </Link>{" "}
                  para ver la comparación del grupo. Es recíproco: solo verás a quienes también comparten.
                </p>
              </div>
            ) : (
              <>
                <Comparison
                  current={comparison.current}
                  previous={comparison.previous}
                  people={people}
                  meId={user.id}
                  meName={myName}
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

          <Card data-reveal>
            <CardTitle icon={<Swords size={16} />} subtitle="La misma meta para todos, cada uno a su ritmo">
              Desafíos del grupo
            </CardTitle>
            {challengeStats.length === 0 && (
              <div className="mb-5">
                <EmptyState icon={<Swords />} title="Aún no hay desafíos">
                  Propón el primero.
                </EmptyState>
              </div>
            )}
            {challengeStats.length > 0 && (
              <ul className="mb-6 space-y-3">
                {challengeStats.map(({ challenge: c, state, stats }) => {
                  const unit = SHARED_METRIC_LABEL[c.metric].unit;
                  const { tone, icon: Icon } = SHARED_METRIC_META[c.metric];
                  const values = stats.map((s) => ({ id: s.user_id, v: challengeValue(c.metric, s) })).sort((a, b) => b.v - a.v);
                  const left = diffDays(c.end_date, today);
                  const reached = values.filter((x) => x.v >= c.target_value).length;
                  return (
                    <li
                      key={c.id}
                      data-tone={tone}
                      className={cn(
                        "relative overflow-hidden rounded-[22px] border p-4 sm:p-5",
                        state === "finished" ? "border-border bg-surface/30" : "border-border bg-surface/60",
                      )}
                    >
                      {state === "active" && <div className="pointer-events-none absolute -right-12 -top-12 h-36 w-36 rounded-full bg-tone opacity-[0.12] blur-2xl" aria-hidden />}
                      <div className="relative flex flex-wrap items-start gap-x-3 gap-y-2">
                        <span className={cn("h-11 w-11 rounded-2xl", state === "finished" ? "tone-chip-soft" : "tone-chip")}>
                          <Icon size={19} aria-hidden />
                        </span>
                        <div className="min-w-0 flex-1 max-sm:basis-[calc(100%-3.5rem)]">
                          <p className="font-display text-[16px] font-semibold leading-snug">{c.title}</p>
                          <p className="mt-0.5 text-xs text-muted">
                            Meta: {c.target_value} {unit} por persona · {formatShortDate(c.start_date)} – {formatShortDate(c.end_date)}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1 max-sm:ml-14 max-sm:w-[calc(100%-3.5rem)] max-sm:justify-between">
                          <Badge className="whitespace-nowrap" variant={state === "active" ? "solid" : state === "upcoming" ? "accent" : "neutral"}>
                            {state === "active" ? (left === 0 ? "Último día" : `Quedan ${left + 1} días`) : state === "upcoming" ? "Próximamente" : "Terminado"}
                          </Badge>
                          {(c.created_by === user.id || isOwner) && <DeleteChallengeButton id={c.id} />}
                        </div>
                      </div>
                      {state !== "upcoming" && (
                        <div className="relative">
                          <p className="mt-3 flex items-center gap-2 rounded-xl bg-surface-2/60 px-3 py-2 text-sm text-muted">
                            {reached > 0 ? <CheckCircle2 size={15} className="shrink-0 text-success" aria-hidden /> : <Sparkles size={15} className="shrink-0 text-tone" aria-hidden />}
                            {challengeSummary(values.map((x) => x.v), c.target_value)}
                          </p>
                          <ul className="mt-3 space-y-2.5">
                            {values.map((x, i) => {
                              const me = x.id === user.id;
                              const name = me ? "Tú" : (people.get(x.id)?.name ?? "Alguien");
                              const done = x.v >= c.target_value;
                              return (
                                <li key={x.id} className="flex items-center gap-3">
                                  <span className="w-4 shrink-0 text-center text-[11px] font-bold tabular text-faint" aria-hidden>
                                    {i + 1}
                                  </span>
                                  <Avatar name={me ? myName : name} seed={x.id} me={me} size="sm" />
                                  <div className="min-w-0 flex-1">
                                    <div className="mb-1 flex justify-between gap-2 text-sm">
                                      <span className={cn("truncate", me ? "font-semibold" : "font-medium")}>{name}</span>
                                      <span className={cn("shrink-0 tabular", done ? "font-semibold text-success" : "text-muted")}>
                                        {x.v} / {c.target_value} {unit}
                                      </span>
                                    </div>
                                    <ProgressBar
                                      value={x.v / c.target_value}
                                      color={done ? "var(--success)" : undefined}
                                      label={`Progreso de ${me ? "ti" : (people.get(x.id)?.name ?? "alguien")}`}
                                    />
                                  </div>
                                  {done && <CheckCircle2 size={18} className="pop-in shrink-0 text-success" aria-hidden />}
                                </li>
                              );
                            })}
                          </ul>
                          {!profile.share_stats && <p className="mt-2 text-xs text-muted">Activa compartir para ver el progreso de los demás.</p>}
                        </div>
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
            <div className="rounded-[22px] border border-dashed border-border-strong bg-surface/30 p-4 sm:p-5">
              <p className="mb-3 flex items-center gap-2 text-sm font-semibold">
                <span className="tone-chip h-7 w-7 rounded-lg">
                  <Plus size={14} aria-hidden />
                </span>
                Nuevo desafío
              </p>
              <SharedChallengeForm groupId={group.id} today={today} />
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card variant="feature">
            <UserPlus className="pointer-events-none absolute -bottom-6 -right-4 h-32 w-32 -rotate-12 text-white/[0.08]" aria-hidden />
            <CardTitle icon={<UserPlus size={16} />}>Invitar</CardTitle>
            <InviteBox groupId={group.id} code={group.invite_code} isOwner={isOwner} />
          </Card>
          <Card data-reveal>
            <CardTitle icon={<Users size={16} />}>Miembros ({members.length})</CardTitle>
            <ul className="space-y-0.5">
              {members.map((m) => {
                const me = m.user_id === user.id;
                return (
                  <li key={m.user_id} className="group -mx-2 flex items-center justify-between gap-2 rounded-2xl px-2 py-1.5 transition-colors hover:bg-surface-2/60">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Avatar name={me ? myName : personName(m)} seed={m.user_id} me={me} />
                      <span className="min-w-0">
                        <span className="flex items-center gap-1.5 truncate text-sm font-semibold">
                          {me ? "Tú" : personName(m)}
                          {m.role === "owner" && (
                            <span data-tone="gold" className="inline-grid h-5 w-5 place-items-center rounded-full bg-tone-soft text-tone-ink">
                              <Crown size={11} aria-label="Creador del grupo" />
                            </span>
                          )}
                        </span>
                        <span className="block truncate text-xs text-muted">
                          {m.username && `@${m.username}`}
                          {!m.shares_stats && " · No comparte"}
                        </span>
                      </span>
                    </span>
                    {isOwner && m.role !== "owner" && <RemoveMemberButton groupId={group.id} userId={m.user_id} name={personName(m)} />}
                  </li>
                );
              })}
            </ul>
          </Card>
        </div>
      </div>
    </div>
  );
}
