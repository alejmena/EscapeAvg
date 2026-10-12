import type { Metadata } from "next";
import Link from "next/link";
import { ArrowDown, ChevronRight, Clock, Eye, EyeOff, Inbox, KeyRound, Lock, Plus, Scale, ShieldCheck, UserRoundPlus, Users, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { startOfWeek } from "@/lib/domain/dates";
import { suggestUsername } from "@/lib/domain/social";
import { getComparison, getFriends, getMyGroups, personName, SocialSetupError } from "@/lib/data/social";
import { Badge, Card, CardTitle, EmptyState, PageHeader } from "@/components/ui/card";
import { Avatar, AvatarStack, initials, toneFor } from "@/components/social/avatar";
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
import { cn } from "@/lib/cn";

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
  const myName = profile.display_name || profile.username || "Tú";

  return (
    <div className="space-y-6">
      <PageHeader title="Social" subtitle="Compárate solo con quien tú elijas, y solo si ambos queréis compartir." />

      {/* Protagonista: tu perfil y tu círculo. */}
      <Card variant="feature" className="p-5 sm:p-7">
        <UsersRound className="pointer-events-none absolute -bottom-10 -right-6 h-56 w-56 -rotate-6 text-white/[0.08]" aria-hidden />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <span className="relative shrink-0">
              <span className="animate-glow absolute -inset-2 rounded-full bg-white/30 blur-xl" aria-hidden />
              <Avatar name={myName} seed={user.id} me size="xl" className="relative ring-4 ring-white/35" />
            </span>
            <div className="min-w-0">
              <p className="eyebrow">Tu perfil</p>
              <p className="mt-0.5 truncate font-display text-[26px] font-bold leading-tight sm:text-[30px]">{myName}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-2 text-sm">
                <span className="max-w-full truncate font-medium text-muted">{profile.username ? `@${profile.username}` : "Sin nombre de usuario"}</span>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface px-2.5 py-0.5 text-xs font-semibold">
                  {profile.share_stats ? <Eye size={13} aria-hidden /> : <EyeOff size={13} aria-hidden />}
                  {profile.share_stats ? "Compartes tus estadísticas" : "Estadísticas privadas"}
                </span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3 md:w-auto">
            <Counter value={accepted.length} label={accepted.length === 1 ? "amigo" : "amigos"} />
            <Counter value={groups.length} label={groups.length === 1 ? "grupo" : "grupos"} />
            <Counter value={incoming.length} label={incoming.length === 1 ? "solicitud" : "solicitudes"} highlight={incoming.length > 0} />
          </div>
        </div>
        {accepted.length > 0 && (
          <div className="relative mt-5 flex flex-wrap items-center gap-3 border-t border-border pt-4 text-sm text-muted">
            <AvatarStack people={accepted.map((f) => ({ id: f.user_id, name: personName(f) }))} max={6} />
            <span className="min-w-0">Tu círculo: las únicas personas con las que te comparas.</span>
          </div>
        )}
      </Card>

      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="min-w-0 space-y-6">
          <Card>
            <CardTitle icon={<Users size={16} />} subtitle="Posiciones solo dentro de tu círculo">
              Esta semana con tus amigos
            </CardTitle>
            {!profile.share_stats ? (
              <div className="relative flex flex-col items-start gap-4 overflow-hidden rounded-[22px] border border-dashed border-border-strong bg-surface/40 p-5 sm:flex-row sm:items-center">
                <div className="dot-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(70%_80%_at_0%_50%,#000,transparent)]" aria-hidden />
                <span className="tone-chip relative h-12 w-12 rounded-[16px]">
                  <Lock size={20} aria-hidden />
                </span>
                <div className="relative min-w-0 flex-1 space-y-3">
                  <p className="text-sm leading-relaxed text-muted">
                    Activa <strong className="text-text">Compartir mis estadísticas</strong> para ver la comparación. Es recíproco: tus amigos solo
                    te ven si compartes, y tú solo los ves a ellos si también comparten.
                  </p>
                  <a href="#perfil-social" className="press inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-3 py-1.5 text-xs font-semibold text-tone-ink hover:brightness-95">
                    Ir a tu perfil social
                    <ArrowDown size={13} aria-hidden />
                  </a>
                </div>
              </div>
            ) : accepted.length === 0 ? (
              <EmptyState
                icon={<Users size={26} />}
                title="Aún no tienes amigos aquí"
                action={
                  <a href="#amigos" className="press inline-flex items-center gap-1.5 rounded-full bg-tone-soft px-3.5 py-2 text-sm font-semibold text-tone-ink hover:brightness-95">
                    <UserRoundPlus size={15} aria-hidden />
                    Buscar a alguien
                  </a>
                }
              >
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
                    meName={myName}
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
            <p className="mt-5 flex gap-2.5 rounded-2xl bg-surface-2/50 p-3.5 text-xs leading-relaxed text-muted">
              <Scale size={15} className="mt-px shrink-0 text-tone" aria-hidden />
              <span>
                Por defecto ordenamos por constancia: cada persona tiene objetivos distintos, así que los días activos y el % del objetivo propio son
                más justos que las horas totales. Sin percentiles ni rankings globales: solo posiciones dentro de tu círculo.
              </span>
            </p>
          </Card>

          <Card data-reveal>
            <CardTitle icon={<UsersRound size={16} />} subtitle="Estudiad juntos y lanzad desafíos compartidos">
              Grupos
            </CardTitle>
            {groups.length === 0 ? (
              <p className="mb-5 text-sm leading-relaxed text-muted">
                Crea un grupo para estudiar o trabajar con otras personas, compararos dentro del grupo y lanzar desafíos compartidos.
              </p>
            ) : (
              <ul className="mb-5 grid gap-3 sm:grid-cols-2">
                {groups.map((g) => (
                  <li key={g.id}>
                    <Link
                      href={`/social/groups/${g.id}`}
                      className="lift group flex h-full items-center gap-3 rounded-[20px] border border-border bg-surface/60 p-3.5 hover:border-[color-mix(in_srgb,var(--tone)_40%,transparent)]"
                    >
                      <span data-tone={toneFor(g.id)} className="tone-chip h-12 w-12 rounded-[16px] font-display text-[15px] font-bold" aria-hidden>
                        {initials(g.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm font-semibold leading-snug">{g.name}</span>
                        <span className="mt-1 flex flex-wrap items-center gap-1.5 text-xs text-muted">
                          <span className="inline-flex items-center gap-1">
                            <Users size={12} aria-hidden />
                            {g.members} {g.members === 1 ? "persona" : "personas"}
                          </span>
                          {g.owner_id === user.id && <Badge variant="tone">creado por ti</Badge>}
                        </span>
                      </span>
                      <ChevronRight size={18} className="shrink-0 text-muted transition-transform duration-300 group-hover:translate-x-1 group-hover:text-tone" />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
            <div className="grid gap-3">
              <div className="rounded-[20px] bg-surface-2/50 p-4">
                <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-muted">
                  <span className="tone-chip-soft h-6 w-6 rounded-lg">
                    <Plus size={13} aria-hidden />
                  </span>
                  Crear un grupo
                </p>
                <CreateGroupForm />
              </div>
              <div className="rounded-[20px] bg-surface-2/50 p-4">
                <p className="mb-2.5 flex items-center gap-2 text-xs font-semibold text-muted">
                  <span className="tone-chip-soft h-6 w-6 rounded-lg">
                    <KeyRound size={13} aria-hidden />
                  </span>
                  Unirme con un código
                </p>
                <JoinGroupForm />
              </div>
            </div>
          </Card>
        </div>

        <div className="min-w-0 space-y-6">
          <Card id="perfil-social" className="scroll-mt-24">
            <CardTitle icon={<ShieldCheck size={16} />} subtitle="Tú decides qué se ve y quién lo ve">
              Tu perfil social
            </CardTitle>
            <SocialProfileForm
              username={profile.username}
              shareStats={profile.share_stats}
              suggestion={suggestUsername(profile.display_name, user.email ?? "")}
            />
          </Card>

          <Card id="amigos" className="scroll-mt-24">
            <CardTitle
              icon={<Users size={16} />}
              action={
                incoming.length > 0 ? (
                  <Badge variant="solid">
                    {incoming.length} nueva{incoming.length === 1 ? "" : "s"}
                  </Badge>
                ) : undefined
              }
            >
              Amigos
            </CardTitle>
            {!profile.username && <p className="mb-3 text-xs text-muted">Guarda tu nombre de usuario para que puedan encontrarte.</p>}
            <AddFriendForm />

            {incoming.length > 0 && (
              <section className="mt-6">
                <SectionLabel icon={<Inbox size={13} />} count={incoming.length}>
                  Solicitudes recibidas
                </SectionLabel>
                <ul className="space-y-2">
                  {incoming.map((f) => (
                    <li
                      key={f.friendship_id}
                      className="pop-in flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[color-mix(in_srgb,var(--tone)_30%,transparent)] bg-tone-soft/60 p-2.5"
                    >
                      <PersonLabel id={f.user_id} name={personName(f)} username={f.username} />
                      <FriendRequestActions id={f.friendship_id} incoming />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {accepted.length > 0 && (
              <section className="mt-6">
                <SectionLabel icon={<Users size={13} />} count={accepted.length}>
                  Tus amigos
                </SectionLabel>
                <ul className="space-y-0.5">
                  {accepted.map((f) => (
                    <li key={f.friendship_id} className="group -mx-2 flex items-center justify-between gap-2 rounded-2xl px-2 py-1.5 transition-colors hover:bg-surface-2/60">
                      <PersonLabel id={f.user_id} name={personName(f)} username={f.username} note={f.shares_stats ? undefined : "No comparte"} />
                      <RemoveFriendButton id={f.friendship_id} name={personName(f)} />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {outgoing.length > 0 && (
              <section className="mt-6">
                <SectionLabel icon={<Clock size={13} />} count={outgoing.length}>
                  Esperando respuesta
                </SectionLabel>
                <ul className="space-y-2">
                  {outgoing.map((f) => (
                    <li key={f.friendship_id} className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-dashed border-border-strong p-2.5">
                      <PersonLabel id={f.user_id} name={personName(f)} username={f.username} muted />
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

/** Cifra del perfil (amigos, grupos, solicitudes). */
function Counter({ value, label, highlight }: { value: number; label: string; highlight?: boolean }) {
  return (
    <div className={cn("min-w-[84px] rounded-2xl border border-border px-3 py-2.5 text-center backdrop-blur", highlight ? "bg-surface-3" : "bg-surface")}>
      <p className="num-xl text-[28px]">{value}</p>
      <p className="mt-1 text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</p>
    </div>
  );
}

function SectionLabel({ icon, count, children }: { icon: React.ReactNode; count: number; children: React.ReactNode }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <span className="tone-chip-soft h-6 w-6 rounded-lg">{icon}</span>
      <h3 className="text-xs font-semibold uppercase tracking-[0.08em] text-muted">{children}</h3>
      <span className="rounded-full bg-surface-2 px-1.5 text-[11px] font-semibold tabular text-muted">{count}</span>
    </div>
  );
}

function PersonLabel({ id, name, username, note, muted }: { id: string; name: string; username: string | null; note?: string; muted?: boolean }) {
  return (
    <span className={cn("flex min-w-0 items-center gap-2.5", muted && "opacity-80")}>
      <Avatar name={name} seed={id} />
      <span className="min-w-0">
        <span className="block truncate text-sm font-semibold">{name}</span>
        <span className="flex min-w-0 items-center gap-1.5 text-xs text-muted">
          {username && <span className="truncate">@{username}</span>}
          {note && (
            <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-surface-2 px-1.5 py-px text-[10.5px] font-medium">
              <EyeOff size={10} aria-hidden />
              {note}
            </span>
          )}
        </span>
      </span>
    </span>
  );
}
