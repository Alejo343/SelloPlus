import { describe, expect, it } from 'vitest';

import {
  diaEnZona,
  diasDelMes,
  diasEntre,
  diasHastaCumple,
  esBisiesto,
  esDiaValido,
  sumarDias,
} from '../../src/dominio/fechas';

describe('diaEnZona', () => {
  it('da el día del local, no el de UTC', () => {
    // 23:30 del 10 de noviembre en Bogotá son las 04:30 del 11 en UTC.
    const instante = new Date('2026-11-11T04:30:00Z');

    expect(diaEnZona(instante, 'America/Bogota')).toBe('2026-11-10');
    expect(diaEnZona(instante, 'UTC')).toBe('2026-11-11');
  });

  it('es el caso que rompería la regla de un sello por día cada noche', () => {
    // Dos sellos la misma noche de Bogotá, a ambos lados de la medianoche UTC.
    const antes = new Date('2026-11-11T02:00:00Z'); // 21:00 del 10 en Bogotá
    const despues = new Date('2026-11-11T04:00:00Z'); // 23:00 del 10 en Bogotá

    expect(diaEnZona(antes, 'America/Bogota')).toBe(diaEnZona(despues, 'America/Bogota'));
    // En UTC parecerían días distintos, y el cliente sumaría dos sellos.
    expect(diaEnZona(antes, 'UTC')).toBe(diaEnZona(despues, 'UTC'));
  });

  it('respeta el horario de verano de Argentina y Paraguay', () => {
    const instante = new Date('2026-01-15T02:30:00Z');

    expect(diaEnZona(instante, 'America/Argentina/Buenos_Aires')).toBe('2026-01-14');
    expect(diaEnZona(instante, 'America/Asuncion')).toBe('2026-01-14');
  });
});

describe('esBisiesto y diasDelMes', () => {
  it('reconoce los años bisiestos, incluidos los múltiplos de 100 y 400', () => {
    expect(esBisiesto(2024)).toBe(true);
    expect(esBisiesto(2026)).toBe(false);
    expect(esBisiesto(1900)).toBe(false);
    expect(esBisiesto(2000)).toBe(true);
  });

  it('da los días de febrero según el año', () => {
    expect(diasDelMes(2024, 2)).toBe(29);
    expect(diasDelMes(2026, 2)).toBe(28);
    expect(diasDelMes(2026, 4)).toBe(30);
    expect(diasDelMes(2026, 12)).toBe(31);
  });
});

describe('esDiaValido', () => {
  it('acepta días reales y rechaza los imposibles', () => {
    expect(esDiaValido('2026-11-10')).toBe(true);
    expect(esDiaValido('2024-02-29')).toBe(true);
    expect(esDiaValido('2026-02-29')).toBe(false); // 2026 no es bisiesto
    expect(esDiaValido('2026-13-01')).toBe(false);
    expect(esDiaValido('2026-04-31')).toBe(false);
    expect(esDiaValido('10/11/2026')).toBe(false);
    expect(esDiaValido('')).toBe(false);
  });
});

describe('diasEntre', () => {
  it('cuenta días hacia adelante y hacia atrás', () => {
    expect(diasEntre('2026-11-10', '2026-11-11')).toBe(1);
    expect(diasEntre('2026-11-11', '2026-11-10')).toBe(-1);
    expect(diasEntre('2026-11-10', '2026-11-10')).toBe(0);
  });

  it('cruza meses y años sin equivocarse', () => {
    expect(diasEntre('2026-11-10', '2026-12-10')).toBe(30);
    expect(diasEntre('2026-12-31', '2027-01-01')).toBe(1);
    expect(diasEntre('2024-02-28', '2024-03-01')).toBe(2); // 2024 bisiesto
    expect(diasEntre('2026-02-28', '2026-03-01')).toBe(1);
  });

  it('cuenta un año completo', () => {
    expect(diasEntre('2026-01-01', '2027-01-01')).toBe(365);
    expect(diasEntre('2024-01-01', '2025-01-01')).toBe(366);
  });
});

describe('sumarDias', () => {
  it('suma y resta cruzando límites de mes y año', () => {
    expect(sumarDias('2026-11-10', 1)).toBe('2026-11-11');
    expect(sumarDias('2026-11-30', 1)).toBe('2026-12-01');
    expect(sumarDias('2026-12-31', 1)).toBe('2027-01-01');
    expect(sumarDias('2026-01-01', -1)).toBe('2025-12-31');
    expect(sumarDias('2026-11-10', -42)).toBe('2026-09-29');
  });
});

describe('diasHastaCumple', () => {
  it('da 0 el día del cumpleaños', () => {
    expect(diasHastaCumple('1990-11-10', '2026-11-10')).toBe(0);
  });

  it('cuenta los días cuando el cumpleaños está por venir', () => {
    expect(diasHastaCumple('1990-11-17', '2026-11-10')).toBe(7);
  });

  it('salta al año siguiente cuando el cumpleaños ya pasó', () => {
    // El 1 de noviembre ya pasó: faltan casi 12 meses.
    expect(diasHastaCumple('1990-11-01', '2026-11-10')).toBe(356);
  });

  it('funciona a fin de año, cruzando a enero', () => {
    expect(diasHastaCumple('1990-01-05', '2026-12-30')).toBe(6);
  });

  it('trata el 29 de febrero como 28 en los años no bisiestos', () => {
    // 2026 no es bisiesto: el cumpleaños cae el 28.
    expect(diasHastaCumple('2000-02-29', '2026-02-20')).toBe(8);
    expect(diasHastaCumple('2000-02-29', '2026-02-28')).toBe(0);
  });

  it('respeta el 29 de febrero en los años bisiestos', () => {
    expect(diasHastaCumple('2000-02-29', '2028-02-28')).toBe(1);
    expect(diasHastaCumple('2000-02-29', '2028-02-29')).toBe(0);
  });

  it('nunca devuelve un valor negativo, para ninguna fecha del año', () => {
    // Barrido de todos los días del año contra una fecha fija: si alguna
    // combinación diera negativo, un cliente se quedaría sin saludo.
    let dia = '2026-01-01';
    while (dia < '2027-01-01') {
      expect(diasHastaCumple(dia.replace('2026', '1990'), '2026-06-15')).toBeGreaterThanOrEqual(0);
      dia = sumarDias(dia, 1);
    }
  });
});
