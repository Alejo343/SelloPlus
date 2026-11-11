/**
 * Identificación del cliente entre visitas (RF-13).
 *
 * El cliente no instala nada ni tiene usuario y contraseña, así que lo
 * reconocemos por una cookie firmada. El contenido no es secreto —es un id de
 * cliente— pero sí tiene que ser **infalsificable**: sin la firma, cualquiera
 * podría editar la cookie, poner el id de otro cliente y mirar o gastar sus
 * sellos.
 *
 * El respaldo cuando la cookie no está (celular nuevo, cookies borradas, modo
 * incógnito) es el teléfono: el cliente rellena el formulario otra vez y
 * `altaCliente` lo reconoce y devuelve el mismo registro.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

/** El local va en el token para no tener que confiar en la URL al leerlo. */
export interface SesionCliente {
  clienteId: string;
  localId: string;
}

const SEPARADOR = '.';

function secretoPorDefecto(): string {
  const secreto = process.env.SECRETO_SESION;
  if (!secreto || secreto.length < 32) {
    throw new Error(
      'Falta SECRETO_SESION en el .env, o es demasiado corto (mínimo 32 caracteres).',
    );
  }
  return secreto;
}

function firmar(cuerpo: string, secreto: string): string {
  return createHmac('sha256', secreto).update(cuerpo).digest('base64url');
}

/** Crea el token que va en la cookie. */
export function crearToken(sesion: SesionCliente, secreto: string = secretoPorDefecto()): string {
  const cuerpo = Buffer.from(JSON.stringify(sesion), 'utf8').toString('base64url');
  return `${cuerpo}${SEPARADOR}${firmar(cuerpo, secreto)}`;
}

/**
 * Lee el token. Devuelve null ante cualquier problema —formato raro, firma
 * inválida, JSON corrupto— sin distinguir el motivo: a quien intenta
 * falsificarlo no se le explica en qué falló.
 */
export function leerToken(
  token: string | undefined | null,
  secreto: string = secretoPorDefecto(),
): SesionCliente | null {
  if (!token) return null;

  const partes = token.split(SEPARADOR);
  if (partes.length !== 2) return null;

  const [cuerpo, firmaRecibida] = partes;
  const firmaEsperada = firmar(cuerpo, secreto);

  // Comparación de tiempo constante: comparar con === filtra información
  // sobre cuántos caracteres de la firma son correctos.
  const recibida = Buffer.from(firmaRecibida);
  const esperada = Buffer.from(firmaEsperada);
  if (recibida.length !== esperada.length) return null;
  if (!timingSafeEqual(recibida, esperada)) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as unknown;

    if (
      typeof datos !== 'object' ||
      datos === null ||
      typeof (datos as SesionCliente).clienteId !== 'string' ||
      typeof (datos as SesionCliente).localId !== 'string'
    ) {
      return null;
    }

    return { clienteId: (datos as SesionCliente).clienteId, localId: (datos as SesionCliente).localId };
  } catch {
    return null;
  }
}

/** Nombre de la cookie. Una por local: un cliente puede estar en varios clubes. */
export function nombreCookie(localSlug: string): string {
  return `sp_${localSlug}`;
}

/** Opciones de la cookie. Un año: el club es de largo plazo. */
export const OPCIONES_COOKIE = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: 60 * 60 * 24 * 365,
} as const;
