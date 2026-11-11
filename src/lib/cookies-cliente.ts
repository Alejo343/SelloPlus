/**
 * Lectura y escritura de la cookie que reconoce al cliente entre visitas.
 *
 * Separado de `sesion-cliente.ts` a propósito: ahí vive la criptografía, que
 * es pura y se prueba sin servidor; acá vive el acoplamiento con Next, que
 * necesita `await cookies()`.
 */

import { cookies } from 'next/headers';

import {
  crearToken,
  leerToken,
  nombreCookie,
  OPCIONES_COOKIE,
  type SesionCliente,
} from './sesion-cliente';

/**
 * Quién es el cliente que está mirando, para este local.
 *
 * Devuelve null si no hay cookie, si la firma no es válida, o si la cookie
 * pertenece a otro local: nunca se confía en el contenido sin comprobar que
 * el local coincide con el de la URL.
 */
export async function clienteDeLaCookie(
  localSlug: string,
  localId: string,
): Promise<string | null> {
  const almacen = await cookies();
  const sesion = leerToken(almacen.get(nombreCookie(localSlug))?.value);

  if (!sesion) return null;
  if (sesion.localId !== localId) return null;

  return sesion.clienteId;
}

/** Deja al cliente reconocido para sus próximas visitas. */
export async function recordarCliente(localSlug: string, sesion: SesionCliente): Promise<void> {
  const almacen = await cookies();
  almacen.set(nombreCookie(localSlug), crearToken(sesion), OPCIONES_COOKIE);
}

export async function olvidarCliente(localSlug: string): Promise<void> {
  const almacen = await cookies();
  almacen.delete(nombreCookie(localSlug));
}
