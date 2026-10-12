import Link from "next/link";
import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/card";
import { buttonClass } from "@/components/ui/button";

/** Se muestra si la base de datos aún no tiene las tablas sociales (migración pendiente). */
export function SocialSetupNotice() {
  return (
    <div className="space-y-6">
      <PageHeader title="Social" />
      <EmptyState
        icon={<Users size={28} />}
        title="Las funciones sociales se están activando"
        action={
          <Link href="/dashboard" className={buttonClass("secondary", "sm")}>
            Volver al inicio
          </Link>
        }
      >
        <p>Falta un último paso en la base de datos. El resto de la app funciona con normalidad; vuelve a intentarlo en un rato.</p>
      </EmptyState>
    </div>
  );
}
