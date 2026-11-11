import { describe, expect, it } from 'vitest';

import {
  crearTokenPanel,
  DURACION_SESION_MS,
  leerTokenPanel,
} from '../../src/lib/sesion-panel';

const SECRETO = 'secreto-de-prueba-suficientemente-largo-123456';
const AHORA = 1_800_000_000_000;

const SESION = {
  usuarioId: '11111111-1111-4111-8111-111111111111',
  localId: '22222222-2222-4222-8222-222222222222',
  creadaEn: AHORA,
};

describe('sesión del panel', () => {
  it('devuelve la sesión que se guardó', () => {
    expect(leerTokenPanel(crearTokenPanel(SESION, SECRETO), SECRETO, AHORA)).toEqual(SESION);
  });

  it('sigue válida justo antes de caducar', () => {
    const casiVencida = AHORA + DURACION_SESION_MS - 1000;
    expect(leerTokenPanel(crearTokenPanel(SESION, SECRETO), SECRETO, casiVencida)).toEqual(SESION);
  });

  it('caduca pasadas las horas de la sesión', () => {
    // El panel da acceso a datos de terceros: no puede durar un año como la
    // tarjeta de sellos del cliente.
    const vencida = AHORA + DURACION_SESION_MS + 1000;
    expect(leerTokenPanel(crearTokenPanel(SESION, SECRETO), SECRETO, vencida)).toBeNull();
  });

  it('rechaza una sesión con fecha futura, que sería un token manipulado', () => {
    const futura = { ...SESION, creadaEn: AHORA + 10 * 60 * 1000 };
    expect(leerTokenPanel(crearTokenPanel(futura, SECRETO), SECRETO, AHORA)).toBeNull();
  });

  it('rechaza un token firmado con otro secreto', () => {
    const otro = crearTokenPanel(SESION, 'otro-secreto-igual-de-largo-pero-distinto');
    expect(leerTokenPanel(otro, SECRETO, AHORA)).toBeNull();
  });

  it('rechaza el cuerpo alterado para cambiar de local', () => {
    // El ataque que importa: editar el localId para ver los clientes de otro.
    const token = crearTokenPanel(SESION, SECRETO);
    const [, firma] = token.split('.');
    const otroCuerpo = Buffer.from(
      JSON.stringify({ ...SESION, localId: '99999999-9999-4999-8999-999999999999' }),
    ).toString('base64url');

    expect(leerTokenPanel(`${otroCuerpo}.${firma}`, SECRETO, AHORA)).toBeNull();
  });

  it('rechaza basura sin lanzar', () => {
    for (const malo of ['', 'a', 'a.b', 'a.b.c', undefined, null]) {
      expect(leerTokenPanel(malo, SECRETO, AHORA)).toBeNull();
    }
  });
});
