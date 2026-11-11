/**
 * Hash de contraseñas para los usuarios del panel.
 *
 * Se usa **scrypt**, que viene en Node, en vez de bcrypt o argon2: esos son
 * dependencias nativas que hay que recompilar en cada actualización de Node y
 * suelen ser el motivo por el que un despliegue falla meses después. scrypt es
 * una función de derivación lenta y con coste de memoria, aceptada para este
 * uso, y no añade ninguna dependencia.
 *
 * Nunca se guarda la contraseña, solo el hash, y la comparación es en tiempo
 * constante.
 */

import { randomBytes, scrypt, timingSafeEqual, type ScryptOptions } from 'node:crypto';

/**
 * Envoltorio propio en vez de `promisify`: promisify resuelve la sobrecarga de
 * scrypt sin opciones, y acá hacen falta los parámetros de coste.
 */
function derivar(
  contrasena: string,
  sal: Buffer,
  largo: number,
  opciones: ScryptOptions,
): Promise<Buffer> {
  return new Promise((resolver, rechazar) => {
    scrypt(contrasena, sal, largo, opciones, (error, clave) => {
      if (error) rechazar(error);
      else resolver(clave);
    });
  });
}

/** Parámetros del hash. Se guardan dentro del propio hash para poder subirlos
 * más adelante sin invalidar las contraseñas existentes. */
const COSTE = 16384; // N
const BLOQUE = 8; // r
const PARALELISMO = 1; // p
const LARGO_CLAVE = 64;
const LARGO_SAL = 16;

export const LARGO_MINIMO_CONTRASENA = 8;

/** Formato: scrypt$N$r$p$sal$hash, todo en base64url. */
export async function hashearContrasena(contrasena: string): Promise<string> {
  if (contrasena.length < LARGO_MINIMO_CONTRASENA) {
    throw new Error(
      `La contraseña debe tener al menos ${LARGO_MINIMO_CONTRASENA} caracteres`,
    );
  }

  const sal = randomBytes(LARGO_SAL);
  const clave = await derivar(contrasena.normalize('NFKC'), sal, LARGO_CLAVE, {
    N: COSTE,
    r: BLOQUE,
    p: PARALELISMO,
  });

  return [
    'scrypt',
    COSTE,
    BLOQUE,
    PARALELISMO,
    sal.toString('base64url'),
    clave.toString('base64url'),
  ].join('$');
}

/**
 * Comprueba una contraseña contra su hash.
 *
 * Devuelve false ante cualquier problema (hash corrupto, formato desconocido)
 * en vez de lanzar: un registro con el hash mal guardado no debe tumbar el
 * login de todos los demás.
 */
export async function verificarContrasena(contrasena: string, hash: string): Promise<boolean> {
  try {
    const partes = hash.split('$');
    if (partes.length !== 6) return false;

    const [algoritmo, n, r, p, salBase64, claveBase64] = partes;
    if (algoritmo !== 'scrypt') return false;

    const sal = Buffer.from(salBase64, 'base64url');
    const esperada = Buffer.from(claveBase64, 'base64url');

    const calculada = await derivar(contrasena.normalize('NFKC'), sal, esperada.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
    });

    if (calculada.length !== esperada.length) return false;
    return timingSafeEqual(calculada, esperada);
  } catch {
    return false;
  }
}
