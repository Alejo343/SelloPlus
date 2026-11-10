import { expect, test } from '@playwright/test';

/**
 * Prueba de humo de la Fase 0: confirma que el servidor arranca y responde.
 * Los recorridos reales (alta, sello, tarjeta) llegan en la Fase 2.
 */
test('el servidor responde', async ({ page }) => {
  const respuesta = await page.goto('/');
  expect(respuesta?.status()).toBe(200);
});
