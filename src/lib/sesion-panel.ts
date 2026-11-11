/**
 * Sesión del usuario del panel.
 *
 * Misma técnica que la cookie del cliente —HMAC y comparación en tiempo
 * constante— pero con una cookie distinta y con caducidad: el panel da acceso
 * a datos de terceros, así que una sesión no puede durar un año como la
 * tarjeta de sellos.
 */

import { createHmac, timingSafeEqual } from 'node:crypto';

export interface SesionPanel {
  usuarioId: string;
  localId: string;
  /** Marca de tiempo de creación, en milisegundos */
  creadaEn: number;
}

export const NOMBRE_COOKIE_PANEL = 'sp_panel';

/** Ocho horas: un turno de trabajo. */
export const DURACION_SESION_MS = 8 * 60 * 60 * 1000;

function secreto(): string {
  const valor = process.env.SECRETO_SESION;
  if (!valor || valor.length < 32) {
    throw new Error('Falta SECRETO_SESION en el .env, o es demasiado corto.');
  }
  return valor;
}

function firmar(cuerpo: string, clave: string): string {
  // El prefijo evita que un token del panel pueda pasar por uno de cliente,
  // aunque compartan el secreto.
  return createHmac('sha256', clave).update(`panel:${cuerpo}`).digest('base64url');
}

export function crearTokenPanel(sesion: SesionPanel, clave: string = secreto()): string {
  const cuerpo = Buffer.from(JSON.stringify(sesion), 'utf8').toString('base64url');
  return `${cuerpo}.${firmar(cuerpo, clave)}`;
}

/** Devuelve null si la firma no cuadra o si la sesión ya caducó. */
export function leerTokenPanel(
  token: string | undefined | null,
  clave: string = secreto(),
  ahora: number = Date.now(),
): SesionPanel | null {
  if (!token) return null;

  const partes = token.split('.');
  if (partes.length !== 2) return null;

  const [cuerpo, firmaRecibida] = partes;
  const recibida = Buffer.from(firmaRecibida);
  const esperada = Buffer.from(firmar(cuerpo, clave));

  if (recibida.length !== esperada.length) return null;
  if (!timingSafeEqual(recibida, esperada)) return null;

  try {
    const datos = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8')) as SesionPanel;

    if (
      typeof datos?.usuarioId !== 'string' ||
      typeof datos?.localId !== 'string' ||
      typeof datos?.creadaEn !== 'number'
    ) {
      return null;
    }

    if (ahora - datos.creadaEn > DURACION_SESION_MS) return null;
    // Una sesión con fecha futura es un token manipulado.
    if (datos.creadaEn > ahora + 60_000) return null;

    return datos;
  } catch {
    return null;
  }
}

export const OPCIONES_COOKIE_PANEL = {
  httpOnly: true,
  sameSite: 'lax',
  secure: process.env.NODE_ENV === 'production',
  path: '/',
  maxAge: DURACION_SESION_MS / 1000,
} as const;
