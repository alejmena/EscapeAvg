import { Users } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/ui/card";

/** Se muestra si la base de datos aún no tiene las tablas sociales (migración pendiente). */
export function SocialSetupNotice() {
  return (
    <div className="space-y-6">
      <PageHeader title="Social" />
      <EmptyState icon={<Users size={28} />} title="Las funciones sociales se están activando">
        <p>Falta un último paso en la base de datos. El resto de la app funciona con normalidad; vuelve a intentarlo en un rato.</p>
      </EmptyState>
    </div>
  );
}
