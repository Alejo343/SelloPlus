import { defineConfig, devices } from '@playwright/test';

/**
 * Pruebas de punta a punta.
 *
 * Se corren en un móvil simulado a propósito: el 100% de los clientes finales
 * entra desde el teléfono (RNF-02), así que probar en escritorio daría una
 * confianza falsa.
 */
const PUERTO = 3011;

export default defineConfig({
  testDir: './tests/e2e',
  // Siembra la base antes de correr, para arrancar siempre del mismo estado.
  globalSetup: './tests/e2e/preparar.ts',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: `http://127.0.0.1:${PUERTO}`,
    // Grabar la traza de cada prueba consume mucha CPU. Se activa a mano
    // cuando hay que depurar una falla: npm run test:e2e -- --trace on
    trace: 'off',
    launchOptions: {
      /**
       * El VPS ya tiene un Chromium de Playwright descargado. Apuntarlo evita
       * bajar otro navegador de ~150 MB cada vez que Playwright se actualiza.
       * Si algún día no está, se sobreescribe con la variable CHROMIUM_PATH.
       */
      executablePath:
        process.env.CHROMIUM_PATH ??
        `${process.env.HOME}/.cache/ms-playwright/chromium-1148/chrome-linux/chrome`,
    },
  },
  projects: [
    {
      name: 'movil',
      use: { ...devices['Pixel 7'] },
    },
  ],
  webServer: {
    command: `npx next dev --port ${PUERTO}`,
    url: `http://127.0.0.1:${PUERTO}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
