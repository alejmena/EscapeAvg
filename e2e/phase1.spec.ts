import { expect, test, type Page } from "@playwright/test";

const shots = process.env.E2E_SCREENSHOTS;
const snap = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

test.describe.configure({ mode: "serial" });

let page: Page;
const email = `e2e-${Date.now()}@example.com`;
const password = "contraseña-segura-123";

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
});

test("registro e inicio de sesión", async () => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/login/);
  await page.goto("/signup");
  await page.getByLabel("Nombre").fill("Alex");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Alex");
  await expect(page.getByText("Empezar a concentrarme").first()).toBeVisible();
  await snap(page, "01-dashboard-empty");
});

test("tareas: crear, contador, subtareas, completar y recurrencia", async () => {
  await page.goto("/tasks");
  await page.getByLabel("Nueva tarea rápida").fill("Leer capítulo 3");
  await page.getByLabel("Nueva tarea rápida").press("Enter");
  await expect(page.getByText("Leer capítulo 3")).toBeVisible();

  // Tarea completa con contador, estimación y recurrencia diaria.
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Resolver ejercicios de cálculo");
  await dialog.getByLabel("Tiempo estimado (min)").fill("30");
  await dialog.getByLabel("Objetivo").fill("30");
  await dialog.getByLabel("Unidad").fill("ejercicios");
  await dialog.getByLabel("Repetir").selectOption("daily");
  await dialog.getByRole("button", { name: "Crear tarea" }).click();
  await expect(page.getByText("0 de 30 ejercicios")).toBeVisible();
  await page.getByRole("button", { name: "Sumar uno" }).click();
  await page.getByRole("button", { name: "Sumar uno" }).click();
  await expect(page.getByText("2 de 30 ejercicios")).toBeVisible();

  // Dividir en pasos desde el editor.
  await page.getByText("Resolver ejercicios de cálculo").click();
  await dialog.getByRole("button", { name: "Sugerir pasos" }).click();
  await dialog.getByRole("checkbox").first().check();
  await dialog.getByRole("checkbox").nth(1).check();
  await dialog.getByRole("button", { name: /Añadir 2 pasos/ }).click();
  await dialog.getByRole("button", { name: "Cerrar" }).click();
  await expect(page.getByText("0/2 pasos")).toBeVisible();

  // Completar la recurrente crea la siguiente para mañana.
  await page.getByRole("checkbox", { name: 'Completar "Resolver ejercicios de cálculo"' }).click();
  await expect(page.getByText("Completadas hoy")).toBeVisible();
  await page.goto("/tasks?view=upcoming");
  await expect(page.getByText("Resolver ejercicios de cálculo")).toBeVisible();
  await snap(page, "02-tasks-upcoming");
  await page.goto("/tasks");
  await snap(page, "03-tasks-today");
});

test("concentración: pomodoro con pausa, interrupción y finalización", async () => {
  await page.goto("/focus");
  await page.getByLabel("Tarea", { exact: true }).selectOption({ label: "Leer capítulo 3" });
  await page.getByRole("button", { name: "Empezar a concentrarme" }).click();
  await expect(page.getByRole("button", { name: "Pausar" })).toBeVisible();
  await page.getByRole("button", { name: "Me distraje" }).click();
  await expect(page.getByText("1 interrupciones registradas")).toBeVisible();
  await page.getByRole("button", { name: "Pausar" }).click();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  // La sesión persiste al recargar (estado en servidor).
  await page.reload();
  await expect(page.getByRole("button", { name: "Continuar" })).toBeVisible();
  await page.getByRole("button", { name: "Continuar" }).click();
  await page.getByRole("button", { name: "Sin distracciones" }).click();
  await expect(page.getByLabel("Salir del modo sin distracciones")).toBeVisible();
  await snap(page, "04-focus-zen");
  await page.keyboard.press("Escape");
  await page.getByRole("button", { name: "Finalizar" }).click();
  await expect(page.getByText(/Sesión completada/)).toBeVisible();
  await expect(page.getByRole("button", { name: /Descanso corto/ })).toBeVisible();
});

test("Just Start y registro manual", async () => {
  await page.goto("/focus?just=2");
  await page.getByRole("button", { name: "2 min" }).click();
  await expect(page.getByText("Just Start")).toBeVisible();
  await page.getByRole("button", { name: "Finalizar" }).click();
  await expect(page.getByText(/Sesión completada/)).toBeVisible();
  await page.getByPlaceholder("Minutos").fill("45");
  await page.getByRole("button", { name: "Añadir" }).click();
  await expect(page.getByText("Registro manual").first()).toBeVisible();
  await snap(page, "05-focus-history");
});

test("hábitos: crear, marcar hecho y racha", async () => {
  await page.goto("/habits");
  await page.getByRole("button", { name: "Nuevo hábito" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill("Leer 10 páginas");
  await dialog.getByRole("button", { name: "Crear hábito" }).click();
  await expect(page.getByText("Leer 10 páginas")).toBeVisible();
  await page.getByRole("button", { name: "Hecho" }).click();
  await expect(page.getByText("¡Hecho hoy!")).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();
  await page.getByRole("button", { name: "Ver historial" }).click();
  await snap(page, "06-habits");
});

test("notas adhesivas: crear, escribir, autoguardar y convertir en tarea", async () => {
  await page.goto("/notes");
  await expect(page).toHaveURL(/\/notes\/[0-9a-f-]{36}/);
  await page.getByRole("button", { name: "Nota" }).click();
  const note = page.getByLabel("Contenido de la nota").first();
  await note.fill("Preparar presentación\n- Buscar datos\n- Hacer diapositivas");
  await expect(page.getByText("Guardado")).toBeVisible({ timeout: 5000 });
  // Arrastrar la nota.
  const handle = page.getByLabel("Mover nota (flechas del teclado)").first();
  const box = (await handle.boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(box.x + 320, box.y + 160, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByText("Guardado")).toBeVisible();
  await page.reload();
  await expect(page.getByLabel("Contenido de la nota").first()).toHaveValue(/Preparar presentación/);
  const after = (await page.getByLabel("Mover nota (flechas del teclado)").first().boundingBox())!;
  expect(after.x - box.x).toBeGreaterThan(250);
  await page.getByRole("button", { name: "Convertir en tarea" }).click();
  await expect(page.getByTitle("Convertida en tarea")).toBeVisible();
  await snap(page, "07-notes");
  await page.goto("/tasks");
  await expect(page.getByText("Preparar presentación")).toBeVisible();
  await expect(page.getByText("0/2 pasos").first()).toBeVisible();
});

test("objetivos y estadísticas con datos reales", async () => {
  await page.goto("/goals");
  await page.getByRole("button", { name: "Nuevo objetivo" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill("Completar 3 tareas esta semana");
  await dialog.getByLabel("Qué se mide").selectOption("tasks_completed");
  await dialog.getByLabel("Meta").fill("3");
  await dialog.getByRole("button", { name: "Crear objetivo" }).click();
  // Ya hay 1 tarea completada (la recurrente).
  await expect(page.getByText("de 3")).toBeVisible();

  await page.goto("/stats?range=week");
  await expect(page.getByRole("heading", { name: "Estadísticas" })).toBeVisible();
  // 45 min manuales + sesiones cortas: al menos 45 min.
  await expect(page.getByText(/^45 min$|^4[5-9] min$/).first()).toBeVisible();
  await snap(page, "08-stats");

  await page.goto("/dashboard");
  await expect(page.getByText("Completar 3 tareas esta semana")).toBeVisible();
  await expect(page.getByText("1 día").first()).toBeVisible();
  await snap(page, "09-dashboard");
});

test("privacidad: otro usuario no ve nada", async ({ browser }) => {
  const other = await browser.newPage();
  await other.goto("/signup");
  await other.getByLabel("Email").fill(`other-${Date.now()}@example.com`);
  await other.getByLabel("Contraseña").fill(password);
  await other.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(other).toHaveURL(/\/dashboard/);
  await other.goto("/tasks?view=all");
  await expect(other.getByText("Nada pendiente aquí")).toBeVisible();
  await other.close();
});

test("móvil y modo oscuro", async () => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/dashboard");
  await expect(page.locator("html")).toHaveClass(/dark/);
  await expect(page.getByRole("navigation", { name: "Navegación móvil" })).toBeVisible();
  await expect(page.getByText("Racha de constancia")).toBeVisible();
  await snap(page, "10-mobile-dark-dashboard");
  // Todas las secciones accesibles desde el menú "Más".
  await page.getByRole("button", { name: "Más" }).click();
  const sheet = page.getByRole("dialog");
  await expect(sheet.getByRole("link", { name: /Social/ })).toBeVisible();
  await sheet.getByRole("link", { name: /Hábitos/ }).click();
  await expect(page).toHaveURL(/\/habits/);
  await expect(sheet).toBeHidden();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await page.goto("/focus");
  await expect(page.getByText("Just Start").first()).toBeVisible();
  await snap(page, "11-mobile-dark-focus");
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
});

test("ajustes y cierre de sesión", async () => {
  await page.goto("/settings");
  await page.getByLabel("Pomodoro (min)").fill("30");
  await page.getByRole("button", { name: "Guardar cambios" }).click();
  await expect(page.getByText("Guardado")).toBeVisible();
  await page.goto("/focus");
  await expect(page.getByText("30:00")).toBeVisible();
  await page.goto("/dashboard");
  await page.getByRole("button", { name: "Cerrar sesión" }).click();
  await expect(page).toHaveURL(/\/login/);
});
