import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, Ticket, UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { PageHeader } from "@/components/ui/card";
import { JoinGroupForm } from "@/components/social/social-forms";

export const metadata: Metadata = { title: "Unirme a un grupo" };

/** Enlace de invitación: confirma antes de unirse (una visita nunca cambia nada por sí sola). */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  await requireUser();
  const { code } = await params;
  const clean = decodeURIComponent(code).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
  return (
    <div className="max-w-xl space-y-6">
      <PageHeader title="Unirme a un grupo" />
      {/* La invitación, como una entrada: cabecera de color y talón con el formulario. */}
      <div className="card-glass relative overflow-hidden rounded-[26px]">
        <div className="card-feature rounded-none border-0 px-5 pb-7 pt-6 shadow-none sm:px-7">
          <Ticket className="pointer-events-none absolute -right-6 -top-6 h-36 w-36 rotate-12 text-white/[0.1]" aria-hidden />
          <div className="relative flex items-center gap-3">
            <span className="tone-chip-soft h-12 w-12 rounded-[16px]">
              <UsersRound size={22} aria-hidden />
            </span>
            <div>
              <p className="eyebrow">Invitación</p>
              <p className="font-display text-xl font-bold leading-tight">Te esperan en un grupo</p>
            </div>
          </div>
          <p className="relative mt-4 text-sm leading-relaxed text-muted">
            Te han invitado a un grupo de Escape Average. Al unirte verás a sus miembros y sus desafíos. Tus estadísticas solo se comparten si
            activas esa opción en Social.
          </p>
          {clean && (
            <p className="relative mt-5 inline-flex max-w-full items-center gap-2 rounded-2xl border border-dashed border-border-strong bg-surface px-3.5 py-2">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-faint">Código</span>
              <code className="truncate font-mono text-base font-bold tracking-[0.12em]">{clean}</code>
            </p>
          )}
        </div>
        <div className="relative border-t border-dashed border-border-strong px-5 py-5 sm:px-7">
          <JoinGroupForm initialCode={clean} cta />
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <ShieldCheck size={13} className="shrink-0 text-tone" aria-hidden />
              Nada cambia hasta que pulses «Unirme».
            </p>
            <Link href="/social" className="press inline-block rounded-full px-3 py-1.5 text-sm text-muted hover:bg-surface-2 hover:text-text">
              Ahora no
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
