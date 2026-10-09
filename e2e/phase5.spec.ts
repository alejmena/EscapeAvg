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
  await page.getByLabel("Nombre").fill("Pau");
  await page.getByLabel("Email").fill(`e2e-p5-${Date.now()}@example.com`);
  await page.getByLabel("Contraseña").fill("contraseña-segura-123");
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
});

async function newTask(title: string, opts: { due?: string; priority?: string; estimate?: string } = {}) {
  await page.goto("/tasks?view=all");
  await page.getByRole("button", { name: "Nueva tarea" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Título").fill(title);
  if (opts.due) await dialog.getByLabel("Fecha límite").fill(opts.due);
  if (opts.priority) await dialog.getByLabel("Prioridad").selectOption({ label: opts.priority });
  if (opts.estimate) await dialog.getByLabel("Tiempo estimado (min)").fill(opts.estimate);
  await dialog.getByRole("button", { name: "Crear tarea" }).click();
  await expect(dialog).toBeHidden();
}

test("plan del día: prioriza lo que vence, explica por qué y respeta tu ritmo", async () => {
  const today = await page.evaluate(() => new Date().toLocaleDateString("en-CA"));
  await newTask("Ordenar escritorio", { estimate: "20" });
  await newTask("Entregar informe", { due: today, priority: "Alta", estimate: "45" });

  await page.goto("/plan");
  const plan = page.getByRole("list", { name: "Plan de hoy" });
  await expect(plan.getByRole("listitem").first()).toContainText("Empieza aquí");
  await expect(plan.getByRole("listitem").first()).toContainText("Entregar informe");
  await expect(plan.getByRole("listitem").first()).toContainText("Vence hoy");
  await expect(plan.getByRole("listitem").first()).toContainText("Prioridad alta");
  await expect(page.getByTestId("plan-headline")).toContainText("te propongo 1 tarea");
  await expect(page.getByText("(estimación inicial)")).toBeVisible();
  // 45 min de plan sobre 1 h de ritmo inicial.
  await expect(page.getByRole("progressbar", { name: "Plan del día frente a tu ritmo habitual" })).toHaveAttribute("aria-valuenow", "75");
  // Resumen de la semana pasada para una cuenta nueva: sin culpa.
  await expect(page.getByTestId("review-headline")).toHaveText("Semana en pausa: no registraste actividad.");

  // Completar desde el plan.
  await plan.getByRole("checkbox").first().click();
  // El plan se recalcula solo al completar la tarea.
  await expect(plan).not.toContainText("Entregar informe");
  await expect(plan).toContainText("Ordenar escritorio");

  await page.getByRole("link", { name: "Esta semana" }).click();
  await expect(page).toHaveURL(/week=current/);
  await expect(page.getByTestId("review-headline")).toContainText("1 día activo");
  await snap(page, "p5-01-plan");
  await page.setViewportSize({ width: 390, height: 844 });
  await page.emulateMedia({ colorScheme: "dark" });
  await page.reload();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(0);
  await snap(page, "p5-02-plan-mobile");
  await page.setViewportSize({ width: 1360, height: 900 });

  await page.goto("/dashboard");
  await expect(page.getByRole("link", { name: /Tu plan de hoy/ })).toContainText('Empieza por "Ordenar escritorio"');
});
