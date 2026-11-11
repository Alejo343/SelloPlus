import { describe, expect, it } from 'vitest';

import {
  calcularTasaRetorno,
  fraseRetorno,
  MINIMO_PARA_TASA,
  sellosPorCanje,
} from '../../src/dominio/metricas';

describe('calcularTasaRetorno', () => {
  it('calcula el porcentaje de los que volvieron', () => {
    const tasa = calcularTasaRetorno({ clientesPrevios: 40, clientesQueVolvieron: 10 });

    expect(tasa.porcentaje).toBe(25);
    expect(tasa.significativa).toBe(true);
  });

  it('redondea a un decimal', () => {
    expect(calcularTasaRetorno({ clientesPrevios: 3, clientesQueVolvieron: 1 }).porcentaje).toBe(
      33.3,
    );
  });

  it('da 100% cuando volvieron todos', () => {
    expect(calcularTasaRetorno({ clientesPrevios: 20, clientesQueVolvieron: 20 }).porcentaje).toBe(
      100,
    );
  });

  it('da 0 sin dividir por cero cuando no hay clientes previos', () => {
    const tasa = calcularTasaRetorno({ clientesPrevios: 0, clientesQueVolvieron: 0 });

    expect(tasa.porcentaje).toBe(0);
    expect(tasa.significativa).toBe(false);
  });

  it('marca como no significativa una base demasiado chica', () => {
    // Mostrar "0% de retorno" con 2 clientes asusta al dueño sin motivo.
    const pocos = calcularTasaRetorno({
      clientesPrevios: MINIMO_PARA_TASA - 1,
      clientesQueVolvieron: 0,
    });
    expect(pocos.significativa).toBe(false);

    const suficientes = calcularTasaRetorno({
      clientesPrevios: MINIMO_PARA_TASA,
      clientesQueVolvieron: 0,
    });
    expect(suficientes.significativa).toBe(true);
  });

  it('rechaza datos imposibles en vez de inventar un número', () => {
    // Si volvieron más de los que había, hay un error en la consulta, y es
    // mejor que se note que mostrar un 150% de retorno en el panel.
    expect(() =>
      calcularTasaRetorno({ clientesPrevios: 10, clientesQueVolvieron: 15 }),
    ).toThrow(/imposible/);

    expect(() =>
      calcularTasaRetorno({ clientesPrevios: -1, clientesQueVolvieron: 0 }),
    ).toThrow(/negativos/);
  });
});

describe('fraseRetorno', () => {
  it('dice que no hay datos cuando no hay clientes previos', () => {
    const frase = fraseRetorno(calcularTasaRetorno({ clientesPrevios: 0, clientesQueVolvieron: 0 }));
    expect(frase).toMatch(/todavía no hay/i);
    expect(frase).not.toContain('0%');
  });

  it('da los números crudos, sin porcentaje, cuando la base es chica', () => {
    const frase = fraseRetorno(calcularTasaRetorno({ clientesPrevios: 4, clientesQueVolvieron: 1 }));
    expect(frase).toContain('1 de 4');
    expect(frase).toMatch(/pocos/i);
    expect(frase).not.toContain('%');
  });

  it('da el porcentaje cuando la base alcanza', () => {
    const frase = fraseRetorno(
      calcularTasaRetorno({ clientesPrevios: 40, clientesQueVolvieron: 10 }),
    );
    expect(frase).toContain('10 de 40');
    expect(frase).toContain('25%');
  });
});

describe('sellosPorCanje', () => {
  it('calcula cuántos sellos cuesta cada premio entregado', () => {
    expect(sellosPorCanje(100, 8)).toBe(12.5);
  });

  it('devuelve null sin premios entregados, en vez de dividir por cero', () => {
    expect(sellosPorCanje(100, 0)).toBeNull();
  });
});
