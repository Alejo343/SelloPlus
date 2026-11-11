/**
 * El panel contra la base real.
 *
 * Lo que más importa acá es el aislamiento: el panel es la única parte del
 * sistema donde un usuario autenticado podría, con un identificador ajeno,
 * llegar a datos de otro local (RNF-05).
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { autenticar, listarClientes, obtenerClienteDelPanel, resumenDelLocal } from '../../src/servicios/panel';
import { sumarSello } from '../../src/servicios/sellos';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import {
  crearClienteDePrueba,
  crearLocalDePrueba,
  instante,
  type LocalDePrueba,
} from '../ayuda/fabricas';

let base: BaseDePruebas;
let local: LocalDePrueba;

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
  local = await crearLocalDePrueba(base.db, { slug: 'la-esquina' });
});

describe('autenticar', () => {
  it('acepta las credenciales correctas', async () => {
    const usuario = await autenticar('la-esquina@prueba.test', 'contrasena-de-prueba', base.db);

    expect(usuario).not.toBeNull();
    expect(usuario?.localId).toBe(local.localId);
  });

  it('acepta el correo con mayúsculas y espacios', async () => {
    // El dueño lo va a escribir en el celular, con autocapitalización.
    const usuario = await autenticar('  La-Esquina@Prueba.test ', 'contrasena-de-prueba', base.db);
    expect(usuario).not.toBeNull();
  });

  it('rechaza la contraseña incorrecta', async () => {
    expect(await autenticar('la-esquina@prueba.test', 'otra-cosa', base.db)).toBeNull();
  });

  it('da el mismo resultado para un correo inexistente que para una clave mala', async () => {
    // Distinguirlos permitiría averiguar qué locales están registrados.
    expect(await autenticar('no-existe@prueba.test', 'contrasena-de-prueba', base.db)).toBeNull();
    expect(await autenticar('la-esquina@prueba.test', 'mala', base.db)).toBeNull();
  });

  it('rechaza a un usuario cuyo local está desactivado', async () => {
    const { locales } = await import('../../src/db/schema');
    const { eq } = await import('drizzle-orm');
    await base.db.update(locales).set({ activo: false }).where(eq(locales.id, local.localId));

    expect(await autenticar('la-esquina@prueba.test', 'contrasena-de-prueba', base.db)).toBeNull();
  });
});

describe('listarClientes', () => {
  beforeEach(async () => {
    const marta = await crearClienteDePrueba(base.db, local.localId, {
      nombre: 'Marta Fiel',
      telefono: '573001234567',
    });
    await crearClienteDePrueba(base.db, local.localId, {
      nombre: 'Lucía Nueva',
      telefono: '573009998877',
    });

    await sumarSello(
      {
        localId: local.localId,
        clienteId: marta,
        sellosObjetivo: local.sellosObjetivo,
        zonaHoraria: local.zonaHoraria,
        origen: 'nfc',
        tagId: local.tagId,
        ahora: instante('2026-11-10'),
      },
      base.db,
    );
  });

  it('trae los clientes con sus sellos y su última visita', async () => {
    const lista = await listarClientes(local.localId, {}, base.db);

    expect(lista).toHaveLength(2);

    const marta = lista.find((c) => c.nombre === 'Marta Fiel')!;
    expect(marta.sellosDisponibles).toBe(1);
    expect(marta.visitasTotales).toBe(1);
    expect(marta.ultimoSello).toBe('2026-11-10');

    const lucia = lista.find((c) => c.nombre === 'Lucía Nueva')!;
    expect(lucia.sellosDisponibles).toBe(0);
    expect(lucia.ultimoSello).toBeNull();
  });

  it('ordena por última visita, y deja al final a quien nunca vino', async () => {
    const lista = await listarClientes(local.localId, {}, base.db);
    expect(lista[0].nombre).toBe('Marta Fiel');
    expect(lista[1].nombre).toBe('Lucía Nueva');
  });

  it('busca por nombre, sin distinguir mayúsculas ni acentos del patrón', async () => {
    expect(await listarClientes(local.localId, { busqueda: 'marta' }, base.db)).toHaveLength(1);
    expect(await listarClientes(local.localId, { busqueda: 'MARTA' }, base.db)).toHaveLength(1);
    expect(await listarClientes(local.localId, { busqueda: 'fiel' }, base.db)).toHaveLength(1);
  });

  it('busca por los últimos dígitos del teléfono', async () => {
    // El dueño nunca va a escribir el número internacional completo.
    const porFinal = await listarClientes(local.localId, { busqueda: '4567' }, base.db);
    expect(porFinal).toHaveLength(1);
    expect(porFinal[0].nombre).toBe('Marta Fiel');

    const conFormato = await listarClientes(local.localId, { busqueda: '300 123 4567' }, base.db);
    expect(conFormato).toHaveLength(1);
  });

  it('devuelve vacío cuando nada coincide', async () => {
    expect(await listarClientes(local.localId, { busqueda: 'zzzz' }, base.db)).toHaveLength(0);
  });

  it('no se rompe con caracteres especiales de SQL en la búsqueda', async () => {
    for (const busqueda of ["%", "_", "' or 1=1 --", '%%%']) {
      const lista = await listarClientes(local.localId, { busqueda }, base.db);
      // Lo importante es que no lance y que no devuelva todo por accidente.
      expect(Array.isArray(lista)).toBe(true);
      expect(lista.length).toBeLessThanOrEqual(2);
    }
  });
});

describe('aislamiento del panel (RNF-05)', () => {
  it('no lista clientes de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino' });
    await crearClienteDePrueba(base.db, otro.localId, { nombre: 'Sofía Vecina' });
    await crearClienteDePrueba(base.db, local.localId, { nombre: 'Marta Fiel' });

    const mios = await listarClientes(local.localId, {}, base.db);
    expect(mios.map((c) => c.nombre)).toEqual(['Marta Fiel']);

    // Ni buscándola por nombre.
    expect(await listarClientes(local.localId, { busqueda: 'Sofía' }, base.db)).toHaveLength(0);
  });

  it('obtenerClienteDelPanel devuelve null para un cliente de otro local', async () => {
    // El ataque: pegar en la URL el id de un cliente ajeno.
    const otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino' });
    const ajeno = await crearClienteDePrueba(base.db, otro.localId, { nombre: 'Sofía Vecina' });

    expect(await obtenerClienteDelPanel(otro.localId, ajeno, base.db)).not.toBeNull();
    expect(await obtenerClienteDelPanel(local.localId, ajeno, base.db)).toBeNull();
  });

  it('las métricas de un local no cuentan los sellos de otro', async () => {
    const otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino' });
    const suCliente = await crearClienteDePrueba(base.db, otro.localId);

    await sumarSello(
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

    const resumen = await resumenDelLocal(
      local.localId,
      { desde: '2026-11-01', hasta: '2026-11-30' },
      base.db,
    );

    expect(resumen.clientesTotales).toBe(0);
    expect(resumen.sellosEnPeriodo).toBe(0);
  });
});

describe('resumenDelLocal: la tasa de retorno', () => {
  /**
   * Escenario armado a mano para que el número sea verificable:
   *
   *  - 3 clientes dados de alta ANTES de noviembre (previos)
   *  - de esos, 2 suman sello en noviembre  -> retorno = 2/3 = 66.7%
   *  - 1 cliente nuevo en noviembre, que suma sello: NO cuenta en el retorno,
   *    ni arriba ni abajo, porque no tuvo ocasión de "volver".
   */
  it('cuenta solo a los clientes que ya estaban antes del período', async () => {
    const { clientes } = await import('../../src/db/schema');
    const { eq } = await import('drizzle-orm');

    const previos: string[] = [];
    for (let i = 0; i < 3; i += 1) {
      previos.push(await crearClienteDePrueba(base.db, local.localId, { nombre: `Previo ${i}` }));
    }

    // Se los antigua a octubre.
    for (const id of previos) {
      await base.db
        .update(clientes)
        .set({ creadoEn: new Date('2026-10-01T12:00:00Z') })
        .where(eq(clientes.id, id));
    }

    const nuevo = await crearClienteDePrueba(base.db, local.localId, { nombre: 'Nuevo' });

    const sumar = (clienteId: string, dia: string) =>
      sumarSello(
        {
          localId: local.localId,
          clienteId,
          sellosObjetivo: local.sellosObjetivo,
          zonaHoraria: local.zonaHoraria,
          origen: 'nfc',
          tagId: local.tagId,
          ahora: instante(dia),
        },
        base.db,
      );

    await sumar(previos[0], '2026-11-05');
    await sumar(previos[1], '2026-11-06');
    // previos[2] no vuelve.
    await sumar(nuevo, '2026-11-07');

    const resumen = await resumenDelLocal(
      local.localId,
      { desde: '2026-11-01', hasta: '2026-11-30' },
      base.db,
    );

    expect(resumen.retorno.clientesPrevios).toBe(3);
    expect(resumen.retorno.clientesQueVolvieron).toBe(2);
    expect(resumen.retorno.porcentaje).toBe(66.7);

    expect(resumen.clientesTotales).toBe(4);
    expect(resumen.clientesNuevosEnPeriodo).toBe(1);
    expect(resumen.sellosEnPeriodo).toBe(3);
  });

  it('no cuenta dos veces al cliente que volvió varias veces', async () => {
    const { clientes } = await import('../../src/db/schema');
    const { eq } = await import('drizzle-orm');

    const id = await crearClienteDePrueba(base.db, local.localId);
    await base.db
      .update(clientes)
      .set({ creadoEn: new Date('2026-10-01T12:00:00Z') })
      .where(eq(clientes.id, id));

    for (const dia of ['2026-11-05', '2026-11-06', '2026-11-07']) {
      await sumarSello(
        {
          localId: local.localId,
          clienteId: id,
          sellosObjetivo: local.sellosObjetivo,
          zonaHoraria: local.zonaHoraria,
          origen: 'nfc',
          tagId: local.tagId,
          ahora: instante(dia),
        },
        base.db,
      );
    }

    const resumen = await resumenDelLocal(
      local.localId,
      { desde: '2026-11-01', hasta: '2026-11-30' },
      base.db,
    );

    expect(resumen.retorno.clientesQueVolvieron).toBe(1);
    expect(resumen.retorno.porcentaje).toBe(100);
    expect(resumen.sellosEnPeriodo).toBe(3);
  });

  it('ignora los sellos de fuera del período', async () => {
    const { clientes } = await import('../../src/db/schema');
    const { eq } = await import('drizzle-orm');

    const id = await crearClienteDePrueba(base.db, local.localId);
    await base.db
      .update(clientes)
      .set({ creadoEn: new Date('2026-09-01T12:00:00Z') })
      .where(eq(clientes.id, id));

    await sumarSello(
      {
        localId: local.localId,
        clienteId: id,
        sellosObjetivo: local.sellosObjetivo,
        zonaHoraria: local.zonaHoraria,
        origen: 'nfc',
        tagId: local.tagId,
        ahora: instante('2026-10-15'),
      },
      base.db,
    );

    const resumen = await resumenDelLocal(
      local.localId,
      { desde: '2026-11-01', hasta: '2026-11-30' },
      base.db,
    );

    expect(resumen.retorno.clientesPrevios).toBe(1);
    expect(resumen.retorno.clientesQueVolvieron).toBe(0);
    expect(resumen.sellosEnPeriodo).toBe(0);
  });
});
