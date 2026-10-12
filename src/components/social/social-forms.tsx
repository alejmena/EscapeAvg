"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  CheckCircle2,
  Copy,
  KeyRound,
  LogOut,
  Plus,
  RefreshCw,
  Send,
  Swords,
  Trash2,
  UserMinus,
  UserPlus,
  X,
} from "lucide-react";
import {
  createGroup,
  createSharedChallenge,
  deleteGroup,
  deleteSharedChallenge,
  joinGroup,
  leaveGroup,
  removeFriendship,
  removeMember,
  respondFriendRequest,
  rotateGroupCode,
  sendFriendRequest,
  updateSocialProfile,
} from "@/app/(app)/social/actions";
import { addDays } from "@/lib/domain/dates";
import { SHARED_METRIC_LABEL, SHARED_METRICS, USERNAME_RE, type SharedMetric } from "@/lib/domain/social";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Label } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";
import { SHARED_METRIC_META } from "@/components/social/meta";
import { cn } from "@/lib/cn";

/** Mensaje breve de éxito con un check que aparece. */
function Success({ children }: { children: React.ReactNode }) {
  return (
    <p className="pop-in inline-flex items-center gap-1.5 text-sm font-medium text-success">
      <CheckCircle2 size={15} className="shrink-0" aria-hidden />
      {children}
    </p>
  );
}

/** Nombre de usuario y consentimiento para compartir estadísticas. */
export function SocialProfileForm({ username, shareStats, suggestion }: { username: string | null; shareStats: boolean; suggestion: string }) {
  const [name, setName] = useState(username ?? suggestion);
  const [share, setShare] = useState(shareStats);
  const [saved, setSaved] = useState(false);
  const { run, pending, error } = useAction();
  const dirty = name !== (username ?? "") || share !== shareStats;
  const valid = USERNAME_RE.test(name.trim());
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        setSaved(false);
        run(() => updateSocialProfile({ username: name.trim() || null, share_stats: share }), () => setSaved(true));
      }}
    >
      <Field label="Tu nombre de usuario" htmlFor="username" hint="Tus amigos te encuentran con él. Letras sin acentos, números o _.">
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 font-display text-[15px] font-semibold text-tone" aria-hidden>
            @
          </span>
          <Input
            id="username"
            value={name}
            maxLength={24}
            autoComplete="off"
            className="pl-8 pr-9"
            onChange={(e) => {
              setName(e.target.value.toLowerCase());
              setSaved(false);
            }}
          />
          {/* Indicador en vivo: el formato es válido. */}
          <span
            className={cn(
              "pointer-events-none absolute right-3 top-1/2 grid h-5 w-5 -translate-y-1/2 place-items-center rounded-full bg-success-soft text-success transition-all duration-300",
              valid ? "scale-100 opacity-100" : "scale-50 opacity-0",
            )}
            aria-hidden
          >
            <Check size={12} strokeWidth={3} />
          </span>
        </div>
      </Field>
      <label
        className={cn(
          "flex cursor-pointer items-start gap-3 rounded-2xl border p-3.5 text-sm transition-colors duration-300",
          share ? "border-[color-mix(in_srgb,var(--tone)_40%,transparent)] bg-tone-soft/60" : "border-border bg-surface/40 hover:border-border-strong",
        )}
      >
        {/* Interruptor: es un checkbox nativo con otra apariencia (accesible y comprobable). */}
        <span className="relative mt-0.5 inline-flex shrink-0">
          <input
            type="checkbox"
            className="peer h-6 w-11 cursor-pointer appearance-none rounded-full bg-surface-3 shadow-[inset_0_1px_2px_rgb(0_0_0/0.12)] transition-colors duration-300 checked:bg-gradient-to-r checked:from-tone checked:to-tone-2"
            checked={share}
            onChange={(e) => {
              setShare(e.target.checked);
              setSaved(false);
            }}
          />
          <span
            className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-surface shadow-[0_1px_3px_rgb(0_0_0/0.25)] transition-transform duration-300 ease-[var(--ease-spring)] peer-checked:translate-x-5 dark:bg-text"
            aria-hidden
          />
        </span>
        <span>
          <span className="font-semibold">Compartir mis estadísticas con mis amigos y grupos</span>
          <span className="mt-1 block leading-relaxed text-muted">
            Solo se comparten totales: minutos de concentración, tareas completadas, hábitos cumplidos, días activos y tu objetivo semanal.
            Nunca los títulos de tus tareas, notas ni hábitos. Es recíproco: solo verás a quienes también comparten. Puedes desactivarlo
            cuando quieras.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" variant="tone" disabled={pending || (!dirty && !!username)}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {saved && <Success>Guardado</Success>}
        <ErrorText>{error}</ErrorText>
      </div>
    </form>
  );
}

export function AddFriendForm({ disabled }: { disabled?: boolean }) {
  const [name, setName] = useState("");
  const [msg, setMsg] = useState<string | null>(null);
  const { run, pending, error } = useAction();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        setMsg(null);
        run(
          () => sendFriendRequest(name),
          (m) => {
            setMsg(m ?? null);
            setName("");
          },
        );
      }}
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <UserPlus size={16} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <Input
            placeholder="@usuario de tu amigo"
            aria-label="Usuario de tu amigo"
            value={name}
            maxLength={25}
            autoComplete="off"
            className="pl-10"
            onChange={(e) => setName(e.target.value)}
            disabled={disabled}
          />
        </div>
        <Button type="submit" variant="tone" className="shrink-0" disabled={disabled || pending || !name.trim()}>
          <Send size={14} aria-hidden />
          Añadir
        </Button>
      </div>
      {msg && <Success>{msg}</Success>}
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export function FriendRequestActions({ id, incoming }: { id: string; incoming: boolean }) {
  const { run, pending, error } = useAction();
  return (
    <div className="flex items-center gap-1.5">
      {incoming ? (
        <>
          <Button size="sm" variant="tone" disabled={pending} onClick={() => run(() => respondFriendRequest(id, true))}>
            <Check size={14} />
            Aceptar
          </Button>
          <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => respondFriendRequest(id, false))}>
            Rechazar
          </Button>
        </>
      ) : (
        <Button size="sm" variant="ghost" disabled={pending} onClick={() => run(() => removeFriendship(id))}>
          <X size={14} />
          Cancelar
        </Button>
      )}
      {error && <span className="text-xs text-danger">{error}</span>}
    </div>
  );
}

// Acciones secundarias de una fila: visibles al pasar por encima en escritorio, siempre en táctil.
const ROW_ACTION =
  "hover:bg-danger-soft hover:text-danger focus-visible:opacity-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 [@media(hover:hover)]:group-focus-within:opacity-100";

export function RemoveFriendButton({ id, name }: { id: string; name: string }) {
  const { run, pending } = useAction();
  return (
    <Button
      size="icon"
      variant="ghost"
      className={ROW_ACTION}
      disabled={pending}
      aria-label={`Eliminar a ${name} de tus amigos`}
      title="Eliminar amistad"
      onClick={() => confirm(`¿Eliminar a ${name} de tus amigos? Dejaréis de ver vuestras estadísticas.`) && run(() => removeFriendship(id))}
    >
      <UserMinus size={15} />
    </Button>
  );
}

export function CreateGroupForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const { run, pending, error } = useAction();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => createGroup({ name, description: null }),
          (id) => id && router.push(`/social/groups/${id}`),
        );
      }}
    >
      <div className="flex gap-2">
        <Input placeholder="Nombre del grupo" aria-label="Nombre del grupo" value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
        <Button type="submit" variant="tone" className="shrink-0" disabled={pending || !name.trim()}>
          <Plus size={15} aria-hidden />
          Crear
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

/** `cta`: botón con el color de la sección (en la página de invitación es la acción principal). */
export function JoinGroupForm({ initialCode = "", cta = false }: { initialCode?: string; cta?: boolean }) {
  const router = useRouter();
  const [code, setCode] = useState(initialCode);
  const { run, pending, error } = useAction();
  return (
    <form
      className="space-y-2"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () => joinGroup(code),
          (id) => id && router.push(`/social/groups/${id}`),
        );
      }}
    >
      <div className="flex gap-2">
        <div className="relative min-w-0 flex-1">
          <KeyRound size={15} className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-faint" aria-hidden />
          <Input placeholder="Código o enlace de invitación" aria-label="Código de invitación" className="pl-10" value={code} onChange={(e) => setCode(e.target.value)} />
        </div>
        <Button type="submit" variant={cta ? "tone" : "secondary"} className="shrink-0" disabled={pending || !code.trim()}>
          Unirme
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export function InviteBox({ groupId, code, isOwner }: { groupId: string; code: string; isOwner: boolean }) {
  const [copied, setCopied] = useState(false);
  const { run, pending, error } = useAction();
  return (
    <div className="space-y-3">
      <p className="text-sm text-muted">Comparte este enlace o el código con quien quieras invitar.</p>
      {/* El código, como una entrada de evento. */}
      <div className="relative rounded-2xl border border-dashed border-border-strong bg-surface px-4 py-3 text-center">
        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-faint">Código</p>
        <code className="mt-0.5 block break-all font-mono text-xl font-bold tracking-[0.12em]" data-testid="invite-code">
          {code}
        </code>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button
          size="sm"
          variant="secondary"
          className={cn("flex-1", copied && "!border-transparent !bg-success !text-white")}
          onClick={async () => {
            const link = `${window.location.origin}/social/join/${code}`;
            try {
              await navigator.clipboard.writeText(link);
              setCopied(true);
              setTimeout(() => setCopied(false), 2000);
            } catch {
              prompt("Copia el enlace:", link);
            }
          }}
        >
          {copied ? <Check size={14} className="pop-in" /> : <Copy size={14} />}
          {copied ? "Copiado" : "Copiar enlace"}
        </Button>
        {isOwner && (
          <Button
            size="sm"
            variant="ghost"
            disabled={pending}
            title="El código anterior dejará de funcionar"
            onClick={() => confirm("¿Generar un código nuevo? El anterior dejará de funcionar.") && run(() => rotateGroupCode(groupId))}
          >
            <RefreshCw size={14} className={cn(pending && "animate-spin")} />
            Nuevo código
          </Button>
        )}
      </div>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

export function RemoveMemberButton({ groupId, userId, name }: { groupId: string; userId: string; name: string }) {
  const { run, pending } = useAction();
  return (
    <Button
      size="icon"
      variant="ghost"
      className={ROW_ACTION}
      disabled={pending}
      aria-label={`Quitar a ${name} del grupo`}
      onClick={() => confirm(`¿Quitar a ${name} del grupo?`) && run(() => removeMember(groupId, userId))}
    >
      <UserMinus size={15} />
    </Button>
  );
}

export function LeaveOrDeleteGroup({ groupId, isOwner, name }: { groupId: string; isOwner: boolean; name: string }) {
  const router = useRouter();
  const { run, pending, error } = useAction();
  return (
    <div className="space-y-1">
      <Button
        variant="danger"
        size="sm"
        disabled={pending}
        onClick={() => {
          const ok = isOwner
            ? confirm(`¿Eliminar el grupo "${name}"? Se borrarán sus desafíos para todos. Las estadísticas de cada persona no se tocan.`)
            : confirm(`¿Salir del grupo "${name}"?`);
          if (ok) run(() => (isOwner ? deleteGroup(groupId) : leaveGroup(groupId)), () => router.push("/social"));
        }}
      >
        {isOwner ? <Trash2 size={14} /> : <LogOut size={14} />}
        {isOwner ? "Eliminar grupo" : "Salir del grupo"}
      </Button>
      <ErrorText>{error}</ErrorText>
    </div>
  );
}

const DEFAULT_TARGET: Record<SharedMetric, number> = { focus_minutes: 300, tasks_completed: 10, habit_completions: 10, active_days: 5 };

export function SharedChallengeForm({ groupId, today }: { groupId: string; today: string }) {
  const [metric, setMetric] = useState<SharedMetric>("focus_minutes");
  const [target, setTarget] = useState(DEFAULT_TARGET.focus_minutes);
  const [title, setTitle] = useState("");
  const [days, setDays] = useState(7);
  const { run, pending, error } = useAction();
  const unit = SHARED_METRIC_LABEL[metric].unit;
  return (
    <form
      className="space-y-4"
      onSubmit={(e) => {
        e.preventDefault();
        run(
          () =>
            createSharedChallenge({
              group_id: groupId,
              title: title.trim() || `${target} ${unit} en ${days} días`,
              metric,
              target_value: target,
              start_date: today,
              end_date: addDays(today, days - 1),
            }),
          () => setTitle(""),
        );
      }}
    >
      <fieldset>
        <legend className="mb-1.5 text-xs font-semibold text-muted">Qué medimos</legend>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {SHARED_METRICS.map((m) => {
            const { tone, icon: Icon } = SHARED_METRIC_META[m];
            const active = metric === m;
            return (
              <button
                key={m}
                type="button"
                data-tone={tone}
                aria-pressed={active}
                onClick={() => {
                  setMetric(m);
                  setTarget(DEFAULT_TARGET[m]);
                }}
                className={cn(
                  "press flex min-w-0 items-center gap-2 rounded-2xl border p-2 text-left text-[12.5px] font-medium leading-tight transition-colors",
                  active ? "border-[color-mix(in_srgb,var(--tone)_45%,transparent)] bg-tone-soft text-tone-ink" : "border-border bg-surface/60 text-muted hover:text-text",
                )}
              >
                <span className={cn("h-8 w-8 rounded-xl", active ? "tone-chip" : "tone-chip-soft")}>
                  <Icon size={15} aria-hidden />
                </span>
                <span className="min-w-0">{SHARED_METRIC_LABEL[m].label}</span>
              </button>
            );
          })}
        </div>
      </fieldset>
      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <Field label={`Meta por persona (${unit})`} htmlFor="sc-target">
          <Input id="sc-target" type="number" min={1} max={100000} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </Field>
        <div>
          <Label id="sc-days-label">Duración</Label>
          <div className="seg" role="group" aria-labelledby="sc-days-label">
            {[3, 7, 14, 30].map((d) => (
              <button key={d} type="button" aria-pressed={days === d} onClick={() => setDays(d)}>
                {d} días
              </button>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Input
          placeholder={`Nombre (opcional): ${target} ${unit} en ${days} días`}
          aria-label="Nombre del desafío"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" variant="tone" className="shrink-0" disabled={pending || !(target >= 1)}>
          <Swords size={15} aria-hidden />
          Crear desafío
        </Button>
      </div>
      <p className="text-xs text-muted">Empieza hoy. Cada persona avanza a su ritmo hacia la misma meta; nadie pierde por quedarse atrás.</p>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export function DeleteChallengeButton({ id }: { id: string }) {
  const { run, pending } = useAction();
  return (
    <Button
      size="icon"
      variant="ghost"
      className="h-8 w-8 hover:bg-danger-soft hover:text-danger"
      disabled={pending}
      aria-label="Eliminar desafío"
      onClick={() => confirm("¿Eliminar este desafío para todo el grupo?") && run(() => deleteSharedChallenge(id))}
    >
      <Trash2 size={14} />
    </Button>
  );
}
