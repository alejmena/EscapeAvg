import Link from "next/link";
import { buttonClass } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto max-w-md py-24 text-center">
      <h1 className="text-xl font-semibold">Página no encontrada</h1>
      <Link href="/dashboard" className={buttonClass("primary", "md", "mt-6")}>
        Ir al inicio
      </Link>
    </main>
  );
}
