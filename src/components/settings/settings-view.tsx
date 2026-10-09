"use client";

import { useMemo, useState } from "react";
import { Trash2 } from "lucide-react";
import type { PomodoroSettings } from "@/lib/domain/timer";
import type { Category } from "@/lib/types";
import { createCategory, deleteCategory, updateCategory, updateProfile } from "@/app/(app)/settings/actions";
import { Button } from "@/components/ui/button";
import { Card, CardTitle, PageHeader } from "@/components/ui/card";
import { ErrorText, Field, Input, Select } from "@/components/ui/form";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAction } from "@/components/tasks/use-action";
import { WEEKDAY_NAME } from "@/lib/format";

type ProfileForm = {
  display_name: string;
  timezone: string;
  week_starts_on: number;
  weekly_focus_goal_minutes: number;
  streaks_enabled: boolean;
  pomodoro_settings: PomodoroSettings;
};

export function SettingsView({ email, profile, categories }: { email: string; profile: ProfileForm; categories: Category[] }) {
  const [p, setP] = useState(profile);
  const [saved, setSaved] = useState(false);
  const { run, pending, error } = useAction();
  const zones = useMemo(() => {
    try {
      return (Intl as unknown as { supportedValuesOf(k: string): string[] }).supportedValuesOf("timeZone");
    } catch {
      return [profile.timezone];
    }
  }, [profile.timezone]);
  const pom = p.pomodoro_settings;
  const setPom = (k: keyof PomodoroSettings, v: number) => setP({ ...p, pomodoro_settings: { ...pom, [k]: v } });

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Ajustes" subtitle={email} />
      <form
        onSubmit={(e) => {
          e.preventDefault();
          setSaved(false);
          run(() => updateProfile({ ...p, display_name: p.display_name || null }), () => setSaved(true));
        }}
        className="space-y-6"
      >
        <Card>
          <CardTitle>Perfil</CardTitle>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nombre" htmlFor="dn">
              <Input id="dn" maxLength={60} value={p.display_name} onChange={(e) => setP({ ...p, display_name: e.target.value })} />
            </Field>
            <Field label="Zona horaria" htmlFor="tz" hint="Define qué cuenta como 'hoy' en tus estadísticas.">
              <Select id="tz" value={p.timezone} onChange={(e) => setP({ ...p, timezone: e.target.value })}>
                {(zones.includes(p.timezone) ? zones : [p.timezone, ...zones]).map((z) => (
                  <option key={z} value={z}>
                    {z}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="La semana empieza el" htmlFor="ws">
              <Select id="ws" value={p.week_starts_on} onChange={(e) => setP({ ...p, week_starts_on: Number(e.target.value) })}>
                {[1, 0, 6].map((d) => (
                  <option key={d} value={d}>
                    {WEEKDAY_NAME[d]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tema" htmlFor="theme">
              <ThemeToggle />
            </Field>
          </div>
        </Card>

        <Card>
          <CardTitle>Concentración</CardTitle>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <Field label="Pomodoro (min)" htmlFor="pf">
              <Input id="pf" type="number" min={1} max={180} value={pom.focus_minutes} onChange={(e) => setPom("focus_minutes", Number(e.target.value))} />
            </Field>
            <Field label="Descanso corto" htmlFor="ps">
              <Input id="ps" type="number" min={1} max={60} value={pom.short_break_minutes} onChange={(e) => setPom("short_break_minutes", Number(e.target.value))} />
            </Field>
            <Field label="Descanso largo" htmlFor="pl">
              <Input id="pl" type="number" min={1} max={90} value={pom.long_break_minutes} onChange={(e) => setPom("long_break_minutes", Number(e.target.value))} />
            </Field>
            <Field label="Largo cada" htmlFor="pn" hint="pomodoros">
              <Input id="pn" type="number" min={1} max={12} value={pom.sessions_before_long_break} onChange={(e) => setPom("sessions_before_long_break", Number(e.target.value))} />
            </Field>
          </div>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <Field label="Objetivo semanal de concentración (min)" htmlFor="wg" hint="0 para no mostrarlo.">
              <Input id="wg" type="number" min={0} max={10080} value={p.weekly_focus_goal_minutes} onChange={(e) => setP({ ...p, weekly_focus_goal_minutes: Number(e.target.value) })} />
            </Field>
            <label className="flex items-center gap-2 self-end pb-2 text-sm">
              <input type="checkbox" checked={p.streaks_enabled} onChange={(e) => setP({ ...p, streaks_enabled: e.target.checked })} />
              Mostrar rachas (los días de descanso nunca las rompen)
            </label>
          </div>
        </Card>

        <div className="flex items-center gap-3">
          <Button type="submit" disabled={pending}>
            {pending ? "Guardando…" : "Guardar cambios"}
          </Button>
          {saved && <span className="text-sm text-success">Guardado</span>}
          <ErrorText>{error}</ErrorText>
        </div>
      </form>

      <CategoriesCard categories={categories} />

      <Card>
        <CardTitle>Privacidad</CardTitle>
        <p className="text-sm text-muted">
          Tus datos son privados: la base de datos solo permite que tu cuenta lea y escriba tus registros. Las futuras funciones sociales serán
          opcionales y requerirán tu consentimiento explícito para compartir cualquier estadística.
        </p>
      </Card>
    </div>
  );
}

function CategoriesCard({ categories }: { categories: Category[] }) {
  const [name, setName] = useState("");
  const [color, setColor] = useState("#6366f1");
  const { run, pending, error } = useAction();
  return (
    <Card>
      <CardTitle>Categorías</CardTitle>
      <ul className="mb-4 space-y-2">
        {categories.map((c) => (
          <CategoryRow key={c.id} category={c} />
        ))}
      </ul>
      <form
        className="flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          run(() => createCategory({ name, color }), () => setName(""));
        }}
      >
        <input type="color" value={color} onChange={(e) => setColor(e.target.value)} className="h-10 w-10 cursor-pointer rounded-lg border border-border bg-surface" aria-label="Color" />
        <Input placeholder="Nueva categoría" maxLength={40} value={name} onChange={(e) => setName(e.target.value)} aria-label="Nombre de categoría" />
        <Button type="submit" variant="secondary" disabled={pending || !name.trim()}>
          Añadir
        </Button>
      </form>
      <ErrorText>{error}</ErrorText>
    </Card>
  );
}

function CategoryRow({ category }: { category: Category }) {
  const [name, setName] = useState(category.name);
  const [color, setColor] = useState(category.color);
  const { run, error } = useAction();
  const save = (n = name, c = color) => {
    if (n.trim() && (n !== category.name || c !== category.color)) run(() => updateCategory(category.id, { name: n, color: c }));
  };
  return (
    <li className="flex items-center gap-2">
      <input
        type="color"
        value={color}
        onChange={(e) => setColor(e.target.value)}
        onBlur={() => save()}
        className="h-8 w-8 cursor-pointer rounded-md border border-border bg-surface"
        aria-label={`Color de ${category.name}`}
      />
      <Input value={name} maxLength={40} onChange={(e) => setName(e.target.value)} onBlur={() => save()} className="h-9" aria-label="Nombre" />
      <Button
        variant="ghost"
        size="icon"
        aria-label={`Eliminar ${category.name}`}
        onClick={() => confirm(`¿Eliminar "${category.name}"? Sus tareas y hábitos se conservan sin categoría.`) && run(() => deleteCategory(category.id))}
      >
        <Trash2 size={15} />
      </Button>
      {error && <span className="text-xs text-danger">{error}</span>}
    </li>
  );
}
