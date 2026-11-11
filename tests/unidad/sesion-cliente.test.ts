import { createHmac } from 'node:crypto';

import { describe, expect, it } from 'vitest';

import { crearToken, leerToken, nombreCookie } from '../../src/lib/sesion-cliente';

const SECRETO = 'secreto-de-prueba-suficientemente-largo-123456';
const SESION = {
  clienteId: '11111111-1111-4111-8111-111111111111',
  localId: '22222222-2222-4222-8222-222222222222',
};

describe('crearToken y leerToken', () => {
  it('devuelve la misma sesión que se guardó', () => {
    expect(leerToken(crearToken(SESION, SECRETO), SECRETO)).toEqual(SESION);
  });

  it('no deja el id a la vista en texto plano', () => {
    // No es un secreto, pero tampoco se regala: evita que alguien curioseando
    // la cookie pruebe a cambiar un dígito a mano.
    expect(crearToken(SESION, SECRETO)).not.toContain(SESION.clienteId);
  });
});

describe('leerToken rechaza tokens falsificados', () => {
  it('rechaza un token con el cuerpo alterado', () => {
    // El ataque que importa: cambiar el id de cliente por el de otro para
    // mirar o gastar sus sellos.
    const token = crearToken(SESION, SECRETO);
    const [, firma] = token.split('.');
    const otroCuerpo = Buffer.from(
      JSON.stringify({ ...SESION, clienteId: '99999999-9999-4999-8999-999999999999' }),
    ).toString('base64url');

    expect(leerToken(`${otroCuerpo}.${firma}`, SECRETO)).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', () => {
    const token = crearToken(SESION, 'otro-secreto-igual-de-largo-pero-distinto');
    expect(leerToken(token, SECRETO)).toBeNull();
  });

  it('rechaza una firma recortada o alargada', () => {
    const token = crearToken(SESION, SECRETO);
    const [cuerpo, firma] = token.split('.');

    expect(leerToken(`${cuerpo}.${firma.slice(0, -1)}`, SECRETO)).toBeNull();
    expect(leerToken(`${cuerpo}.${firma}x`, SECRETO)).toBeNull();
  });

  it('rechaza basura y valores ausentes sin lanzar', () => {
    for (const malo of ['', 'cualquier-cosa', 'a.b', 'a.b.c', undefined, null]) {
      expect(leerToken(malo, SECRETO)).toBeNull();
    }
  });

  it('rechaza un cuerpo con firma válida pero contenido incompleto', () => {
    // Un token sin localId pasaría la firma pero no sirve: sin local no se
    // puede comprobar el aislamiento al leer el cliente.
    const token = crearToken({ clienteId: 'x', localId: 'y' }, SECRETO);
    expect(leerToken(token, SECRETO)).toEqual({ clienteId: 'x', localId: 'y' });

    const cuerpoIncompleto = Buffer.from(JSON.stringify({ clienteId: 'solo-cliente' })).toString(
      'base64url',
    );
    const firmaValida = crearToken({ clienteId: 'a', localId: 'b' }, SECRETO); // para sacar el formato
    expect(firmaValida.split('.')).toHaveLength(2);
    // Se firma el cuerpo incompleto con el secreto correcto: la firma es
    // válida, pero el contenido no, y debe rechazarse igual.
    const firma = createHmac('sha256', SECRETO).update(cuerpoIncompleto).digest('base64url');
    expect(leerToken(`${cuerpoIncompleto}.${firma}`, SECRETO)).toBeNull();
  });
});

describe('nombreCookie', () => {
  it('usa una cookie por local, porque un cliente puede estar en varios clubes', () => {
    expect(nombreCookie('la-esquina')).toBe('sp_la-esquina');
    expect(nombreCookie('cafe-vecino')).not.toBe(nombreCookie('la-esquina'));
  });
});
