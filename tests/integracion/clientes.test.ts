import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { clientes } from '../../src/db/schema';
import {
  altaCliente,
  buscarPorTelefono,
  darDeBaja,
  obtenerCliente,
} from '../../src/servicios/clientes';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import { crearLocalDePrueba, instante, type LocalDePrueba } from '../ayuda/fabricas';

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
  local = await crearLocalDePrueba(base.db);
});

const DATOS_VALIDOS = {
  nombre: 'Marta Fiel',
  telefono: '300 123 4567',
  fechaNacimiento: '1985-03-14',
  consentimiento: true as const,
};

describe('altaCliente: validación', () => {
  it('da de alta con los datos mínimos y normaliza el teléfono', async () => {
    const resultado = await altaCliente(
      { localId: local.localId, datos: DATOS_VALIDOS, origen: local.tagToken },
      base.db,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.yaExistia).toBe(false);
    expect(resultado.cliente.telefono).toBe('573001234567');
    expect(resultado.cliente.nombre).toBe('Marta Fiel');
    expect(resultado.cliente.origen).toBe(local.tagToken);
  });

  it('acepta un cliente sin fecha de nacimiento ni email', async () => {
    const resultado = await altaCliente(
      {
        localId: local.localId,
        datos: { nombre: 'Lucía Nueva', telefono: '3009998877', consentimiento: true },
      },
      base.db,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.cliente.fechaNacimiento).toBeNull();
    expect(resultado.cliente.email).toBeNull();
  });

  it('rechaza un nombre demasiado corto', async () => {
    const resultado = await altaCliente(
      { localId: local.localId, datos: { ...DATOS_VALIDOS, nombre: 'M' } },
      base.db,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores.nombre).toMatch(/nombre/i);
  });

  it('rechaza un teléfono con letras', async () => {
    const resultado = await altaCliente(
      { localId: local.localId, datos: { ...DATOS_VALIDOS, telefono: 'no tengo' } },
      base.db,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores.telefono).toMatch(/números/i);
  });

  it('rechaza una fecha de nacimiento que no existe', async () => {
    const resultado = await altaCliente(
      { localId: local.localId, datos: { ...DATOS_VALIDOS, fechaNacimiento: '2026-02-30' } },
      base.db,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores.fechaNacimiento).toMatch(/no existe/i);
  });

  it('devuelve todos los errores de una vez, no de a uno', async () => {
    const resultado = await altaCliente(
      { localId: local.localId, datos: { nombre: '', telefono: '', consentimiento: true } },
      base.db,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(Object.keys(resultado.errores).sort()).toEqual(['nombre', 'telefono']);
  });
});

describe('altaCliente: el consentimiento es obligatorio (RL-01)', () => {
  it('no guarda nada si el consentimiento no llega', async () => {
    const { consentimiento: _sin, ...sinConsentimiento } = DATOS_VALIDOS;

    const resultado = await altaCliente(
      { localId: local.localId, datos: sinConsentimiento },
      base.db,
    );

    expect(resultado.ok).toBe(false);
    if (resultado.ok) return;
    expect(resultado.errores.consentimiento).toMatch(/tratamiento de datos/i);
    // Lo importante: no quedó ningún registro.
    expect(await base.db.select().from(clientes)).toHaveLength(0);
  });

  it('no guarda nada si el consentimiento llega en false', async () => {
    // Un checkbox sin marcar no manda valor, pero un cliente de API podría
    // mandar false explícitamente: se trata igual.
    const resultado = await altaCliente(
      { localId: local.localId, datos: { ...DATOS_VALIDOS, consentimiento: false } },
      base.db,
    );

    expect(resultado.ok).toBe(false);
    expect(await base.db.select().from(clientes)).toHaveLength(0);
  });

  it('guarda la fecha y la versión del texto aceptado (RL-02)', async () => {
    const momento = instante('2026-11-10');

    const resultado = await altaCliente(
      { localId: local.localId, datos: DATOS_VALIDOS, ahora: momento },
      base.db,
    );

    expect(resultado.ok).toBe(true);
    if (!resultado.ok) return;
    expect(resultado.cliente.consentimientoEn).toEqual(momento);
    expect(resultado.cliente.consentimientoVersion).toBeTruthy();
  });
});

describe('altaCliente es idempotente', () => {
  it('devuelve el cliente existente si el teléfono ya está en el local', async () => {
    // El caso real: el cliente vuelve, borró las cookies, no lo reconocemos y
    // rellena el formulario otra vez. Rechazarlo lo dejaría sin su sello.
    const primera = await altaCliente({ localId: local.localId, datos: DATOS_VALIDOS }, base.db);
    const segunda = await altaCliente({ localId: local.localId, datos: DATOS_VALIDOS }, base.db);

    expect(primera.ok && segunda.ok).toBe(true);
    if (!primera.ok || !segunda.ok) return;

    expect(segunda.yaExistia).toBe(true);
    expect(segunda.cliente.id).toBe(primera.cliente.id);
    expect(await base.db.select().from(clientes)).toHaveLength(1);
  });

  it('reconoce el mismo número escrito de otra forma', async () => {
    const primera = await altaCliente(
      { localId: local.localId, datos: { ...DATOS_VALIDOS, telefono: '3001234567' } },
      base.db,
    );
    const segunda = await altaCliente(
      { localId: local.localId, datos: { ...DATOS_VALIDOS, telefono: '+57 300 123-4567' } },
      base.db,
    );

    expect(primera.ok && segunda.ok).toBe(true);
    if (!primera.ok || !segunda.ok) return;
    expect(segunda.cliente.id).toBe(primera.cliente.id);
  });

  it('dos altas simultáneas del mismo teléfono crean un solo cliente', async () => {
    const opciones = { localId: local.localId, datos: DATOS_VALIDOS };

    const resultados = await Promise.all([
      altaCliente(opciones, base.db),
      altaCliente(opciones, base.db),
    ]);

    expect(resultados.every((r) => r.ok)).toBe(true);
    expect(await base.db.select().from(clientes)).toHaveLength(1);
  });
});

describe('aislamiento entre locales (RNF-05)', () => {
  it('el mismo teléfono puede estar en dos locales como clientes distintos', async () => {
    const otro = await crearLocalDePrueba(base.db);

    const enA = await altaCliente({ localId: local.localId, datos: DATOS_VALIDOS }, base.db);
    const enB = await altaCliente({ localId: otro.localId, datos: DATOS_VALIDOS }, base.db);

    expect(enA.ok && enB.ok).toBe(true);
    if (!enA.ok || !enB.ok) return;
    expect(enA.cliente.id).not.toBe(enB.cliente.id);
  });

  it('buscarPorTelefono no encuentra al cliente de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db);
    await altaCliente({ localId: local.localId, datos: DATOS_VALIDOS }, base.db);

    expect(await buscarPorTelefono(local.localId, '3001234567', base.db)).not.toBeNull();
    expect(await buscarPorTelefono(otro.localId, '3001234567', base.db)).toBeNull();
  });

  it('obtenerCliente no devuelve un cliente de otro local, ni con su id exacto', async () => {
    // El ataque: una cookie con el id de un cliente de otro local.
    const otro = await crearLocalDePrueba(base.db);
    const alta = await altaCliente({ localId: otro.localId, datos: DATOS_VALIDOS }, base.db);
    expect(alta.ok).toBe(true);
    if (!alta.ok) return;

    expect(await obtenerCliente(otro.localId, alta.cliente.id, base.db)).not.toBeNull();
    expect(await obtenerCliente(local.localId, alta.cliente.id, base.db)).toBeNull();
  });
});

describe('darDeBaja: RF-12', () => {
  it('marca la baja sin borrar el registro', async () => {
    const alta = await altaCliente({ localId: local.localId, datos: DATOS_VALIDOS }, base.db);
    expect(alta.ok).toBe(true);
    if (!alta.ok) return;

    expect(await darDeBaja(local.localId, alta.cliente.id, base.db)).toBe(true);

    const [fila] = await base.db
      .select()
      .from(clientes)
      .where(eq(clientes.id, alta.cliente.id));

    // El registro sigue: hace falta para demostrar el consentimiento y para
    // no volver a escribirle por error si se registra de nuevo.
    expect(fila).toBeDefined();
    expect(fila.bajaEn).toBeInstanceOf(Date);
  });

  it('no deja dar de baja a un cliente de otro local', async () => {
    const otro = await crearLocalDePrueba(base.db);
    const alta = await altaCliente({ localId: otro.localId, datos: DATOS_VALIDOS }, base.db);
    expect(alta.ok).toBe(true);
    if (!alta.ok) return;

    expect(await darDeBaja(local.localId, alta.cliente.id, base.db)).toBe(false);
  });
});
