"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { ArrowRight, CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle, LockKeyhole, Mail, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/form";
import { cn } from "@/lib/cn";
import { signIn, signUp, type AuthState } from "./actions";

// Campo con icono a la izquierda: el icono se ilumina al enfocar.
const fieldClass = "h-12 rounded-2xl! pl-11! text-[15px]";

function FieldIcon({ children }: { children: React.ReactNode }) {
  return (
    <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint transition-colors duration-200 group-focus-within:text-accent" aria-hidden>
      {children}
    </span>
  );
}

/** Seguridad orientativa de la clave (solo visual; la validación real sigue siendo mínimo 8 caracteres). */
function strength(pw: string): 0 | 1 | 2 | 3 | 4 {
  if (!pw) return 0;
  if (pw.length < 8) return 1;
  let s = 1;
  if (pw.length >= 12) s++;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
  if (/\d/.test(pw) || /[^A-Za-z0-9]/.test(pw)) s++;
  return Math.min(4, s) as 1 | 2 | 3 | 4;
}

const STRENGTH = [
  { label: "", bar: "" },
  { label: "Muy corta", bar: "bg-danger" },
  { label: "Aceptable", bar: "bg-warning" },
  { label: "Buena", bar: "bg-success" },
  { label: "Excelente", bar: "bg-gradient-to-r from-success to-accent" },
] as const;

export function AuthForm({ mode, next }: { mode: "login" | "signup"; next?: string }) {
  const [state, action, pending] = useActionState<AuthState, FormData>((prev, formData) => {
    // La zona horaria del navegador define qué es "hoy" en las estadísticas.
    formData.set("timezone", Intl.DateTimeFormat().resolvedOptions().timeZone);
    return mode === "login" ? signIn(prev, formData) : signUp(prev, formData);
  }, {});
  const [show, setShow] = useState(false);
  const [pw, setPw] = useState("");
  const level = strength(pw);

  return (
    <form action={action} onReset={() => setPw("")} className="space-y-4">
      {mode === "signup" && (
        <Field label="Nombre" htmlFor="display_name">
          <div className="group relative">
            <FieldIcon>
              <UserRound size={18} />
            </FieldIcon>
            <Input id="display_name" name="display_name" autoComplete="nickname" maxLength={60} placeholder="¿Cómo te llamamos?" className={fieldClass} />
          </div>
        </Field>
      )}
      <Field label="Email" htmlFor="email">
        <div className="group relative">
          <FieldIcon>
            <Mail size={18} />
          </FieldIcon>
          <Input id="email" name="email" type="email" autoComplete="email" placeholder="tu@correo.com" required className={fieldClass} />
        </div>
      </Field>
      <Field label="Contraseña" htmlFor="password" hint={mode === "signup" ? "Mínimo 8 caracteres." : undefined}>
        <div className="group relative">
          <FieldIcon>
            <LockKeyhole size={18} />
          </FieldIcon>
          <Input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            minLength={8}
            maxLength={72}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            onChange={(e) => setPw(e.target.value)}
            className={cn(fieldClass, "pr-12!")}
          />
          <button
            type="button"
            onClick={() => setShow((v) => !v)}
            aria-pressed={show}
            aria-label="Mostrar la clave"
            title={show ? "Ocultar" : "Mostrar"}
            className="press absolute right-1.5 top-1/2 grid h-9 w-9 -translate-y-1/2 place-items-center rounded-xl text-muted hover:bg-surface-2 hover:text-text"
          >
            {show ? <EyeOff size={18} aria-hidden /> : <Eye size={18} aria-hidden />}
          </button>
        </div>
        {mode === "signup" && (
          <div className="mt-2.5 flex items-center gap-3" aria-live="polite">
            <div className="flex flex-1 gap-1.5" aria-hidden>
              {[1, 2, 3, 4].map((i) => (
                <span key={i} className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <span
                    className={cn("block h-full rounded-full transition-[width] duration-500 ease-[var(--ease-out)]", STRENGTH[level].bar)}
                    style={{ width: level >= i ? "100%" : "0%" }}
                  />
                </span>
              ))}
            </div>
            <span className={cn("w-[72px] text-right text-xs font-semibold", level <= 1 ? "text-danger" : level === 2 ? "text-warning" : "text-success")}>
              {STRENGTH[level].label}
            </span>
          </div>
        )}
      </Field>
      {next && <input type="hidden" name="next" value={next} />}
      {state.error && (
        <p role="alert" className="pop-in flex items-start gap-2.5 rounded-2xl bg-danger-soft px-3.5 py-3 text-sm text-danger">
          <CircleAlert size={18} className="mt-px shrink-0" aria-hidden />
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="pop-in flex items-start gap-2.5 rounded-2xl bg-success-soft px-3.5 py-3 text-sm text-success">
          <CircleCheck size={18} className="mt-px shrink-0" aria-hidden />
          {state.message}
        </p>
      )}
      <Button type="submit" size="lg" className="group mt-2 w-full" disabled={pending}>
        {pending ? (
          <>
            <LoaderCircle size={18} className="animate-spin" aria-hidden />
            Un momento…
          </>
        ) : (
          <>
            {mode === "login" ? "Entrar" : "Crear cuenta"}
            <ArrowRight size={18} className="transition-transform duration-300 group-hover:translate-x-1" aria-hidden />
          </>
        )}
      </Button>
      <p className="border-t border-border pt-5 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            ¿No tienes cuenta?{" "}
            <Link href="/signup" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
              Regístrate
            </Link>
          </>
        ) : (
          <>
            ¿Ya tienes cuenta?{" "}
            <Link href="/login" className="font-semibold text-accent-ink underline-offset-4 hover:underline">
              Entra
            </Link>
          </>
        )}
      </p>
    </form>
  );
}
