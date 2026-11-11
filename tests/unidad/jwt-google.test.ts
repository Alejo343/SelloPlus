import { generateKeyPairSync, createVerify } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { firmarRs256, leerJwtSinVerificar, normalizarClavePem } from '../../src/lib/jwt-google';

/** Par de claves generado al vuelo: no hace falta ninguna credencial real. */
const { privateKey, publicKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

describe('firmarRs256', () => {
  it('produce un JWT de tres partes', () => {
    const token = firmarRs256({ hola: 'mundo' }, privateKey);
    expect(token.split('.')).toHaveLength(3);
  });

  it('declara el algoritmo que espera Google', () => {
    const { cabecera } = leerJwtSinVerificar(firmarRs256({ a: 1 }, privateKey));
    expect(cabecera).toEqual({ alg: 'RS256', typ: 'JWT' });
  });

  it('conserva el payload tal cual', () => {
    const original = { iss: 'x@y.iam.gserviceaccount.com', aud: 'google', iat: 1763000000 };
    const { payload } = leerJwtSinVerificar(firmarRs256(original, privateKey));
    expect(payload).toEqual(original);
  });

  it('genera una firma que verifica con la clave pública', () => {
    // Esto es lo que de verdad importa: si la firma no valida, Google
    // rechazaría el enlace "Añadir a Google Wallet" sin explicar por qué.
    const token = firmarRs256({ prueba: true }, privateKey);
    const [cabecera, payload, firma] = token.split('.');

    const verificador = createVerify('RSA-SHA256');
    verificador.update(`${cabecera}.${payload}`);

    expect(verificador.verify(publicKey, Buffer.from(firma, 'base64url'))).toBe(true);
  });

  it('una firma ajena no valida', () => {
    const otra = generateKeyPairSync('rsa', {
      modulusLength: 2048,
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });

    const token = firmarRs256({ prueba: true }, otra.privateKey);
    const [cabecera, payload, firma] = token.split('.');

    const verificador = createVerify('RSA-SHA256');
    verificador.update(`${cabecera}.${payload}`);

    expect(verificador.verify(publicKey, Buffer.from(firma, 'base64url'))).toBe(false);
  });

  it('usa base64url, sin caracteres que rompan una URL', () => {
    // El token va dentro de una URL: un '+' o un '/' la partirían.
    const token = firmarRs256({ datos: 'áéíóú ñ +/= muchos caracteres raros' }, privateKey);
    expect(token).not.toMatch(/[+/=]/);
  });
});

describe('normalizarClavePem', () => {
  it('convierte los \\n literales en saltos de línea reales', () => {
    // Es el error más común al configurar esto: la clave se pega en un .env
    // y los saltos llegan como dos caracteres, con lo que OpenSSL la rechaza
    // con un mensaje que no explica nada.
    const enUnaLinea = privateKey.replace(/\n/g, '\\n');
    expect(normalizarClavePem(enUnaLinea)).toBe(privateKey.trim());
  });

  it('acepta una clave ya bien formada', () => {
    expect(normalizarClavePem(privateKey)).toBe(privateKey.trim());
  });

  it('firma correctamente con una clave que venía en una sola línea', () => {
    const enUnaLinea = privateKey.replace(/\n/g, '\\n');
    const token = firmarRs256({ a: 1 }, enUnaLinea);

    const [cabecera, payload, firma] = token.split('.');
    const verificador = createVerify('RSA-SHA256');
    verificador.update(`${cabecera}.${payload}`);
    expect(verificador.verify(publicKey, Buffer.from(firma, 'base64url'))).toBe(true);
  });

  it('da un error entendible si la clave no es PEM', () => {
    expect(() => normalizarClavePem('esto-no-es-una-clave')).toThrow(/PEM/);
    expect(() => normalizarClavePem('')).toThrow(/PEM/);
  });
});
