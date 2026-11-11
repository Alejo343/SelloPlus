/**
 * Acoplamiento de la sesión del panel con Next. La criptografía está en
 * `sesion-panel.ts`, que es puro y se prueba sin servidor.
 */

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';

import {
  crearTokenPanel,
  leerTokenPanel,
  NOMBRE_COOKIE_PANEL,
  OPCIONES_COOKIE_PANEL,
  type SesionPanel,
} from './sesion-panel';

export async function sesionActual(): Promise<SesionPanel | null> {
  const almacen = await cookies();
  return leerTokenPanel(almacen.get(NOMBRE_COOKIE_PANEL)?.value);
}

/**
 * La sesión, o redirección al login.
 *
 * Toda página del panel empieza llamando a esto. Es la única puerta: si una
 * página nueva se olvida de llamarla, no lee datos, porque los servicios
 * exigen el localId que solo sale de acá.
 */
export async function exigirSesion(): Promise<SesionPanel> {
  const sesion = await sesionActual();
  if (!sesion) redirect('/panel/entrar');
  return sesion;
}

export async function iniciarSesion(usuarioId: string, localId: string): Promise<void> {
  const almacen = await cookies();
  almacen.set(
    NOMBRE_COOKIE_PANEL,
    crearTokenPanel({ usuarioId, localId, creadaEn: Date.now() }),
    OPCIONES_COOKIE_PANEL,
  );
}

export async function cerrarSesion(): Promise<void> {
  const almacen = await cookies();
  almacen.delete(NOMBRE_COOKIE_PANEL);
}
