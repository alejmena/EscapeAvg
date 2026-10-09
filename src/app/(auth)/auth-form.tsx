"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { ErrorText, Field, Input } from "@/components/ui/form";
import { signIn, signUp, type AuthState } from "./actions";

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>((prev, formData) => {
    // La zona horaria del navegador define qué es "hoy" en las estadísticas.
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    return mode === "login" ? signIn(prev, formData) : signUp(prev, formData);
  }, {});

  return (
    <form action={action} className="space-y-4">
      {mode === "signup" && (
        <Field label="Nombre" htmlFor="display_name">
          <Input id="display_name" name="display_name" autoComplete="nickname" maxLength={60} placeholder="¿Cómo te llamamos?" />
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <Input id="email" name="email" type="email" autoComplete="email" required />
      </Field>
      <Field label="Contraseña" htmlFor="password" hint={mode === "signup" ? "Mínimo 8 caracteres." : undefined}>
        <Input
          id="password"
          name="password"
          type="password"
          minLength={8}
          maxLength={72}
          autoComplete={mode === "login" ? "current-password" : "new-password"}
          required
        />
      </Field>
      {next && <input type="hidden" name="next" value={next} />}
      <ErrorText>{state.error}</ErrorText>
      {state.message && <p className="rounded-xl bg-success-soft p-3 text-sm text-success">{state.message}</p>}
      <Button type="submit" className="w-full" disabled={pending}>
        {pending ? "Un momento…" : mode === "login" ? "Entrar" : "Crear cuenta"}
      </Button>
      <p className="text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            ¿No tienes cuenta? <Link href="/signup" className="text-accent hover:underline">Regístrate</Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta? <Link href="/login" className="text-accent hover:underline">Entra</Link>
          </>
        )}
      </p>
    </form>
  );
}
