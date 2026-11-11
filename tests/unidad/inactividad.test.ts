import { describe, expect, it } from 'vitest';

import {
  cumpleEnVentana,
  estaInactivo,
  motivosParaEscribir,
  type ClienteParaEvaluar,
  type ReglasDelPrograma,
} from '../../src/dominio/inactividad';

const HOY = '2026-11-10';

const REGLAS: ReglasDelPrograma = {
  semanasInactividad: 6,
  diasAntesCumple: 7,
};

function cliente(parcial: Partial<ClienteParaEvaluar> = {}): ClienteParaEvaluar {
  return {
    ultimoSello: null,
    fechaNacimiento: null,
    dadoDeBaja: false,
    ...parcial,
  };
}

describe('estaInactivo: RN-06', () => {
  it('no considera inactivo a quien vino esta semana', () => {
    expect(estaInactivo(cliente({ ultimoSello: '2026-11-08' }), HOY, REGLAS)).toBe(false);
  });

  it('considera inactivo a quien no viene desde hace más de 6 semanas', () => {
    expect(estaInactivo(cliente({ ultimoSello: '2026-09-01' }), HOY, REGLAS)).toBe(true);
  });

  it('usa el umbral exacto: a los 42 días ya cuenta', () => {
    // 6 semanas = 42 días. Un día antes, todavía no.
    expect(estaInactivo(cliente({ ultimoSello: '2026-09-29' }), HOY, REGLAS)).toBe(true); // 42
    expect(estaInactivo(cliente({ ultimoSello: '2026-09-30' }), HOY, REGLAS)).toBe(false); // 41
  });

  it('respeta el umbral configurado por cada local', () => {
    const impaciente = { ...REGLAS, semanasInactividad: 2 };
    expect(estaInactivo(cliente({ ultimoSello: '2026-10-25' }), HOY, impaciente)).toBe(true);
    expect(estaInactivo(cliente({ ultimoSello: '2026-10-25' }), HOY, REGLAS)).toBe(false);
  });

  it('NO considera inactivo a quien nunca sumó un sello', () => {
    // Mandarle "hace mucho que no vienes" a alguien que nunca vino queda mal
    // y es el tipo de detalle que hace que el local pierda confianza.
    expect(estaInactivo(cliente({ ultimoSello: null }), HOY, REGLAS)).toBe(false);
  });

  it('nunca considera inactivo a quien pidió la baja (RN-08)', () => {
    expect(
      estaInactivo(cliente({ ultimoSello: '2026-01-01', dadoDeBaja: true }), HOY, REGLAS),
    ).toBe(false);
  });
});

describe('cumpleEnVentana: RN-05', () => {
  it('incluye a quien cumple dentro de los próximos 7 días', () => {
    expect(cumpleEnVentana(cliente({ fechaNacimiento: '1990-11-15' }), HOY, REGLAS)).toBe(true);
  });

  it('incluye a quien cumple hoy', () => {
    expect(cumpleEnVentana(cliente({ fechaNacimiento: '1990-11-10' }), HOY, REGLAS)).toBe(true);
  });

  it('usa el umbral exacto: al día 7 entra, al 8 no', () => {
    expect(cumpleEnVentana(cliente({ fechaNacimiento: '1990-11-17' }), HOY, REGLAS)).toBe(true);
    expect(cumpleEnVentana(cliente({ fechaNacimiento: '1990-11-18' }), HOY, REGLAS)).toBe(false);
  });

  it('excluye a quien ya cumplió', () => {
    expect(cumpleEnVentana(cliente({ fechaNacimiento: '1990-11-09' }), HOY, REGLAS)).toBe(false);
  });

  it('funciona a fin de año, cuando el cumpleaños cae en enero', () => {
    expect(
      cumpleEnVentana(cliente({ fechaNacimiento: '1990-01-03' }), '2026-12-29', REGLAS),
    ).toBe(true);
  });

  it('incluye a quien nació el 29 de febrero, en un año no bisiesto', () => {
    // Si se tratara literal, recibiría el saludo uno de cada cuatro años.
    expect(
      cumpleEnVentana(cliente({ fechaNacimiento: '2000-02-29' }), '2026-02-25', REGLAS),
    ).toBe(true);
  });

  it('excluye a quien no dio su fecha de nacimiento', () => {
    expect(cumpleEnVentana(cliente({ fechaNacimiento: null }), HOY, REGLAS)).toBe(false);
  });

  it('nunca incluye a quien pidió la baja (RN-08)', () => {
    expect(
      cumpleEnVentana(cliente({ fechaNacimiento: '1990-11-10', dadoDeBaja: true }), HOY, REGLAS),
    ).toBe(false);
  });
});

describe('motivosParaEscribir', () => {
  it('no devuelve nada para un cliente activo sin cumpleaños cerca', () => {
    expect(
      motivosParaEscribir(
        cliente({ ultimoSello: '2026-11-08', fechaNacimiento: '1990-05-20' }),
        HOY,
        REGLAS,
      ),
    ).toEqual([]);
  });

  it('devuelve el cumpleaños primero cuando se dan los dos motivos', () => {
    // Un saludo de cumpleaños es mejor excusa para volver que un
    // "te echamos de menos", así que va antes en la lista.
    expect(
      motivosParaEscribir(
        cliente({ ultimoSello: '2026-01-15', fechaNacimiento: '1990-11-14' }),
        HOY,
        REGLAS,
      ),
    ).toEqual(['cumpleanos', 'inactividad']);
  });

  it('devuelve solo inactividad cuando el cumpleaños está lejos', () => {
    expect(
      motivosParaEscribir(
        cliente({ ultimoSello: '2026-01-15', fechaNacimiento: '1990-05-20' }),
        HOY,
        REGLAS,
      ),
    ).toEqual(['inactividad']);
  });

  it('devuelve lista vacía para quien pidió la baja, pase lo que pase', () => {
    expect(
      motivosParaEscribir(
        cliente({ ultimoSello: '2026-01-01', fechaNacimiento: '1990-11-10', dadoDeBaja: true }),
        HOY,
        REGLAS,
      ),
    ).toEqual([]);
  });
});
