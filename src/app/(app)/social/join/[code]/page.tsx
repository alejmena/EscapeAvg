import type { Metadata } from "next";
import Link from "next/link";
import { UsersRound } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { Card, PageHeader } from "@/components/ui/card";
import { JoinGroupForm } from "@/components/social/social-forms";

export const metadata: Metadata = { title: "Unirme a un grupo" };

/** Enlace de invitación: confirma antes de unirse (una visita nunca cambia nada por sí sola). */
export default async function JoinPage({ params }: { params: Promise<{ code: string }> }) {
  await requireUser();
  const { code } = await params;
  const clean = decodeURIComponent(code).toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 32);
  return (
    <div className="max-w-lg space-y-6">
      <PageHeader title="Unirme a un grupo" />
      <Card className="space-y-4">
        <p className="flex items-center gap-2 text-sm text-muted">
          <UsersRound size={16} />
          Te han invitado a un grupo de Escape Average. Al unirte verás a sus miembros y sus desafíos. Tus estadísticas solo se comparten si
          activas esa opción en Social.
        </p>
        <JoinGroupForm initialCode={clean} />
        <Link href="/social" className="inline-block text-sm text-muted hover:text-text">
          Ahora no
        </Link>
      </Card>
    </div>
  );
}
