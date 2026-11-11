/**
 * Pruebas del núcleo de sellos contra la base real.
 *
 * Cubren lo que las pruebas unitarias no pueden: concurrencia, transacciones y
 * el aislamiento entre locales.
 */

import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { sellos } from '../../src/db/schema';
import {
  canjear,
  contarSellosDisponibles,
  estadoDelClub,
  sumarSello,
  ultimoDiaConSello,
} from '../../src/servicios/sellos';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import {
  crearClienteDePrueba,
  crearLocalDePrueba,
  instante,
  type LocalDePrueba,
} from '../ayuda/fabricas';

let base: BaseDePruebas;
let local: LocalDePrueba;
let clienteId: string;

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  local = await crearLocalDePrueba(base.db, { sellosObjetivo: 10 });
  clienteId = await crearClienteDePrueba(base.db, local.localId);
});

/** Atajo con los datos del local ya puestos. */
function opcionesSello(extra: Partial<Parameters<typeof sumarSello>[0]> = {}) {
  return {
    localId: local.localId,
    clienteId,
    sellosObjetivo: local.sellosObjetivo,
    zonaHoraria: local.zonaHoraria,
    origen: 'nfc' as const,
    tagId: local.tagId,
    ...extra,
  };
}

describe('sumarSello', () => {
  it('suma el primer sello y devuelve el estado del club', async () => {
    const resultado = await sumarSello(
      opcionesSello({ ahora: instante('2026-11-10') }),
      base.db,
    );

    expect(resultado.resultado).toBe('sumado');
    if (resultado.resultado !== 'sumado') return;
    expect(resultado.dia).toBe('2026-11-10');
    expect(resultado.estado).toMatchObject({ sellos: 1, objetivo: 10, faltan: 9 });
  });

  it('rechaza el segundo sello del mismo día sin lanzar', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    const segundo = await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);

    expect(segundo.resultado).toBe('rechazado');
    if (segundo.resultado !== 'rechazado') return;
    expect(segundo.motivo).toBe('ya_sumo_hoy');
    // El estado sigue siendo correcto: el cliente ve su sello del día.
    expect(segundo.estado.sellos).toBe(1);
  });

  it('suma al día siguiente', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    const segundo = await sumarSello(opcionesSello({ ahora: instante('2026-11-11') }), base.db);

    expect(segundo.resultado).toBe('sumado');
    expect(await contarSellosDisponibles(clienteId, base.db)).toBe(2);
  });

  it('usa el día del local, no el de UTC', async () => {
    // 03:00 UTC del 11 son las 22:00 del 10 en Bogotá: mismo día local que un
    // sello de las 20:00 del 10. Si se usara UTC, el cliente sumaría dos.
    const primero = await sumarSello(
      opcionesSello({ ahora: instante('2026-11-11', '01:00:00') }),
      base.db,
    );
    expect(primero.resultado).toBe('sumado');
    if (primero.resultado === 'sumado') expect(primero.dia).toBe('2026-11-10');

    const segundo = await sumarSello(
      opcionesSello({ ahora: instante('2026-11-11', '03:00:00') }),
      base.db,
    );
    expect(segundo.resultado).toBe('rechazado');
  });

  it('solo uno de tres taps simultáneos suma, y los otros reciben el motivo', async () => {
    // El caso real: el mozo apoya el chip dos veces, o el cliente lo toca de
    // nuevo porque no vio la confirmación. Las comprobaciones del dominio
    // pasan en los tres; solo la base impide el duplicado.
    const resultados = await Promise.all([
      sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db),
      sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db),
      sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db),
    ]);

    expect(resultados.filter((r) => r.resultado === 'sumado')).toHaveLength(1);
    expect(resultados.filter((r) => r.resultado === 'rechazado')).toHaveLength(2);
    expect(await contarSellosDisponibles(clienteId, base.db)).toBe(1);
  });

  it('rechaza el sello si el tag está dado de baja', async () => {
    const otro = await crearLocalDePrueba(base.db, { tagActivo: false });
    const suCliente = await crearClienteDePrueba(base.db, otro.localId);

    const resultado = await sumarSello(
      {
        localId: otro.localId,
        clienteId: suCliente,
        sellosObjetivo: otro.sellosObjetivo,
        zonaHoraria: otro.zonaHoraria,
        origen: 'nfc',
        tagId: otro.tagId,
        ahora: instante('2026-11-10'),
      },
      base.db,
    );

    expect(resultado).toMatchObject({ resultado: 'rechazado', motivo: 'tag_inactivo' });
  });

  it('rechaza el sello si el cliente pidió la baja', async () => {
    const deBaja = await crearClienteDePrueba(base.db, local.localId, { dadoDeBaja: true });

    const resultado = await sumarSello(
      opcionesSello({ clienteId: deBaja, ahora: instante('2026-11-10') }),
      base.db,
    );

    expect(resultado).toMatchObject({
      resultado: 'rechazado',
      motivo: 'cliente_dado_de_baja',
    });
  });

  it('acepta un sello manual sin tag, con el usuario que lo sumó', async () => {
    const resultado = await sumarSello(
      opcionesSello({
        origen: 'manual',
        tagId: null,
        usuarioLocalId: local.usuarioLocalId,
        ahora: instante('2026-11-10'),
      }),
      base.db,
    );

    expect(resultado.resultado).toBe('sumado');
    const [fila] = await base.db.select().from(sellos).where(eq(sellos.clienteId, clienteId));
    expect(fila.origen).toBe('manual');
    expect(fila.usuarioLocalId).toBe(local.usuarioLocalId);
  });

  it('se niega a sumar un sello a un cliente de otro local (RNF-05)', async () => {
    // El ataque: mandar el id de un cliente ajeno con el local propio.
    const otro = await crearLocalDePrueba(base.db);
    const clienteAjeno = await crearClienteDePrueba(base.db, otro.localId);

    await expect(
      sumarSello(
        opcionesSello({ clienteId: clienteAjeno, ahora: instante('2026-11-10') }),
        base.db,
      ),
    ).rejects.toThrow(/no pertenece al local/);

    expect(await contarSellosDisponibles(clienteAjeno, base.db)).toBe(0);
  });
});

describe('ultimoDiaConSello', () => {
  it('da null para un cliente sin sellos', async () => {
    expect(await ultimoDiaConSello(clienteId, base.db)).toBeNull();
  });

  it('da el más reciente, no el último insertado', async () => {
    await sumarSello(opcionesSello({ ahora: instante('2026-11-05') }), base.db);
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    await sumarSello(opcionesSello({ ahora: instante('2026-11-07') }), base.db);

    expect(await ultimoDiaConSello(clienteId, base.db)).toBe('2026-11-10');
  });
});

describe('canjear: RN-02', () => {
  /** Suma `cantidad` sellos en días distintos y consecutivos. */
  async function sumarVarios(cantidad: number) {
    for (let i = 0; i < cantidad; i += 1) {
      const dia = `2026-10-${String(i + 1).padStart(2, '0')}`;
      await sumarSello(opcionesSello({ ahora: instante(dia) }), base.db);
    }
  }

  it('no deja canjear sin llegar al objetivo', async () => {
    await sumarVarios(7);

    const resultado = await canjear(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        premio: local.premio,
      },
      base.db,
    );

    expect(resultado).toMatchObject({ resultado: 'sellos_insuficientes', faltan: 3 });
    expect(await contarSellosDisponibles(clienteId, base.db)).toBe(7);
  });

  it('canjea al llegar al objetivo y reinicia el contador', async () => {
    await sumarVarios(10);

    const resultado = await canjear(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        premio: local.premio,
        usuarioLocalId: local.usuarioLocalId,
      },
      base.db,
    );

    expect(resultado.resultado).toBe('canjeado');
    expect(await contarSellosDisponibles(clienteId, base.db)).toBe(0);
    // Los sellos no se borran: quedan marcados con el canje que los consumió.
    const todos = await base.db.select().from(sellos).where(eq(sellos.clienteId, clienteId));
    expect(todos).toHaveLength(10);
    expect(todos.every((s) => s.canjeId !== null)).toBe(true);
  });

  it('consume solo el objetivo y deja el excedente a favor', async () => {
    // El cliente que siguió viniendo después de llegar al premio no pierde
    // los sellos de más: es lo que lo mantiene en el club.
    await sumarVarios(13);

    const resultado = await canjear(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        premio: local.premio,
      },
      base.db,
    );

    expect(resultado.resultado).toBe('canjeado');
    expect(await contarSellosDisponibles(clienteId, base.db)).toBe(3);
  });

  it('consume los sellos más antiguos primero', async () => {
    await sumarVarios(12);

    await canjear(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        premio: local.premio,
      },
      base.db,
    );

    const disponibles = await base.db
      .select({ fecha: sellos.fecha })
      .from(sellos)
      .where(and(eq(sellos.clienteId, clienteId), isNull(sellos.canjeId)))
      .orderBy(sellos.fecha);

    // Quedan los dos últimos días, no dos cualesquiera.
    expect(disponibles.map((s) => s.fecha)).toEqual(['2026-10-11', '2026-10-12']);
  });

  it('guarda el texto del premio en el canje, por si el programa cambia después', async () => {
    await sumarVarios(10);

    await canjear(
      {
        localId: local.localId,
        clienteId,
        sellosObjetivo: local.sellosObjetivo,
        premio: 'Una cena para dos (promo de noviembre)',
      },
      base.db,
    );

    const [canje] = await base.db.query.canjes.findMany();
    expect(canje.premio).toBe('Una cena para dos (promo de noviembre)');
    expect(canje.sellosUsados).toBe(10);
  });

  it('dos canjes simultáneos no regalan dos premios', async () => {
    // Dos cajeros canjeando a la vez. Sin la transacción con los sellos
    // bloqueados, los dos verían 10 disponibles y el local pagaría dos cenas.
    await sumarVarios(10);

    const opciones = {
      localId: local.localId,
      clienteId,
      sellosObjetivo: local.sellosObjetivo,
      premio: local.premio,
    };

    const resultados = await Promise.all([
      canjear(opciones, base.db),
      canjear(opciones, base.db),
    ]);

    expect(resultados.filter((r) => r.resultado === 'canjeado')).toHaveLength(1);
    expect(resultados.filter((r) => r.resultado === 'sellos_insuficientes')).toHaveLength(1);
    expect(await contarSellosDisponibles(clienteId, base.db)).toBe(0);
    expect(await base.db.query.canjes.findMany()).toHaveLength(1);
  });

  it('permite un segundo premio cuando vuelve a juntar los sellos', async () => {
    await sumarVarios(10);
    const opciones = {
      localId: local.localId,
      clienteId,
      sellosObjetivo: local.sellosObjetivo,
      premio: local.premio,
    };
    await canjear(opciones, base.db);

    // Vuelve a sumar 10, en días posteriores.
    for (let i = 0; i < 10; i += 1) {
      await sumarSello(
        opcionesSello({ ahora: instante(`2026-11-${String(i + 1).padStart(2, '0')}`) }),
        base.db,
      );
    }

    const segundo = await canjear(opciones, base.db);
    expect(segundo.resultado).toBe('canjeado');
    expect(await base.db.query.canjes.findMany()).toHaveLength(2);
  });
});

describe('estadoDelClub', () => {
  it('cuenta solo los sellos disponibles de ese cliente', async () => {
    const otroCliente = await crearClienteDePrueba(base.db, local.localId);
    await sumarSello(opcionesSello({ ahora: instante('2026-11-10') }), base.db);
    await sumarSello(
      opcionesSello({ clienteId: otroCliente, ahora: instante('2026-11-10') }),
      base.db,
    );

    const estado = await estadoDelClub(clienteId, local.sellosObjetivo, base.db);
    expect(estado.sellos).toBe(1);
  });
});
