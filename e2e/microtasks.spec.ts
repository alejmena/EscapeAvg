import { expect, test, type Page } from "@playwright/test";

const shots = process.env.E2E_SCREENSHOTS;
const snap = async (page: Page, name: string, fullPage = true) => {
  if (!shots) return;
  await page.waitForTimeout(700);
  await page.screenshot({ path: `${shots}/${name}.png`, fullPage });
};

/** Espera a que termine la siguiente Server Action (un POST a la página) disparada por `act`. */
async function saved(page: Page, act: () => Promise<void>) {
  const done = page
    .waitForResponse((r) => r.request().method() === "POST" && r.request().headers()["next-action"] !== undefined, { timeout: 15_000 })
    .catch(() => null);
  await act();
  await done;
}

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto("/signup");
  await page.getByLabel("Nombre").fill("Alex");
  await page.getByLabel("Email").fill(`e2e-micro-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("contraseña-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("tareas rápidas: Enter crea, un clic completa, se edita, se reordena, se borra y se deshace", async () => {
  const card = page.getByTestId("quick-tasks");
  const input = card.getByLabel("Añadir tarea rápida");
  for (const t of ["Tender la cama", "Ordenar escritorio", "Leer 10 páginas", "Limpiar habitación", "Repasar vocabulario chino"]) {
    await input.fill(t);
    await input.press("Enter");
    await expect(card.getByText(t)).toBeVisible();
  }
  await expect(input).toBeFocused();
  await expect(card.getByTestId("quick-counter")).toHaveText("0 de 5 completadas");

  await card.getByRole("checkbox", { name: 'Completar "Tender la cama"' }).click();
  await saved(page, () => card.getByRole("checkbox", { name: 'Completar "Ordenar escritorio"' }).click());
  await expect(card.getByTestId("quick-counter")).toHaveText("2 de 5 completadas");
  await snap(page, "1-inicio-tareas-rapidas", false);

  // Se guardan en Supabase: siguen tras recargar y cuentan como tareas completadas.
  await page.reload();
  await expect(card.getByTestId("quick-counter")).toHaveText("2 de 5 completadas");
  await expect(card.getByRole("checkbox", { name: 'Desmarcar "Tender la cama"' })).toBeVisible();
  // No aparecen duplicadas en "Para hoy".
  await expect(page.getByText("Limpiar habitación")).toHaveCount(1);

  // Desmarcar
  await card.getByRole("checkbox", { name: 'Desmarcar "Ordenar escritorio"' }).click();
  await expect(card.getByTestId("quick-counter")).toHaveText("1 de 5 completadas");

  // Editar
  await card.getByText("Leer 10 páginas").click();
  const edit = card.getByLabel("Editar tarea");
  await edit.fill("Leer 20 páginas");
  await saved(page, () => edit.press("Enter"));
  await expect(card.getByText("Leer 20 páginas")).toBeVisible();

  // Arrastrar la última arriba del todo
  const handle = card.getByRole("button", { name: 'Arrastrar "Repasar vocabulario chino" para cambiar el orden' });
  const first = card.getByRole("button", { name: 'Arrastrar "Tender la cama" para cambiar el orden' });
  // Las dos asas tienen que estar en pantalla para arrastrar con el ratón.
  await page.evaluate(() => document.querySelector('[data-testid="quick-tasks"]')?.scrollIntoView({ block: "start" }));
  const hb = (await handle.boundingBox())!;
  const fb = (await first.boundingBox())!;
  await page.mouse.move(hb.x + hb.width / 2, hb.y + hb.height / 2);
  await page.mouse.down();
  await page.mouse.move(hb.x + hb.width / 2, fb.y - 10, { steps: 12 });
  await saved(page, () => page.mouse.up());
  await expect(card.locator("[data-qt-row]").first()).toContainText("Repasar vocabulario chino");
  await page.reload();
  await expect(card.locator("[data-qt-row]").first()).toContainText("Repasar vocabulario chino");

  // Eliminar y deshacer
  await saved(page, () => card.getByRole("button", { name: 'Eliminar "Limpiar habitación"' }).click());
  const row = card.locator("[data-qt-row]", { hasText: "Limpiar habitación" });
  await expect(row).toHaveCount(0);
  await expect(page.getByRole("status").filter({ hasText: "Eliminada: Limpiar habitación" })).toBeVisible();
  await saved(page, () => page.getByRole("button", { name: "Deshacer" }).click());
  await expect(row).toHaveCount(1);
  await page.reload();
  await expect(row).toHaveCount(1);
});

test("tareas rápidas: repetir, plantillas de un clic e historial sin sumar tiempo", async () => {
  const card = page.getByTestId("quick-tasks");
  await card.getByRole("button", { name: 'Más opciones de "Tender la cama"' }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("button", { name: "Todos los días" }).click();
  await dialog.getByRole("button", { name: "Repetir: Todos los días" }).click();
  await expect(dialog).toBeHidden();

  await card.getByRole("button", { name: 'Más opciones de "Ordenar escritorio"' }).click();
  await saved(page, () => page.getByRole("dialog").getByRole("button", { name: "Guardar como plantilla de un clic" }).click());
  await expect(page.getByRole("dialog")).toBeHidden();
  await page.reload();
  await expect(card.getByRole("button", { name: "+ Ordenar escritorio" })).toBeVisible();
  await card.getByRole("button", { name: "+ Ordenar escritorio" }).click();
  await expect(card.locator("[data-qt-row]", { hasText: "Ordenar escritorio" })).toHaveCount(2);

  // La recurrente de hoy no se duplica al recargar.
  await page.reload();
  await expect(card.locator("[data-qt-row]", { hasText: "Tender la cama" })).toHaveCount(1);

  // Las completadas cuentan como tareas, pero no suman tiempo de concentración.
  await expect(page.getByRole("list", { name: "Anillos de hoy" })).toContainText("0 min");

  await page.goto("/microtasks");
  await expect(page.getByTestId("quick-history")).toContainText("Tender la cama");
  await expect(page.getByText("Todos los días")).toBeVisible();
  await page.getByRole("radio", { name: /Se archivan cada día/ }).click();
  await expect(page.getByRole("radio", { name: /Se archivan cada día/ })).toHaveAttribute("aria-checked", "true");
  await snap(page, "2-historial-tareas-rapidas");
});

test("horario semanal: bloques con horas distintas por día y sin solapes", async () => {
  await page.goto("/schedule");
  await page.getByRole("button", { name: "Añadir bloque" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("¿Qué vas a hacer?").fill("Matemáticas");
  for (const d of ["Lunes", "Miércoles", "Viernes"]) {
    if ((await dialog.getByRole("button", { name: d, exact: true }).getAttribute("aria-pressed")) !== "true") {
      await dialog.getByRole("button", { name: d, exact: true }).click();
    }
  }
  // Quita cualquier otro día preseleccionado (hoy).
  for (const d of ["Martes", "Jueves", "Sábado", "Domingo"]) {
    if ((await dialog.getByRole("button", { name: d, exact: true }).getAttribute("aria-pressed")) === "true") {
      await dialog.getByRole("button", { name: d, exact: true }).click();
    }
  }
  await dialog.getByLabel("Inicio Lunes").fill("08:00");
  await dialog.getByLabel("Fin Lunes").fill("10:00");
  await dialog.getByRole("button", { name: "Usar esta hora en todos los días" }).click();
  await dialog.getByLabel("Inicio Viernes").fill("16:00");
  await dialog.getByLabel("Fin Viernes").fill("17:30");
  await dialog.getByRole("button", { name: /Añadir a mi horario \(3 días\)/ }).click();
  await expect(dialog).toBeHidden();
  await expect(page.getByTestId("schedule-col-1")).toContainText("08:00–10:00");
  await expect(page.getByTestId("schedule-col-5")).toContainText("16:00–17:30");

  // Solape: rechazado con un mensaje claro.
  await page.getByRole("button", { name: "Añadir bloque" }).click();
  await dialog.getByLabel("¿Qué vas a hacer?").fill("Gimnasio");
  for (const d of ["Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]) {
    if ((await dialog.getByRole("button", { name: d, exact: true }).getAttribute("aria-pressed")) === "true") {
      await dialog.getByRole("button", { name: d, exact: true }).click();
    }
  }
  if ((await dialog.getByRole("button", { name: "Lunes", exact: true }).getAttribute("aria-pressed")) !== "true") {
    await dialog.getByRole("button", { name: "Lunes", exact: true }).click();
  }
  await dialog.getByLabel("Inicio Lunes").fill("09:00");
  await dialog.getByLabel("Fin Lunes").fill("10:00");
  await dialog.getByRole("button", { name: /Añadir a mi horario/ }).click();
  await expect(dialog.getByRole("alert")).toContainText("Se solapa con «Matemáticas»");
  await dialog.getByLabel("Inicio Lunes").fill("19:00");
  await dialog.getByLabel("Fin Lunes").fill("20:00");
  await dialog.getByRole("button", { name: /Añadir a mi horario/ }).click();
  await expect(dialog).toBeHidden();
});

test("ideas: nube flotante, filtros y añadir una idea al horario", async () => {
  await page.goto("/ideas");
  await expect(page.getByTestId("idea-cloud").getByRole("button")).toHaveCount(18);
  await snap(page, "3-ideas", false);

  await page.getByRole("button", { name: "🗣️ Idiomas y lenguas", exact: true }).click();
  await page.getByLabel("Buscar ideas").fill("ingles");
  await expect(page.getByTestId("idea-list")).toContainText("Llegar a B1 en inglés");
  await expect(page.getByText("Niveles del Marco Común Europeo (MCER)")).toBeVisible();
  await page.getByTestId("idea-list").getByRole("button", { name: /Llegar a B2 en inglés/ }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Nivel clave B2");
  await dialog.getByRole("button", { name: "Cerrar" }).click();

  await page.getByRole("button", { name: "Quitar filtros" }).click();
  await page.getByLabel("Buscar ideas").fill("css moderno");
  await page.getByTestId("idea-list").getByRole("button", { name: /Aprender CSS moderno/ }).click();
  await expect(dialog).toContainText("Dorada");
  await expect(dialog).toContainText("40 h");
  await snap(page, "4-idea-css", false);
  await dialog.getByRole("button", { name: "Añadir a mi horario" }).click();
  for (const d of ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"]) {
    if ((await dialog.getByRole("button", { name: d, exact: true }).getAttribute("aria-pressed")) === "true") {
      await dialog.getByRole("button", { name: d, exact: true }).click();
    }
  }
  await dialog.getByRole("button", { name: "Martes", exact: true }).click();
  await dialog.getByRole("button", { name: "Sábado", exact: true }).click();
  await dialog.getByLabel("Inicio Martes").fill("18:00");
  await dialog.getByLabel("Fin Martes").fill("19:30");
  await dialog.getByLabel("Inicio Sábado").fill("10:00");
  await dialog.getByLabel("Fin Sábado").fill("12:00");
  await dialog.getByRole("button", { name: /Añadir a mi horario \(2 días\)/ }).click();
  await expect(dialog).toContainText("Añadida a tu horario (2 bloques)");
  await expect(dialog).toContainText("terminarías en unas 12 semanas");

  await page.goto("/schedule");
  await expect(page.getByTestId("schedule-col-2")).toContainText("Aprender CSS moderno");
  await expect(page.getByTestId("schedule-col-6")).toContainText("10:00–12:00");
  await snap(page, "5-horario");
});

test("móvil: tareas rápidas, horario e ideas caben y funcionan", async ({ browser }) => {
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, storageState: await page.context().storageState() });
  const m = await ctx.newPage();
  await m.goto("/dashboard");
  const card = m.getByTestId("quick-tasks");
  await card.scrollIntoViewIfNeeded();
  await card.getByLabel("Añadir tarea rápida").fill("Sacar la basura");
  await card.getByLabel("Añadir tarea rápida").press("Enter");
  await card.getByRole("checkbox", { name: 'Completar "Sacar la basura"' }).tap();
  await expect(card.getByRole("checkbox", { name: 'Desmarcar "Sacar la basura"' })).toBeVisible();
  const width = await m.evaluate(() => document.documentElement.scrollWidth);
  expect(width).toBeLessThanOrEqual(392);
  if (shots) await card.screenshot({ path: `${shots}/6-movil-tareas-rapidas.png` });
  await m.goto("/schedule");
  await expect(m.getByTestId("schedule-day-list")).toBeVisible();
  await m.getByRole("tab", { name: "Mar" }).tap();
  await expect(m.getByTestId("schedule-day-list")).toContainText("Aprender CSS moderno");
  await snap(m, "7-movil-horario");
  await m.goto("/ideas");
  await snap(m, "8-movil-ideas", false);
  await ctx.close();
});
