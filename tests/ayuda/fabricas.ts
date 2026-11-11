/**
 * Fábricas para las pruebas de integración: crean locales y clientes con
 * valores por defecto razonables, para que cada prueba solo mencione lo que
 * de verdad le importa.
 */

import { clientes, locales, programas, tags, usuariosLocal } from '../../src/db/schema';
import type { BaseDeDatos } from '../../src/servicios/tipos';

export interface LocalDePrueba {
  localId: string;
  slug: string;
  tagId: string;
  tagToken: string;
  usuarioLocalId: string;
  sellosObjetivo: number;
  premio: string;
  zonaHoraria: string;
}

export async function crearLocalDePrueba(
  db: BaseDeDatos,
  opciones: {
    slug?: string;
    sellosObjetivo?: number;
    premio?: string;
    zonaHoraria?: string;
    tagActivo?: boolean;
  } = {},
): Promise<LocalDePrueba> {
  const slug = opciones.slug ?? `local-${Math.random().toString(36).slice(2, 10)}`;
  const sellosObjetivo = opciones.sellosObjetivo ?? 10;
  const premio = opciones.premio ?? 'Una cena para dos';
  const zonaHoraria = opciones.zonaHoraria ?? 'America/Bogota';

  const [local] = await db
    .insert(locales)
    .values({ slug, nombre: slug, zonaHoraria })
    .returning({ id: locales.id });

  await db.insert(programas).values({ localId: local.id, sellosObjetivo, premio });

  const [usuario] = await db
    .insert(usuariosLocal)
    .values({
      localId: local.id,
      email: `${slug}@prueba.test`,
      hashContrasena: 'pendiente-fase-3',
      nombre: `Dueño de ${slug}`,
    })
    .returning({ id: usuariosLocal.id });

  const tagToken = `tag-${slug}`;
  const [tag] = await db
    .insert(tags)
    .values({
      localId: local.id,
      token: tagToken,
      objeto: 'Tag de prueba',
      activo: opciones.tagActivo ?? true,
    })
    .returning({ id: tags.id });

  return {
    localId: local.id,
    slug,
    tagId: tag.id,
    tagToken,
    usuarioLocalId: usuario.id,
    sellosObjetivo,
    premio,
    zonaHoraria,
  };
}

export async function crearClienteDePrueba(
  db: BaseDeDatos,
  localId: string,
  opciones: {
    nombre?: string;
    telefono?: string;
    fechaNacimiento?: string | null;
    dadoDeBaja?: boolean;
  } = {},
): Promise<string> {
  const [cliente] = await db
    .insert(clientes)
    .values({
      localId,
      nombre: opciones.nombre ?? 'Cliente de prueba',
      telefono: opciones.telefono ?? `5730012${Math.floor(Math.random() * 90000) + 10000}`,
      fechaNacimiento: opciones.fechaNacimiento ?? null,
      consentimientoEn: new Date(),
      consentimientoVersion: 'prueba-v1',
      bajaEn: opciones.dadoDeBaja ? new Date() : null,
    })
    .returning({ id: clientes.id });

  return cliente.id;
}

/** Un instante concreto, para no depender del reloj. */
export function instante(dia: string, hora = '15:00:00'): Date {
  // 15:00 UTC es media mañana en Bogotá: lejos de cualquier medianoche.
  return new Date(`${dia}T${hora}Z`);
}
