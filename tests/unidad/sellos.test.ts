import { describe, expect, it } from 'vitest';

import {
  calcularEstado,
  mensajeDelTap,
  puedeCanjear,
  puedeSumarSello,
} from '../../src/dominio/sellos';

describe('calcularEstado', () => {
  it('calcula cuántos faltan para el premio', () => {
    expect(calcularEstado(3, 10)).toEqual({
      sellos: 3,
      objetivo: 10,
      faltan: 7,
      premioDisponible: false,
    });
  });

  it('marca el premio disponible al llegar justo al objetivo', () => {
    const estado = calcularEstado(10, 10);
    expect(estado.premioDisponible).toBe(true);
    expect(estado.faltan).toBe(0);
  });

  it('no deja "faltan" en negativo cuando tiene más sellos que el objetivo', () => {
    const estado = calcularEstado(13, 10);
    expect(estado.faltan).toBe(0);
    expect(estado.premioDisponible).toBe(true);
    expect(estado.sellos).toBe(13);
  });

  it('trata un cliente sin sellos como cero, no como error', () => {
    expect(calcularEstado(0, 6).faltan).toBe(6);
  });

  it('rechaza un objetivo inválido, que sería un error de configuración del local', () => {
    expect(() => calcularEstado(1, 0)).toThrow(/al menos 1/);
    expect(() => calcularEstado(1, -3)).toThrow(/al menos 1/);
  });
});

describe('puedeSumarSello: RN-01, un sello por día', () => {
  it('permite el primer sello de un cliente nuevo', () => {
    expect(puedeSumarSello({ ultimoSello: null, hoy: '2026-11-10' })).toEqual({ puede: true });
  });

  it('rechaza un segundo sello el mismo día', () => {
    expect(puedeSumarSello({ ultimoSello: '2026-11-10', hoy: '2026-11-10' })).toEqual({
      puede: false,
      motivo: 'ya_sumo_hoy',
    });
  });

  it('permite sumar al día siguiente', () => {
    expect(puedeSumarSello({ ultimoSello: '2026-11-10', hoy: '2026-11-11' })).toEqual({
      puede: true,
    });
  });

  it('rechaza un tag dado de baja', () => {
    expect(
      puedeSumarSello({ ultimoSello: null, hoy: '2026-11-10', tagActivo: false }),
    ).toEqual({ puede: false, motivo: 'tag_inactivo' });
  });

  it('rechaza a un cliente que pidió la baja del club', () => {
    expect(
      puedeSumarSello({ ultimoSello: null, hoy: '2026-11-10', dadoDeBaja: true }),
    ).toEqual({ puede: false, motivo: 'cliente_dado_de_baja' });
  });

  it('da prioridad al tag inactivo sobre los demás motivos', () => {
    // Si el tag no sirve, es lo primero que hay que decirle al local.
    const decision = puedeSumarSello({
      ultimoSello: '2026-11-10',
      hoy: '2026-11-10',
      tagActivo: false,
      dadoDeBaja: true,
    });
    expect(decision).toEqual({ puede: false, motivo: 'tag_inactivo' });
  });
});

describe('puedeCanjear: RN-02', () => {
  it('no deja canjear sin llegar al objetivo', () => {
    expect(puedeCanjear(7, 10)).toEqual({
      puede: false,
      motivo: 'sellos_insuficientes',
      faltan: 3,
    });
  });

  it('deja canjear al llegar justo al objetivo', () => {
    expect(puedeCanjear(10, 10)).toEqual({ puede: true, sellosAUsar: 10 });
  });

  it('consume solo el objetivo y le deja el excedente a favor', () => {
    // Un cliente con 13 sellos y objetivo 10 canjea y le quedan 3, no 0.
    // Es lo que lo mantiene sumando después del primer premio.
    const decision = puedeCanjear(13, 10);
    expect(decision).toEqual({ puede: true, sellosAUsar: 10 });
  });
});

describe('mensajeDelTap', () => {
  it('invita a registrarse al cliente nuevo', () => {
    expect(mensajeDelTap({ tipo: 'cliente_nuevo' })).toContain('registramos tu visita');
  });

  it('dice cuántos faltan al sumar un sello', () => {
    const mensaje = mensajeDelTap({ tipo: 'sello_sumado', estado: calcularEstado(7, 10) });
    expect(mensaje).toContain('3');
    expect(mensaje).toContain('faltan');
  });

  it('usa el singular cuando falta uno solo', () => {
    const mensaje = mensajeDelTap({ tipo: 'sello_sumado', estado: calcularEstado(9, 10) });
    expect(mensaje).toContain('falta 1');
    expect(mensaje).not.toContain('faltan');
  });

  it('anuncia el premio cuando se alcanzó el objetivo', () => {
    const mensaje = mensajeDelTap({ tipo: 'sello_sumado', estado: calcularEstado(10, 10) });
    expect(mensaje).toContain('premio disponible');
  });

  it('manda a volver mañana a quien ya sumó hoy', () => {
    const mensaje = mensajeDelTap({ tipo: 'ya_sumo_hoy', estado: calcularEstado(4, 10) });
    expect(mensaje).toContain('Vuelve mañana');
  });

  it('manda a pedir ayuda al personal cuando el tag está inactivo', () => {
    expect(mensajeDelTap({ tipo: 'rechazado', motivo: 'tag_inactivo' })).toContain('personal');
  });
});
