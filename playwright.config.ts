import { defineConfig, devices } from "@playwright/test";

/**
 * Pruebas de punta a punta. Requieren la app corriendo contra un Supabase real (local o remoto):
 *   E2E_BASE_URL=http://localhost:3000 npm run test:e2e
 * Opcional: PW_CHROMIUM_PATH para usar un Chromium ya instalado.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  fullyParallel: false,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : undefined,
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1360, height: 900 } } },
  ],
});
