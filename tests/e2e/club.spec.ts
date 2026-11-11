import { expect, test } from '@playwright/test';

/**
 * Los recorridos del cliente, en un móvil simulado.
 *
 * Datos de la semilla que se usan acá:
 *  - local 'la-esquina', 10 sellos para una cena para dos
 *  - tag 'tag-esquina-caja'
 *
 * Cada prueba usa un teléfono distinto para no chocar con las demás: el
 * teléfono identifica al cliente dentro del local.
 */

const TAG = 'tag-esquina-caja';

/** Un teléfono distinto por prueba, para que no se pisen entre ellas. */
function telefonoUnico(): string {
  return `30099${Math.floor(Math.random() * 90000) + 10000}`;
}

test('recorrido completo: tap, alta y primer sello', async ({ page }) => {
  await page.goto(`/t/${TAG}`);

  // Cliente nuevo: se le registra la visita y se le pide unirse.
  await expect(page.getByRole('heading', { name: 'La Esquina' })).toBeVisible();
  await expect(page.getByText(/ya registramos tu visita/i)).toBeVisible();
  await expect(page.getByText(/cena para dos/i)).toBeVisible();

  await page.getByRole('link', { name: /unirme al club/i }).click();

  // El formulario pide lo mínimo: nombre, WhatsApp y cumpleaños.
  await expect(page.getByRole('heading', { name: /club de la esquina/i })).toBeVisible();
  await page.getByLabel('Tu nombre').fill('Cliente de Prueba');
  await page.getByLabel('Tu WhatsApp').fill(telefonoUnico());
  await page.getByLabel(/cumpleaños/i).fill('1990-05-20');

  // El botón no se puede usar hasta aceptar el tratamiento de datos.
  const boton = page.getByRole('button', { name: /unirme al club/i });
  await expect(boton).toBeDisabled();

  await page.getByRole('checkbox').check();
  await expect(boton).toBeEnabled();
  await boton.click();

  // Queda en su tarjeta, con el sello de esta visita ya sumado.
  await expect(page).toHaveURL(/\/c\/la-esquina\/tarjeta$/);
  await expect(page.getByText('1 de 10 sellos')).toBeVisible();
  await expect(page.getByText(/faltan 9/i)).toBeVisible();
});

test('la casilla del consentimiento no viene premarcada (RL-01)', async ({ page }) => {
  await page.goto('/c/la-esquina/alta');

  // Exigencia legal: el consentimiento tiene que ser un acto del titular.
  await expect(page.getByRole('checkbox')).not.toBeChecked();
  await expect(page.getByRole('button', { name: /unirme al club/i })).toBeDisabled();
});

test('el segundo tap del mismo día no suma otro sello', async ({ page }) => {
  // Alta primero.
  await page.goto(`/t/${TAG}`);
  await page.getByRole('link', { name: /unirme al club/i }).click();
  await page.getByLabel('Tu nombre').fill('Cliente Repetido');
  await page.getByLabel('Tu WhatsApp').fill(telefonoUnico());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /unirme al club/i }).click();
  await expect(page.getByText('1 de 10 sellos')).toBeVisible();

  // Vuelve a apoyar el celular: el mozo insistió, o no vio la confirmación.
  await page.goto(`/t/${TAG}`);
  await expect(page.getByText(/ya sumaste tu visita de hoy/i)).toBeVisible();
  await expect(page.getByText(/vuelve mañana/i)).toBeVisible();
  await expect(page.getByText('1 de 10 sellos')).toBeVisible();

  // Y recargar tampoco: la página del tap es idempotente, que es lo que la
  // hace segura siendo un GET.
  await page.reload();
  await expect(page.getByText('1 de 10 sellos')).toBeVisible();
});

test('la tarjeta se recuerda al volver, sin sumar nada', async ({ page }) => {
  await page.goto(`/t/${TAG}`);
  await page.getByRole('link', { name: /unirme al club/i }).click();
  await page.getByLabel('Tu nombre').fill('Cliente Que Vuelve');
  await page.getByLabel('Tu WhatsApp').fill(telefonoUnico());
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /unirme al club/i }).click();

  // Hay que esperar a que el alta termine: si se navega antes, se corre
  // contra la cookie antes de que el servidor la escriba.
  await expect(page).toHaveURL(/\/c\/la-esquina\/tarjeta$/);

  // Entrar directo a la tarjeta tres veces no cambia los sellos.
  for (let i = 0; i < 3; i += 1) {
    await page.goto('/c/la-esquina/tarjeta');
    await expect(page.getByText('1 de 10 sellos')).toBeVisible();
  }

  await expect(page.getByText(/hola, cliente que vuelve/i)).toBeVisible();
});

test('el formulario muestra los errores sin perder lo escrito', async ({ page }) => {
  await page.goto('/c/la-esquina/alta');

  await page.getByLabel('Tu nombre').fill('Nombre Correcto');
  await page.getByLabel('Tu WhatsApp').fill('123');
  await page.getByRole('checkbox').check();
  await page.getByRole('button', { name: /unirme al club/i }).click();

  await expect(page.getByText(/incompleto/i)).toBeVisible();
  // Lo que ya había escrito sigue ahí: nadie quiere teclear dos veces.
  await expect(page.getByLabel('Tu nombre')).toHaveValue('Nombre Correcto');
});

test('un cliente sin tarjeta en este celular recibe la invitación a unirse', async ({ page }) => {
  await page.goto('/c/la-esquina/tarjeta');

  await expect(page.getByText(/no reconocimos tu tarjeta/i)).toBeVisible();
  await expect(page.getByRole('link', { name: /unirme al club/i })).toBeVisible();
});

test('un tag inexistente da 404 y no revela nada', async ({ page }) => {
  const respuesta = await page.goto('/t/token-inventado');
  expect(respuesta?.status()).toBe(404);
});

test('la política nombra al local como responsable y a SelloPlus como encargado', async ({
  page,
}) => {
  await page.goto('/c/la-esquina/politica');

  // Es la consecuencia visible de la decisión RL-06.
  await expect(page.getByText(/La Esquina es el Responsable/i)).toBeVisible();
  await expect(page.getByText(/SelloPlus es solo el Encargado/i)).toBeVisible();

  // Las secciones que la Ley 1581 exige.
  for (const titulo of [
    /quién responde por tus datos/i,
    /qué datos guardamos/i,
    /para qué los usamos/i,
    /tus derechos/i,
    /cuánto tiempo los guardamos/i,
  ]) {
    await expect(page.getByRole('heading', { name: titulo })).toBeVisible();
  }

  // Y lo que hace que la autorización sea informada y voluntaria.
  await expect(page.getByText(/es voluntario/i)).toBeVisible();
  await expect(page.getByText(/eliminemos/i).first()).toBeVisible();
});

test('la política es alcanzable desde el formulario, antes de aceptar', async ({ page }) => {
  await page.goto('/c/la-esquina/alta');

  const enlace = page.getByRole('link', { name: /cómo tratamos tus datos/i });
  await expect(enlace).toBeVisible();
  await expect(enlace).toHaveAttribute('href', '/c/la-esquina/politica');
});
