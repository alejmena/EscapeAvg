import { expect, test, type Page } from "@playwright/test";

const shots = process.env.E2E_SCREENSHOTS;
const snap = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

test.describe.configure({ mode: "serial" });

let page: Page;

test.beforeAll(async ({ browser }) => {
  page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  await page.goto("/signup");
  await page.getByLabel("Nombre").fill("Sofía");
  await page.getByLabel("Email").fill(`e2e-dis-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("contraseña-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

test("panel de nivel: empieza en Inicio con objetivo Élite y aviso de rangos simbólicos", async () => {
  const panel = page.getByTestId("today-panel");
  await expect(panel).toContainText("Tu nivel de hoy");
  await expect(panel).toContainText("Inicio");
  await expect(page.getByTestId("goal-label")).toHaveText("Élite — Top 1%");
  await expect(page.getByTestId("day-message")).toContainText("Hoy tienes una nueva oportunidad de superar tu promedio.");
  await expect(panel).toContainText("no estadísticas verificadas");
  await expect(page.getByTestId("quote-card")).toBeVisible();
});

test("objetivo personalizado desde ajustes", async () => {
  await page.goto("/settings");
  await page.getByTestId("goal-picker").getByRole("button", { name: /^Constancia/ }).click();
  await expect(page.getByTestId("goal-picker")).toContainText("Guardado");
  await expect(page.getByTestId("goal-picker")).toContainText("Objetivo actual: Constancia");
});

test("actividades con horario, categoría y calidad; sin horas duplicadas", async () => {
  const yesterday = await page.evaluate(() => {
    const d = new Date(Date.now() - 86400000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  });
  await page.goto("/focus");
  const card = page.locator("#registro");
  await card.getByRole("tab", { name: "Con horario" }).click();
  const form = page.getByTestId("manual-range");

  const log = async (title: string, start: string, end: string, quality?: string) => {
    await form.getByLabel("Actividad", { exact: true }).fill(title);
    await form.getByLabel("Categoría").selectOption({ label: "Idiomas" });
    await form.getByLabel("Día").fill(yesterday);
    await form.getByLabel("Inicio").fill(start);
    await form.getByLabel("Final").fill(end);
    if (quality) await form.getByRole("radio", { name: quality }).click();
    await form.getByRole("button", { name: "Registrar actividad" }).click();
  };

  await log("Inglés: unidad 4", "08:00", "13:00", "Profunda");
  await expect(card.getByText("Actividad registrada.")).toBeVisible();

  // Se solapa con la anterior: no se guarda.
  await log("Repaso", "12:00", "14:00");
  await expect(card.getByRole("alert")).toContainText("se solapa con otra actividad");

  // "Solo ocupado": se guarda pero no suma horas de desarrollo.
  await log("Correo y recados", "15:00", "16:00", "Solo ocupado");
  await expect(card.getByText("Actividad registrada.")).toBeVisible();

  await page.goto("/dashboard");
  await expect(page.getByTestId("yesterday")).toContainText("Alcanzaste Constancia. Completaste 5 horas productivas.");
  await expect(page.getByTestId("week-goal")).toContainText("alcanzaste tu objetivo");
  await snap(page, "d-01-dashboard");
});

test("desarrollo acumulado por categoría", async () => {
  await page.goto("/stats/development");
  const dev = page.getByTestId("development");
  await expect(dev).toContainText("Tu desarrollo en los últimos 30 días");
  await expect(dev).toContainText("Idiomas");
  await expect(dev).toContainText("5 h");
  await page.getByRole("link", { name: "Meses" }).click();
  await expect(page.getByRole("heading", { name: "Últimos 12 meses" })).toBeVisible();
  await expect(page.getByTestId("mastery")).toContainText("Idiomas");
  await snap(page, "d-02-development");
});

test("frases: favoritas guardadas en tu cuenta", async () => {
  await page.goto("/philosophy");
  await expect(page.getByRole("heading", { name: /Escapar del/ })).toBeVisible();
  await expect(page.locator("#rangos")).toContainText("Excepcional — Top 0.00001%");
  await page.goto("/philosophy?f=rusia#frases");
  const first = page.getByTestId("quote-card").nth(1);
  await first.getByRole("button", { name: "Guardar como favorita" }).click();
  await expect(first.getByRole("button", { name: "Quitar de favoritas" })).toBeVisible();
  await page.goto("/philosophy?f=fav#frases");
  await expect(page.getByRole("link", { name: "Favoritas (1)" })).toBeVisible();
  await snap(page, "d-03-philosophy");
});
