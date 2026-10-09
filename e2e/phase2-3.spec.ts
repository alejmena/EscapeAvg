import { expect, test, type Page } from "@playwright/test";

const shots = process.env.E2E_SCREENSHOTS;
const snap = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

test.describe.configure({ mode: "serial" });

let page: Page;
const email = `e2e-p2-${Date.now()}@example.com`;
const password = "contraseña-segura-123";

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto("/signup");
  await page.getByLabel("Nombre").fill("Sam");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("proyecto con tarea y tiempo registrado", async () => {
  await page.goto("/tasks");
  await page.getByRole("button", { name: "Proyecto", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nombre").fill("Tesis");
  await dialog.getByRole("button", { name: "Crear proyecto" }).click();
  await expect(dialog).toBeHidden();

  await page.getByRole("button", { name: "Nueva tarea" }).click();
  await dialog.getByLabel("Título").fill("Escribir introducción");
  await dialog.getByLabel("Proyecto").selectOption({ label: "Tesis" });
  await dialog.getByRole("button", { name: "Crear tarea" }).click();
  await expect(page.getByText("Escribir introducción")).toBeVisible();

  await page.goto("/focus");
  await page.getByLabel("Tarea", { exact: true }).selectOption({ label: "Escribir introducción" });
  await page.getByPlaceholder("Minutos").fill("50");
  await page.getByRole("button", { name: "Añadir" }).click();
  await expect(page.getByText("Registro manual").first()).toBeVisible();
});

test("tendencias: comparativas, calendario y récords", async () => {
  await page.goto("/stats/trends");
  await expect(page.getByRole("link", { name: "Tendencias" })).toHaveAttribute("aria-current", "page");
  await expect(page.getByText("Esta semana te concentraste 50 min.")).toBeVisible();
  await expect(page.getByRole("heading", { name: "Calendario de actividad" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Récords personales" })).toBeVisible();
  await expect(page.getByText("Mejor día de concentración").locator("..")).toContainText("50 min");
  await page.getByRole("tab", { name: "Tareas" }).click();
  await expect(page.getByRole("tab", { name: "Tareas" })).toHaveAttribute("aria-selected", "true");
  await snap(page, "p2-01-trends");
  // Tocar el día de hoy abre sus estadísticas.
  await page.getByRole("tab", { name: "Concentración" }).click();
  await page.getByRole("button", { name: /: 50 min concentración$/ }).click();
  await expect(page).toHaveURL(/\/stats\?range=custom&from=\d{4}-\d{2}-\d{2}&to=/);
  await expect(page.getByText("50 min").first()).toBeVisible();
});

test("horarios y patrones", async () => {
  await page.goto("/stats/patterns");
  await expect(page.getByRole("heading", { name: "Cuándo te concentras" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Concentración por día y hora" })).toBeVisible();
  await expect(page.getByText("1 sesión completada")).toBeVisible();
  await page.getByRole("link", { name: "12 meses" }).click();
  await expect(page).toHaveURL(/days=365/);
  await snap(page, "p2-02-patterns");
});

test("proyectos: tiempo, avance y edición", async () => {
  await page.goto("/stats/projects");
  await expect(page.getByRole("heading", { name: "Tesis" })).toBeVisible();
  await expect(page.getByText("0 de 1 tareas")).toBeVisible();
  await expect(page.getByText("100 % de tu concentración fue a proyectos")).toBeVisible();
  await snap(page, "p2-03-projects");

  // Editar y pausar el proyecto desde Tareas.
  await page.goto("/tasks?view=all");
  await page.getByLabel("Filtrar por proyecto").selectOption({ label: "Tesis" });
  await page.getByRole("button", { name: "Editar proyecto" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Estado del proyecto").selectOption("paused");
  await dialog.getByRole("button", { name: "Guardar" }).click();
  await expect(dialog).toBeHidden();
  await page.goto("/stats/projects");
  await expect(page.getByText("En pausa")).toBeVisible();
});

test("exportar CSV y calendario en el inicio", async () => {
  const res = await page.request.get("/stats/export");
  expect(res.status()).toBe(200);
  expect(res.headers()["content-type"]).toContain("text/csv");
  const csv = await res.text();
  expect(csv.split("\n")[0]).toBe("fecha,minutos_concentracion,sesiones,interrupciones,tareas_completadas,habitos_cumplidos");
  expect(csv).toMatch(/,50\.0,1,0,0,0\n/);

  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { name: "Tu constancia" })).toBeVisible();
  await snap(page, "p2-04-dashboard");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.goto("/stats/trends");
  await expect(page.getByRole("heading", { name: "Calendario de actividad" })).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(1);
  await snap(page, "p2-05-mobile-dark-trends");
});

test("progreso: nivel, XP, logros y desafío aceptado", async () => {
  await page.setViewportSize({ width: 1360, height: 900 });
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/progress");
  await expect(page.getByRole("heading", { name: "Progreso" })).toBeVisible();
  // 50 min manuales = 25 XP + 20 por día activo.
  await expect(page.getByText("45 XP en total")).toBeVisible();
  await expect(page.getByText("Primer paso").first()).toBeVisible();
  await expect(page.getByText(/Desbloqueado el/).first()).toBeVisible();
  await page.getByRole("button", { name: "Aceptar desafío" }).first().click();
  await expect(page.getByText(/quedan 7 días/)).toBeVisible();
  await snap(page, "p3-01-progress");
  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Nivel 1, Primer paso/ })).toBeVisible();
});
