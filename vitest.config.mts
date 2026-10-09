import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    // Las pruebas de BD comparten una base de datos: se ejecutan en serie.
    fileParallelism: false,
    testTimeout: 20000,
    hookTimeout: 60000,
  },
});
