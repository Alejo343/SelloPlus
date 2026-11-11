/**
 * Firma de JWT con la clave de la cuenta de servicio de Google (RS256).
 *
 * Se implementa a mano con `node:crypto` en vez de añadir una librería de JWT:
 * son unas veinte líneas, el formato está fijado por el estándar, y así no hay
 * una dependencia más que mantener en el camino crítico de la autenticación.
 *
 * Se usa para dos cosas distintas:
 *  1. Firmar el enlace "Añadir a Google Wallet" (lo consume el navegador).
 *  2. Pedir un token de acceso OAuth2 para llamar a la API REST.
 */

import { createSign } from 'node:crypto';

function base64url(valor: string | Buffer): string {
  return Buffer.from(valor).toString('base64url');
}

/**
 * Firma un payload con RS256.
 *
 * `clavePrivada` es el campo `private_key` del JSON de la cuenta de servicio,
 * en formato PEM. Si viene de una variable de entorno, los saltos de línea
 * suelen llegar como `\n` literales, así que se normalizan.
 */
export function firmarRs256(payload: object, clavePrivada: string): string {
  const cabecera = { alg: 'RS256', typ: 'JWT' };

  const cuerpo = [
    base64url(JSON.stringify(cabecera)),
    base64url(JSON.stringify(payload)),
  ].join('.');

  const pem = normalizarClavePem(clavePrivada);

  const firma = createSign('RSA-SHA256').update(cuerpo).sign(pem);

  return `${cuerpo}.${base64url(firma)}`;
}

/**
 * Deja la clave en PEM válido.
 *
 * Es el error más común al configurar esto: la clave se copia en un .env y los
 * saltos de línea se convierten en la secuencia de dos caracteres `\n`, con lo
 * que OpenSSL la rechaza con un mensaje que no explica nada.
 */
export function normalizarClavePem(clave: string): string {
  // Se convierten los saltos ANTES de recortar: si se recorta primero, el
  // `\n` final queda como un salto real sobrante al terminar.
  const limpia = clave.replace(/\\n/g, '\n').trim();

  if (!limpia.includes('BEGIN') || !limpia.includes('PRIVATE KEY')) {
    throw new Error(
      'La clave privada de la cuenta de servicio no parece estar en formato PEM. ' +
        'Debe incluir las líneas BEGIN/END PRIVATE KEY.',
    );
  }

  return limpia;
}

/**
 * Decodifica un JWT sin verificarlo. Solo para pruebas y diagnóstico: NUNCA
 * para confiar en su contenido.
 */
export function leerJwtSinVerificar(token: string): { cabecera: unknown; payload: unknown } {
  const partes = token.split('.');
  if (partes.length !== 3) throw new Error('El token no tiene tres partes');

  return {
    cabecera: JSON.parse(Buffer.from(partes[0], 'base64url').toString('utf8')),
    payload: JSON.parse(Buffer.from(partes[1], 'base64url').toString('utf8')),
  };
}

/**
 * Pide un token de acceso OAuth2 a Google con el flujo de cuenta de servicio.
 *
 * Hace falta para las llamadas a la API REST (crear la clase, parchear el
 * objeto). El enlace "Añadir a Google Wallet" NO lo necesita: ese se firma
 * directamente.
 */
export async function obtenerTokenDeAcceso(opciones: {
  cuentaServicioEmail: string;
  clavePrivada: string;
  ambito?: string;
  ahora?: Date;
}): Promise<{ token: string; expiraEn: number }> {
  const ahora = Math.floor((opciones.ahora ?? new Date()).getTime() / 1000);
  const ambito = opciones.ambito ?? 'https://www.googleapis.com/auth/wallet_object.issuer';

  const aserto = firmarRs256(
    {
      iss: opciones.cuentaServicioEmail,
      scope: ambito,
      aud: 'https://oauth2.googleapis.com/token',
      iat: ahora,
      exp: ahora + 3600,
    },
    opciones.clavePrivada,
  );

  const respuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: aserto,
    }),
  });

  if (!respuesta.ok) {
    const detalle = await respuesta.text();
    throw new Error(`Google rechazó la autenticación (${respuesta.status}): ${detalle}`);
  }

  const datos = (await respuesta.json()) as { access_token: string; expires_in: number };
  return { token: datos.access_token, expiraEn: ahora + datos.expires_in };
}
