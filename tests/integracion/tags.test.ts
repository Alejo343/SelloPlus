import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';

import { locales } from '../../src/db/schema';
import { resolverLocalPorSlug, resolverTag } from '../../src/servicios/tags';
import { abrirBaseDePruebas, type BaseDePruebas } from '../ayuda/base';
import { crearLocalDePrueba, type LocalDePrueba } from '../ayuda/fabricas';

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
  local = await crearLocalDePrueba(base.db, {
    slug: 'la-esquina',
    sellosObjetivo: 10,
    premio: 'Una cena para dos',
  });
});

describe('resolverTag', () => {
  it('trae el tag con el local y el programa en una sola consulta', async () => {
    const resuelto = await resolverTag(local.tagToken, base.db);

    expect(resuelto).not.toBeNull();
    expect(resuelto).toMatchObject({
      tagId: local.tagId,
      tagActivo: true,
      localId: local.localId,
      localSlug: 'la-esquina',
      zonaHoraria: 'America/Bogota',
      sellosObjetivo: 10,
      premio: 'Una cena para dos',
    });
  });

  it('devuelve null para un token que no existe', async () => {
    expect(await resolverTag('token-inventado', base.db)).toBeNull();
  });

  it('devuelve el tag inactivo en vez de null, para poder dar un mensaje útil', async () => {
    // Un 404 dejaría al cliente sin saber qué pasó; así se le puede decir
    // "este código ya no está activo, pide ayuda al personal".
    const otro = await crearLocalDePrueba(base.db, { tagActivo: false });
    const resuelto = await resolverTag(otro.tagToken, base.db);

    expect(resuelto).not.toBeNull();
    expect(resuelto?.tagActivo).toBe(false);
  });

  it('devuelve null si el local está desactivado', async () => {
    // Un local que dejó de pagar no atiende: el tag se trata como inexistente.
    await base.db.update(locales).set({ activo: false }).where(eq(locales.id, local.localId));

    expect(await resolverTag(local.tagToken, base.db)).toBeNull();
  });

  it('no confunde los tags de dos locales', async () => {
    const otro = await crearLocalDePrueba(base.db, { slug: 'cafe-vecino', sellosObjetivo: 6 });

    const unTag = await resolverTag(local.tagToken, base.db);
    const otroTag = await resolverTag(otro.tagToken, base.db);

    expect(unTag?.localId).toBe(local.localId);
    expect(otroTag?.localId).toBe(otro.localId);
    expect(unTag?.sellosObjetivo).toBe(10);
    expect(otroTag?.sellosObjetivo).toBe(6);
  });
});

describe('resolverLocalPorSlug', () => {
  it('trae el local y su programa a partir del slug', async () => {
    const resuelto = await resolverLocalPorSlug('la-esquina', base.db);

    expect(resuelto).toMatchObject({
      localId: local.localId,
      localSlug: 'la-esquina',
      sellosObjetivo: 10,
    });
  });

  it('devuelve null para un slug inexistente o un local desactivado', async () => {
    expect(await resolverLocalPorSlug('no-existe', base.db)).toBeNull();

    await base.db.update(locales).set({ activo: false }).where(eq(locales.id, local.localId));
    expect(await resolverLocalPorSlug('la-esquina', base.db)).toBeNull();
  });
});
