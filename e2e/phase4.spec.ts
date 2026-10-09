import { expect, test, type Browser, type Page } from "@playwright/test";

const shots = process.env.E2E_SCREENSHOTS;
const snap = async (page: Page, name: string) => {
  if (shots) await page.screenshot({ path: `${shots}/${name}.png`, fullPage: true });
};

test.describe.configure({ mode: "serial" });

const stamp = Date.now().toString(36);
const password = "contraseña-segura-123";
let ana: Page;
let leo: Page;

async function signup(browser: Browser, name: string, viewport = { width: 1360, height: 900 }) {
  const page = await browser.newPage({ viewport });
  await page.goto("/signup");
  await page.getByLabel("Nombre").fill(name);
  await page.getByLabel("Email").fill(`e2e-p4-${name.toLowerCase()}-${stamp}@example.com`);
  await page.getByLabel("Contraseña").fill(password);
  await page.getByRole("button", { name: "Crear cuenta" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  return page;
}

async function setupSocial(page: Page, username: string, share: boolean) {
  await page.goto("/social");
  await page.getByLabel("Tu nombre de usuario").fill(username);
  const box = page.getByRole("checkbox", { name: /Compartir mis estadísticas/ });
  if (share) await box.check();
  else await box.uncheck();
  await page.getByRole("button", { name: "Guardar", exact: true }).click();
  await expect(page.getByText("Guardado")).toBeVisible();
}

async function logFocus(page: Page, minutes: string) {
  await page.goto("/focus");
  await page.getByPlaceholder("Minutos").fill(minutes);
  await page.getByRole("button", { name: "Añadir" }).click();
  await expect(page.getByText("Registro manual").first()).toBeVisible();
}

test.beforeAll(async ({ browser }) => {
  ana = await signup(browser, "Ana");
  leo = await signup(browser, "Leo", { width: 390, height: 844 });
});

test("amistad: usuario, solicitud, aceptación y privacidad recíproca", async () => {
  await setupSocial(ana, `ana_${stamp}`, true);
  await setupSocial(leo, `leo_${stamp}`, false);
  await logFocus(ana, "40");
  await logFocus(leo, "25");

  await ana.goto("/social");
  await ana.getByLabel("Usuario de tu amigo").fill(`@nadie_${stamp}`);
  await ana.getByRole("button", { name: "Añadir" }).click();
  await expect(ana.getByText(`No existe nadie con el usuario @nadie_${stamp}.`)).toBeVisible();
  await ana.getByLabel("Usuario de tu amigo").fill(`leo_${stamp}`);
  await ana.getByRole("button", { name: "Añadir" }).click();
  await expect(ana.getByText("Solicitud enviada.")).toBeVisible();
  await expect(ana.getByRole("heading", { name: "Esperando respuesta" })).toBeVisible();

  await leo.goto("/social");
  await expect(leo.getByRole("heading", { name: "Solicitudes recibidas" })).toBeVisible();
  await leo.getByRole("button", { name: "Aceptar" }).click();
  await expect(leo.getByRole("heading", { name: "Tus amigos" })).toBeVisible();
  // Leo no comparte: no ve la comparación y Ana no ve sus datos.
  await expect(leo.getByText(/Activa Compartir mis estadísticas para ver la comparación/)).toBeVisible();
  await ana.reload();
  await expect(ana.getByText("Leo no comparte sus estadísticas.")).toBeVisible();
  const anaList = ana.getByRole("list", { name: "Comparación" });
  await expect(anaList.getByRole("listitem")).toHaveCount(1);
  await expect(anaList).toContainText("Tú");

  // Leo empieza a compartir: ahora se ven los dos.
  await setupSocial(leo, `leo_${stamp}`, true);
  await ana.reload();
  await expect(anaList.getByRole("listitem")).toHaveCount(2);
  await expect(anaList).toContainText("Leo");
  await expect(anaList).toContainText("40 min");
  await expect(anaList).toContainText("25 min");
  await ana.getByRole("navigation", { name: "Ordenar por" }).getByRole("link", { name: "Concentración" }).click();
  await expect(ana).toHaveURL(/by=focus/);
  await expect(anaList.getByRole("listitem").first()).toContainText("Tú");
  await expect(anaList.getByRole("listitem").first()).toContainText("1.º");
  await snap(ana, "p4-01-social");
  await leo.reload();
  await snap(leo, "p4-02-social-mobile");
  const overflow = await leo.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});

test("grupo: crear, invitar por enlace, comparar y desafío compartido", async () => {
  await ana.goto("/social");
  await ana.getByLabel("Nombre del grupo").fill("Club de estudio");
  await ana.getByRole("button", { name: "Crear", exact: true }).click();
  await expect(ana).toHaveURL(/\/social\/groups\/[0-9a-f-]+$/);
  await expect(ana.getByRole("heading", { name: "Club de estudio" })).toBeVisible();
  const code = (await ana.getByTestId("invite-code").textContent())!.trim();

  await ana.getByLabel("Meta por persona (min)").fill("30");
  await ana.getByRole("button", { name: "Crear desafío" }).click();
  await expect(ana.getByText("30 min en 7 días")).toBeVisible();
  await expect(ana.getByText("1 de 1 ya alcanzaron la meta.").or(ana.getByText("¡Meta alcanzada!"))).toBeVisible();

  await leo.goto(`/social/join/${code}`);
  await leo.getByRole("button", { name: "Unirme" }).click();
  await expect(leo).toHaveURL(/\/social\/groups\//);
  await expect(leo.getByRole("heading", { name: "Club de estudio" })).toBeVisible();
  await expect(leo.getByText("Miembros (2)")).toBeVisible();
  await expect(leo.getByText("1 de 2 ya alcanzaron la meta.")).toBeVisible();
  await expect(leo.getByText("25 / 30 min")).toBeVisible();
  await snap(leo, "p4-03-group-mobile");

  await ana.reload();
  await expect(ana.getByRole("list", { name: "Comparación" }).getByRole("listitem")).toHaveCount(2);
  await snap(ana, "p4-04-group");

  // Leo sale del grupo; Ana elimina el grupo.
  ana.on("dialog", (d) => d.accept());
  leo.on("dialog", (d) => d.accept());
  await leo.getByRole("button", { name: "Salir del grupo" }).click();
  await expect(leo).toHaveURL(/\/social$/);
  await ana.reload();
  await expect(ana.getByText("Miembros (1)")).toBeVisible();
  await ana.getByRole("button", { name: "Eliminar grupo" }).click();
  await expect(ana).toHaveURL(/\/social$/);
  await expect(ana.getByText("Club de estudio")).toHaveCount(0);
});
