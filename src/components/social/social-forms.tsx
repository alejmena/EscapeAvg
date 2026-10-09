"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy, LogOut, RefreshCw, Trash2, UserMinus, UserPlus, X } from "lucide-react";
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
import { SHARED_METRIC_LABEL, SHARED_METRICS, type SharedMetric } from "@/lib/domain/social";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input, Select } from "@/components/ui/form";
import { useAction } from "@/components/tasks/use-action";

/** Nombre de usuario y consentimiento para compartir estadísticas. */
export function SocialProfileForm({ username, shareStats, suggestion }: { username: string | null; shareStats: boolean; suggestion: string }) {
  const [name, setName] = useState(username ?? suggestion);
  const [share, setShare] = useState(shareStats);
  const [saved, setSaved] = useState(false);
  const { run, pending, error } = useAction();
  const dirty = name !== (username ?? "") || share !== shareStats;
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
        <div className="flex items-center gap-2">
          <span className="text-muted">@</span>
          <Input
            id="username"
            value={name}
            maxLength={24}
            autoComplete="off"
            onChange={(e) => {
              setName(e.target.value.toLowerCase());
              setSaved(false);
            }}
          />
        </div>
      </Field>
      <label className="flex items-start gap-3 rounded-xl border border-border p-3 text-sm">
        <input
          type="checkbox"
          className="mt-0.5"
          checked={share}
          onChange={(e) => {
            setShare(e.target.checked);
            setSaved(false);
          }}
        />
        <span>
          <span className="font-medium">Compartir mis estadísticas con mis amigos y grupos</span>
          <span className="mt-1 block text-muted">
            Solo se comparten totales: minutos de concentración, tareas completadas, hábitos cumplidos, días activos y tu objetivo semanal.
            Nunca los títulos de tus tareas, notas ni hábitos. Es recíproco: solo verás a quienes también comparten. Puedes desactivarlo
            cuando quieras.
          </span>
        </span>
      </label>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={pending || (!dirty && !!username)}>
          {pending ? "Guardando…" : "Guardar"}
        </Button>
        {saved && <span className="text-sm text-success">Guardado</span>}
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
        <Input
          placeholder="@usuario de tu amigo"
          aria-label="Usuario de tu amigo"
          value={name}
          maxLength={25}
          autoComplete="off"
          onChange={(e) => setName(e.target.value)}
          disabled={disabled}
        />
        <Button type="submit" variant="secondary" disabled={disabled || pending || !name.trim()}>
          <UserPlus size={15} />
          Añadir
        </Button>
      </div>
      {msg && <p className="text-sm text-success">{msg}</p>}
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
          <Button size="sm" disabled={pending} onClick={() => run(() => respondFriendRequest(id, true))}>
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

export function RemoveFriendButton({ id, name }: { id: string; name: string }) {
  const { run, pending } = useAction();
  return (
    <Button
      size="icon"
      variant="ghost"
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
        <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
          Crear
        </Button>
      </div>
      <ErrorText>{error}</ErrorText>
    </form>
  );
}

export function JoinGroupForm({ initialCode = "" }: { initialCode?: string }) {
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
        <Input placeholder="Código o enlace de invitación" aria-label="Código de invitación" value={code} onChange={(e) => setCode(e.target.value)} />
        <Button type="submit" variant="secondary" disabled={pending || !code.trim()}>
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
    <div className="space-y-2">
      <p className="text-sm text-muted">Comparte este enlace o el código con quien quieras invitar.</p>
      <div className="flex flex-wrap items-center gap-2">
        <code className="rounded-lg bg-surface-2 px-3 py-2 font-mono text-sm" data-testid="invite-code">
          {code}
        </code>
        <Button
          size="sm"
          variant="secondary"
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
          <Copy size={14} />
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
            <RefreshCw size={14} />
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
      className="space-y-3"
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
      <div className="grid gap-3 sm:grid-cols-4">
        <Field label="Qué medimos" htmlFor="sc-metric" className="sm:col-span-2">
          <Select
            id="sc-metric"
            value={metric}
            onChange={(e) => {
              const m = e.target.value as SharedMetric;
              setMetric(m);
              setTarget(DEFAULT_TARGET[m]);
            }}
          >
            {SHARED_METRICS.map((m) => (
              <option key={m} value={m}>
                {SHARED_METRIC_LABEL[m].label}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={`Meta por persona (${unit})`} htmlFor="sc-target">
          <Input id="sc-target" type="number" min={1} max={100000} value={target} onChange={(e) => setTarget(Number(e.target.value))} />
        </Field>
        <Field label="Duración" htmlFor="sc-days">
          <Select id="sc-days" value={days} onChange={(e) => setDays(Number(e.target.value))}>
            {[3, 7, 14, 30].map((d) => (
              <option key={d} value={d}>
                {d} días
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="flex gap-2">
        <Input
          placeholder={`Nombre (opcional): ${target} ${unit} en ${days} días`}
          aria-label="Nombre del desafío"
          value={title}
          maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
        />
        <Button type="submit" disabled={pending || !(target >= 1)}>
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
      disabled={pending}
      aria-label="Eliminar desafío"
      onClick={() => confirm("¿Eliminar este desafío para todo el grupo?") && run(() => deleteSharedChallenge(id))}
    >
      <Trash2 size={14} />
    </Button>
  );
}
