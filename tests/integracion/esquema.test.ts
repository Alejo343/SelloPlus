/**
 * Pruebas del esquema.
 *
 * No prueban código nuestro: prueban que la BASE DE DATOS hace cumplir las
 * reglas que no podemos dejar solo en el código. Si alguien cambia el esquema
 * y rompe una de estas garantías, estas pruebas lo atrapan antes de que la
 * lógica de la Fase 1 se apoye en algo que ya no es cierto.
 */

import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clientes, locales, programas, sellos } from '../../src/db/schema';
import {
  abrirBaseDePruebas,
  capturarErrorPg,
  ERROR_PG,
  type BaseDePruebas,
} from '../ayuda/base';

let base: BaseDePruebas;

beforeAll(async () => {
  base = await abrirBaseDePruebas();
});

afterAll(async () => {
  await base.cerrar();
});

beforeEach(async () => {
  await base.limpiar();
});

/** Crea un local con su programa y devuelve el id. */
async function crearLocal(slug: string) {
  const [local] = await base.db
    .insert(locales)
    .values({ slug, nombre: slug })
    .returning();
  await base.db.insert(programas).values({ localId: local.id, premio: 'Premio de prueba' });
  return local.id;
}

async function crearCliente(localId: string, telefono: string, nombre = 'Cliente') {
  const [cliente] = await base.db
    .insert(clientes)
    .values({
      localId,
      nombre,
      telefono,
      consentimientoEn: new Date(),
      consentimientoVersion: 'prueba-v1',
    })
    .returning();
  return cliente.id;
}

describe('RN-01: un sello por cliente por día', () => {
  it('rechaza un segundo sello del mismo cliente en el mismo día', async () => {
    const localId = await crearLocal('local-a');
    const clienteId = await crearCliente(localId, '573001234567');

    await base.db
      .insert(sellos)
      .values({ localId, clienteId, fecha: '2026-11-10', origen: 'nfc' });

    const error = await capturarErrorPg(() =>
      base.db.insert(sellos).values({ localId, clienteId, fecha: '2026-11-10', origen: 'nfc' }),
    );

    expect(error.codigo).toBe(ERROR_PG.UNICO);
    expect(error.restriccion).toBe('sellos_cliente_fecha_unico');
  });

  it('permite sellos del mismo cliente en días distintos', async () => {
    const localId = await crearLocal('local-a');
    const clienteId = await crearCliente(localId, '573001234567');

    await base.db.insert(sellos).values([
      { localId, clienteId, fecha: '2026-11-10', origen: 'nfc' },
      { localId, clienteId, fecha: '2026-11-11', origen: 'nfc' },
    ]);

    const filas = await base.db.select().from(sellos);
    expect(filas).toHaveLength(2);
  });

  it('solo uno de dos sellos simultáneos del mismo día sobrevive', async () => {
    // Esta es la prueba que justifica que la regla viva en la base: simula el
    // mozo que apoya el chip dos veces seguidas, o el doble toque del cliente.
    const localId = await crearLocal('local-a');
    const clienteId = await crearCliente(localId, '573001234567');

    const insertar = () =>
      base.db.insert(sellos).values({ localId, clienteId, fecha: '2026-11-10', origen: 'nfc' });

    const resultados = await Promise.allSettled([insertar(), insertar(), insertar()]);

    expect(resultados.filter((r) => r.status === 'fulfilled')).toHaveLength(1);
    expect(resultados.filter((r) => r.status === 'rejected')).toHaveLength(2);

    const filas = await base.db.select().from(sellos);
    expect(filas).toHaveLength(1);
  });
});

describe('RN-03: los locales no se cruzan', () => {
  it('permite el mismo teléfono en dos locales distintos', async () => {
    const localA = await crearLocal('local-a');
    const localB = await crearLocal('local-b');

    await crearCliente(localA, '573001234567', 'Marta en A');
    await crearCliente(localB, '573001234567', 'Marta en B');

    const filas = await base.db.select().from(clientes);
    expect(filas).toHaveLength(2);
  });

  it('rechaza el mismo teléfono dos veces en el mismo local', async () => {
    const localId = await crearLocal('local-a');
    await crearCliente(localId, '573001234567');

    const error = await capturarErrorPg(() => crearCliente(localId, '573001234567'));

    expect(error.codigo).toBe(ERROR_PG.UNICO);
    expect(error.restriccion).toBe('clientes_local_telefono_unico');
  });

  it('cada cliente y cada sello declara su local, para poder filtrar sin join', async () => {
    const localA = await crearLocal('local-a');
    const localB = await crearLocal('local-b');
    const clienteA = await crearCliente(localA, '573001111111');
    const clienteB = await crearCliente(localB, '573002222222');

    await base.db.insert(sellos).values([
      { localId: localA, clienteId: clienteA, fecha: '2026-11-10', origen: 'nfc' },
      { localId: localB, clienteId: clienteB, fecha: '2026-11-10', origen: 'nfc' },
    ]);

    const soloA = await base.db.select().from(sellos).where(eq(sellos.localId, localA));
    expect(soloA).toHaveLength(1);
    expect(soloA[0].clienteId).toBe(clienteA);
  });
});

describe('RL-01 y RL-02: el consentimiento no es opcional', () => {
  it('no se puede guardar un cliente sin consentimiento', async () => {
    const localId = await crearLocal('local-a');

    const error = await capturarErrorPg(() =>
      base.db.insert(clientes).values({
        localId,
        nombre: 'Sin consentimiento',
        telefono: '573009999999',
        // Faltan consentimientoEn y consentimientoVersion a propósito.
      } as never),
    );

    expect(error.codigo).toBe(ERROR_PG.NO_NULO);
  });

  it('guarda la versión del texto aceptado, para poder demostrar qué aceptó', async () => {
    const localId = await crearLocal('local-a');
    const clienteId = await crearCliente(localId, '573001234567');

    const [fila] = await base.db.select().from(clientes);
    expect(fila.id).toBe(clienteId);
    expect(fila.consentimientoVersion).toBe('prueba-v1');
    expect(fila.consentimientoEn).toBeInstanceOf(Date);
  });
});
