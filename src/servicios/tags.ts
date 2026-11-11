/**
 * Resolución de tags.
 *
 * Un tap llega como /t/[token]. A partir de ese token hay que saber a qué
 * local pertenece y con qué programa trabaja, en una sola consulta: esto corre
 * delante del cliente con el mozo esperando, y el objetivo es responder en
 * menos de 1,5 s en 4G (RNF-01).
 */

import { eq } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { locales, programas, tags } from '../db/schema';
import type { BaseDeDatos } from './tipos';

export interface TagResuelto {
  tagId: string;
  tagActivo: boolean;
  objeto: string | null;
  ultimoContador: number | null;
  localId: string;
  localSlug: string;
  localNombre: string;
  zonaHoraria: string;
  sellosObjetivo: number;
  premio: string;
  beneficioBienvenida: string | null;
  semanasInactividad: number;
  diasAntesCumple: number;
}

/**
 * Devuelve el tag con todo lo que hace falta para procesar el tap, o null si
 * el token no existe o su local está desactivado.
 *
 * Un tag inactivo SÍ se devuelve, con `tagActivo: false`, para poder darle un
 * mensaje útil al cliente ("este código ya no está activo") en vez de un 404
 * que lo deje sin saber qué pasó.
 */
export async function resolverTag(
  token: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<TagResuelto | null> {
  const filas = await db
    .select({
      tagId: tags.id,
      tagActivo: tags.activo,
      objeto: tags.objeto,
      ultimoContador: tags.ultimoContador,
      localId: locales.id,
      localSlug: locales.slug,
      localNombre: locales.nombre,
      zonaHoraria: locales.zonaHoraria,
      localActivo: locales.activo,
      sellosObjetivo: programas.sellosObjetivo,
      premio: programas.premio,
      beneficioBienvenida: programas.beneficioBienvenida,
      semanasInactividad: programas.semanasInactividad,
      diasAntesCumple: programas.diasAntesCumple,
    })
    .from(tags)
    .innerJoin(locales, eq(tags.localId, locales.id))
    .innerJoin(programas, eq(programas.localId, locales.id))
    .where(eq(tags.token, token))
    .limit(1);

  const fila = filas[0];
  if (!fila) return null;

  // Un local desactivado no atiende: se trata como si el tag no existiera.
  if (!fila.localActivo) return null;

  const { localActivo: _descartado, ...resuelto } = fila;
  return resuelto;
}

/**
 * Lo mismo pero a partir del slug del local, para el QR impreso y los enlaces
 * /c/[slug] que no pasan por un tag concreto.
 */
export async function resolverLocalPorSlug(
  slug: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<Omit<TagResuelto, 'tagId' | 'tagActivo' | 'objeto' | 'ultimoContador'> | null> {
  const filas = await db
    .select({
      localId: locales.id,
      localSlug: locales.slug,
      localNombre: locales.nombre,
      zonaHoraria: locales.zonaHoraria,
      localActivo: locales.activo,
      sellosObjetivo: programas.sellosObjetivo,
      premio: programas.premio,
      beneficioBienvenida: programas.beneficioBienvenida,
      semanasInactividad: programas.semanasInactividad,
      diasAntesCumple: programas.diasAntesCumple,
    })
    .from(locales)
    .innerJoin(programas, eq(programas.localId, locales.id))
    .where(eq(locales.slug, slug))
    .limit(1);

  const fila = filas[0];
  if (!fila || !fila.localActivo) return null;

  const { localActivo: _descartado, ...resuelto } = fila;
  return resuelto;
}
