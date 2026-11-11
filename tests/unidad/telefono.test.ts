import { describe, expect, it } from 'vitest';

import { formatearParaMostrar, normalizarTelefono } from '../../src/dominio/telefono';

/** Atajo: devuelve el teléfono normalizado o lanza, para que las pruebas se lean mejor. */
function normalizar(entrada: string, indicativo?: '57' | '54' | '595'): string {
  const r = normalizarTelefono(entrada, indicativo);
  if (!r.valido) throw new Error(`Se esperaba válido, dio ${r.motivo}: "${entrada}"`);
  return r.telefono;
}

describe('normalizarTelefono con números colombianos', () => {
  it('lleva todas las formas de escribir el mismo número a una sola', () => {
    // Este es el punto de la función: si falla, el mismo cliente entra
    // varias veces al club y las métricas de retorno quedan mal.
    const esperado = '573001234567';

    expect(normalizar('3001234567')).toBe(esperado);
    expect(normalizar('300 123 4567')).toBe(esperado);
    expect(normalizar('300-123-4567')).toBe(esperado);
    expect(normalizar('(300) 123 4567')).toBe(esperado);
    expect(normalizar('+57 300 123 4567')).toBe(esperado);
    expect(normalizar('+573001234567')).toBe(esperado);
    expect(normalizar('573001234567')).toBe(esperado);
    expect(normalizar('0057 300 1234567')).toBe(esperado);
    expect(normalizar('  3001234567  ')).toBe(esperado);
  });
});

describe('normalizarTelefono con otros países', () => {
  it('normaliza números argentinos', () => {
    expect(normalizar('1123456789', '54')).toBe('541123456789');
    expect(normalizar('+54 11 2345 6789', '54')).toBe('541123456789');
    // Formato nacional con el 0 inicial
    expect(normalizar('01123456789', '54')).toBe('541123456789');
  });

  it('normaliza números paraguayos', () => {
    expect(normalizar('981123456', '595')).toBe('595981123456');
    expect(normalizar('+595 981 123456', '595')).toBe('595981123456');
  });

  it('reconoce un indicativo conocido aunque el local sea de otro país', () => {
    // Un argentino que se une al club de un local colombiano.
    expect(normalizar('+541123456789', '57')).toBe('541123456789');
  });

  it('acepta un número internacional desconocido si viene con +', () => {
    // Un turista. Mejor guardarlo que perder el cliente.
    expect(normalizar('+1 415 555 2671')).toBe('14155552671');
  });
});

describe('normalizarTelefono rechaza lo que no es un teléfono', () => {
  it('rechaza el vacío', () => {
    expect(normalizarTelefono('')).toEqual({ valido: false, motivo: 'vacio' });
    expect(normalizarTelefono('   ')).toEqual({ valido: false, motivo: 'vacio' });
  });

  it('rechaza letras en vez de ignorarlas', () => {
    // Ignorarlas en silencio convertiría "no tengo" en un número cualquiera.
    expect(normalizarTelefono('no tengo')).toEqual({
      valido: false,
      motivo: 'caracteres_invalidos',
    });
    expect(normalizarTelefono('300123456a')).toEqual({
      valido: false,
      motivo: 'caracteres_invalidos',
    });
  });

  it('rechaza números demasiado cortos', () => {
    expect(normalizarTelefono('123')).toEqual({ valido: false, motivo: 'muy_corto' });
  });

  it('rechaza números demasiado largos', () => {
    expect(normalizarTelefono('30012345678901234')).toEqual({
      valido: false,
      motivo: 'muy_largo',
    });
  });
});

describe('normalizarTelefono es idempotente', () => {
  it('normalizar dos veces da lo mismo que una', () => {
    // Importa porque el teléfono se vuelve a normalizar al leerlo del panel
    // o de una importación, y no debe cambiar en cada pasada.
    for (const entrada of ['3001234567', '+57 300 123 4567', '(300) 123-4567']) {
      const unaVez = normalizar(entrada);
      expect(normalizar(unaVez)).toBe(unaVez);
    }
  });
});

describe('formatearParaMostrar', () => {
  it('agrupa el número para que se lea en el panel', () => {
    expect(formatearParaMostrar('573001234567')).toBe('+57 300 123 4567');
    expect(formatearParaMostrar('541123456789')).toBe('+54 112 345 6789');
  });

  it('no rompe con un indicativo desconocido', () => {
    expect(formatearParaMostrar('14155552671')).toBe('+14155552671');
  });
});
