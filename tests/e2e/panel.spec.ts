import 'dotenv/config';

import { eq } from 'drizzle-orm';
import { expect, test } from '@playwright/test';

import { crearConexion } from '../../src/db';
import { clientes, locales } from '../../src/db/schema';

/**
 * El panel del local, en móvil simulado.
 *
 * Credenciales de la semilla:
 *   dueno@laesquina.test  / selloplus2026   (local 'la-esquina')
 *   dueno@cafevecino.test / selloplus2026   (local 'cafe-vecino')
 *
 * Clientes de la semilla que se usan:
 *   Lucía Nueva  — sin sellos, sirve para probar el sello manual
 *   Marta Fiel   — 8 de 10 sellos, con uno de hoy
 */

const CLAVE = 'selloplus2026';

async function entrarAlPanel(
  page: import('@playwright/test').Page,
  email = 'dueno@laesquina.test',
) {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill(email);
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page).toHaveURL(/\/panel$/);
}

/**
 * Cuántos clientes tiene un local ahora mismo.
 *
 * Se consulta en vez de usar un número fijo porque las pruebas del cliente
 * (club.spec.ts) dan de alta clientes nuevos en el mismo local antes de que
 * corran estas. Un número escrito a mano haría fallar esta prueba por un
 * motivo que no tiene nada que ver con lo que quiere comprobar.
 */
async function contarClientes(slugLocal: string): Promise<number> {
  const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
  try {
    const [local] = await db.select().from(locales).where(eq(locales.slug, slugLocal));
    const filas = await db.select().from(clientes).where(eq(clientes.localId, local.id));
    return filas.length;
  } finally {
    await sql.end();
  }
}

/** Busca en la base el id de un cliente por nombre, para armar URLs ajenas. */
async function idDeCliente(slugLocal: string, nombre: string): Promise<string> {
  const { cliente: sql, db } = crearConexion(process.env.DATABASE_URL, 1);
  try {
    const [local] = await db.select().from(locales).where(eq(locales.slug, slugLocal));
    const filas = await db.select().from(clientes).where(eq(clientes.localId, local.id));
    const encontrado = filas.find((c) => c.nombre === nombre);
    if (!encontrado) throw new Error(`No existe el cliente "${nombre}" en ${slugLocal}`);
    return encontrado.id;
  } finally {
    await sql.end();
  }
}

test('sin sesión, el panel manda al login', async ({ page }) => {
  for (const ruta of ['/panel', '/panel/clientes', '/panel/programa', '/panel/qr']) {
    await page.goto(ruta);
    await expect(page).toHaveURL(/\/panel\/entrar$/);
  }
});

test('rechaza credenciales incorrectas sin decir cuál falló', async ({ page }) => {
  await page.goto('/panel/entrar');
  await page.getByLabel('Correo').fill('dueno@laesquina.test');
  await page.getByLabel('Contraseña').fill('equivocada');
  await page.getByRole('button', { name: /entrar/i }).click();

  const mensaje = page.getByText(/correo o contraseña incorrectos/i);
  await expect(mensaje).toBeVisible();

  // Un correo inexistente da el mismo mensaje: distinguirlos permitiría
  // averiguar qué locales están registrados.
  await page.getByLabel('Correo').fill('no-existe@ninguna-parte.test');
  await page.getByLabel('Contraseña').fill(CLAVE);
  await page.getByRole('button', { name: /entrar/i }).click();
  await expect(page.getByText(/correo o contraseña incorrectos/i)).toBeVisible();
});

test('el dueño entra y ve sus métricas', async ({ page }) => {
  await entrarAlPanel(page);

  await expect(page.getByRole('heading', { name: 'La Esquina' })).toBeVisible();
  await expect(page.getByText(/retorno de clientes/i)).toBeVisible();

  const esperados = await contarClientes('la-esquina');
  await expect(page.getByText(`Clientes en el club: ${esperados}`)).toBeVisible();
  await expect(page.getByText(/cumpleaños en los próximos/i)).toBeVisible();
  // Carlos Cumple cumple en 3 días según la semilla.
  await expect(page.getByRole('link', { name: 'Carlos Cumple' })).toBeVisible();
});

test('lista y busca clientes', async ({ page }) => {
  await entrarAlPanel(page);
  await page.getByRole('link', { name: /mis clientes/i }).click();

  await expect(page.getByRole('link', { name: 'Marta Fiel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lucía Nueva' })).toBeVisible();

  // Los clientes del otro local nunca aparecen.
  await expect(page.getByRole('link', { name: 'Sofía Vecina' })).toHaveCount(0);

  await page.getByLabel(/buscar/i).fill('marta');
  await page.getByRole('button', { name: /buscar/i }).click();

  await expect(page.getByRole('link', { name: 'Marta Fiel' })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Lucía Nueva' })).toHaveCount(0);
});

test('suma un sello a mano, y la regla de un sello por día también aplica', async ({ page }) => {
  await entrarAlPanel(page);

  const id = await idDeCliente('la-esquina', 'Lucía Nueva');
  await page.goto(`/panel/clientes/${id}`);

  await expect(page.getByRole('heading', { name: 'Lucía Nueva' })).toBeVisible();
  await expect(page.getByText(/sellos: 0 de 10/i)).toBeVisible();

  await page.getByRole('button', { name: /sumar un sello/i }).click();
  await expect(page.getByText(/sellos: 1 de 10/i)).toBeVisible();

  // El cajero insiste: no se suma otro, porque ya sumó hoy.
  await page.getByRole('button', { name: /sumar un sello/i }).click();
  await expect(page.getByText(/sellos: 1 de 10/i)).toBeVisible();
});

test('da de baja a un cliente de los mensajes, sin perder sus sellos', async ({ page }) => {
  await entrarAlPanel(page);

  const id = await idDeCliente('la-esquina', 'Marta Fiel');
  await page.goto(`/panel/clientes/${id}`);

  await expect(page.getByText(/sellos: 8 de 10/i)).toBeVisible();

  await page.getByRole('button', { name: /no enviarle más mensajes/i }).click();

  await expect(page.getByText(/pidió no recibir más mensajes/i)).toBeVisible();
  // Sus sellos siguen intactos: la baja es de los mensajes, no del club.
  await expect(page.getByText(/sellos: 8 de 10/i)).toBeVisible();
});

test('un dueño no puede abrir el cliente de otro local (RNF-05)', async ({ page }) => {
  // El ataque directo: pegar en la URL el id de un cliente ajeno.
  await entrarAlPanel(page, 'dueno@laesquina.test');

  const ajeno = await idDeCliente('cafe-vecino', 'Sofía Vecina');
  const respuesta = await page.goto(`/panel/clientes/${ajeno}`);

  expect(respuesta?.status()).toBe(404);
  await expect(page.getByText('Sofía Vecina')).toHaveCount(0);
});

test('cada dueño ve su propio local', async ({ page }) => {
  await entrarAlPanel(page, 'dueno@cafevecino.test');

  await expect(page.getByRole('heading', { name: 'Café Vecino' })).toBeVisible();

  // Lo que importa no es el número, sino que sea EL SUYO y no el del vecino.
  const suyos = await contarClientes('cafe-vecino');
  const delOtro = await contarClientes('la-esquina');
  expect(suyos).toBeLessThan(delOtro);
  await expect(page.getByText(`Clientes en el club: ${suyos}`)).toBeVisible();
});

test('guarda la configuración del club', async ({ page }) => {
  await entrarAlPanel(page);
  await page.goto('/panel/programa');

  await page.getByLabel('Sellos para el premio').fill('8');
  await page.getByLabel('Qué se gana').fill('Un postre de la casa');
  await page.getByRole('button', { name: /guardar cambios/i }).click();

  await expect(page.getByText(/cambios guardados/i)).toBeVisible();
  await expect(page.getByLabel('Sellos para el premio')).toHaveValue('8');

  // El cambio se ve donde importa: en la tarjeta del cliente.
  await page.goto('/c/la-esquina/alta');
  await expect(page.getByText(/al llegar a 8/i)).toBeVisible();
  await expect(page.getByText(/postre de la casa/i)).toBeVisible();
});

test('rechaza una configuración inválida', async ({ page }) => {
  await entrarAlPanel(page);
  await page.goto('/panel/programa');

  // 80 sellos desmotiva a cualquiera: el límite es 50.
  await page.getByLabel('Sellos para el premio').fill('80');
  await page.getByLabel('Qué se gana').fill('Algo');
  // El navegador bloquea el envío por el max del campo, así que se fuerza.
  await page.getByLabel('Sellos para el premio').evaluate((el) => {
    (el as HTMLInputElement).removeAttribute('max');
  });
  await page.getByRole('button', { name: /guardar cambios/i }).click();

  await expect(page.getByText(/50 sellos/i)).toBeVisible();
});

test('genera los códigos QR del local', async ({ page }) => {
  await entrarAlPanel(page);
  await page.goto('/panel/qr');

  // Un QR por tag activo: la semilla tiene dos en La Esquina. Se acota a las
  // hojas del QR porque el servidor de desarrollo inyecta su propio SVG.
  await expect(page.locator('.hoja-qr')).toHaveCount(2);
  await expect(page.locator('.hoja-qr svg')).toHaveCount(2);
  await expect(page.getByText(/media luna de la caja/i)).toBeVisible();
  await expect(page.getByText(/mesa 4/i)).toBeVisible();
});

test('salir cierra la sesión', async ({ page }) => {
  await entrarAlPanel(page);

  await page.getByRole('button', { name: /salir/i }).click();
  await expect(page).toHaveURL(/\/panel\/entrar$/);

  // Y ya no se puede volver atrás a los datos.
  await page.goto('/panel/clientes');
  await expect(page).toHaveURL(/\/panel\/entrar$/);
});
