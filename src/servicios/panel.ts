/**
 * Consultas y operaciones del panel del local.
 *
 * Regla sin excepciones (RNF-05): **toda** función recibe `localId` y filtra
 * por él. El `localId` sale solo de la cookie de sesión firmada, nunca de la
 * URL ni de un campo del formulario, así que un dueño no puede pedir datos de
 * otro local cambiando un número.
 */

import { and, count, countDistinct, eq, gte, isNull, lt, lte, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { canjes, clientes, locales, programas, sellos, tags, usuariosLocal } from '../db/schema';
import { diasHastaCumple, type Dia } from '../dominio/fechas';
import {
  calcularTasaRetorno,
  sellosPorCanje,
  type ResumenLocal,
} from '../dominio/metricas';
import { verificarContrasena } from '../lib/contrasena';
import type { BaseDeDatos } from './tipos';

/* ----------------------------------------------------- autenticación */

export interface UsuarioAutenticado {
  usuarioId: string;
  localId: string;
  nombre: string;
  localNombre: string;
  localSlug: string;
}

/**
 * Comprueba las credenciales del panel.
 *
 * Devuelve null tanto si el email no existe como si la contraseña está mal, y
 * sin decir cuál de las dos: distinguirlas permitiría averiguar qué locales
 * están registrados.
 */
export async function autenticar(
  email: string,
  contrasena: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<UsuarioAutenticado | null> {
  const filas = await db
    .select({
      usuarioId: usuariosLocal.id,
      localId: usuariosLocal.localId,
      nombre: usuariosLocal.nombre,
      hash: usuariosLocal.hashContrasena,
      activo: usuariosLocal.activo,
      localNombre: locales.nombre,
      localSlug: locales.slug,
      localActivo: locales.activo,
    })
    .from(usuariosLocal)
    .innerJoin(locales, eq(usuariosLocal.localId, locales.id))
    .where(eq(usuariosLocal.email, email.trim().toLowerCase()))
    .limit(1);

  const usuario = filas[0];

  if (!usuario) {
    // Se verifica contra un hash falso igualmente, para que un email
    // inexistente tarde lo mismo que uno real y no se pueda distinguir por
    // el tiempo de respuesta.
    await verificarContrasena(contrasena, 'scrypt$16384$8$1$c2FsZmFsc2E$aGFzaGZhbHNv');
    return null;
  }

  if (!usuario.activo || !usuario.localActivo) return null;
  if (!(await verificarContrasena(contrasena, usuario.hash))) return null;

  return {
    usuarioId: usuario.usuarioId,
    localId: usuario.localId,
    nombre: usuario.nombre,
    localNombre: usuario.localNombre,
    localSlug: usuario.localSlug,
  };
}

/* ------------------------------------------------------- el local */

export interface LocalDelPanel {
  localId: string;
  slug: string;
  nombre: string;
  whatsapp: string | null;
  googleMapsUrl: string | null;
  lat: string | null;
  lng: string | null;
  zonaHoraria: string;
  sellosObjetivo: number;
  premio: string;
  beneficioBienvenida: string | null;
  semanasInactividad: number;
  diasAntesCumple: number;
}

export async function obtenerLocalDelPanel(
  localId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<LocalDelPanel | null> {
  const filas = await db
    .select({
      localId: locales.id,
      slug: locales.slug,
      nombre: locales.nombre,
      whatsapp: locales.whatsapp,
      googleMapsUrl: locales.googleMapsUrl,
      lat: locales.lat,
      lng: locales.lng,
      zonaHoraria: locales.zonaHoraria,
      sellosObjetivo: programas.sellosObjetivo,
      premio: programas.premio,
      beneficioBienvenida: programas.beneficioBienvenida,
      semanasInactividad: programas.semanasInactividad,
      diasAntesCumple: programas.diasAntesCumple,
    })
    .from(locales)
    .innerJoin(programas, eq(programas.localId, locales.id))
    .where(eq(locales.id, localId))
    .limit(1);

  return filas[0] ?? null;
}

/* ------------------------------------------------------- clientes */

export interface ClienteDelPanel {
  id: string;
  nombre: string;
  telefono: string;
  fechaNacimiento: string | null;
  dadoDeBaja: boolean;
  sellosDisponibles: number;
  visitasTotales: number;
  ultimoSello: Dia | null;
  creadoEn: Date;
}

/**
 * Lista de clientes del local, con su estado (RF-19).
 *
 * `busqueda` filtra por nombre o teléfono. El teléfono se busca por
 * coincidencia parcial porque el dueño va a escribir los últimos cuatro
 * dígitos, no el número internacional completo.
 */
export async function listarClientes(
  localId: string,
  opciones: { busqueda?: string; limite?: number } = {},
  db: BaseDeDatos = dbPorDefecto,
): Promise<ClienteDelPanel[]> {
  const busqueda = opciones.busqueda?.trim();
  const limite = Math.min(opciones.limite ?? 100, 500);

  const condiciones = [eq(clientes.localId, localId)];

  if (busqueda) {
    const patron = `%${busqueda.replace(/[%_]/g, '')}%`;
    const soloDigitos = busqueda.replace(/\D/g, '');
    condiciones.push(
      soloDigitos.length >= 3
        ? sql`(${clientes.nombre} ilike ${patron} or ${clientes.telefono} like ${`%${soloDigitos}%`})`
        : sql`${clientes.nombre} ilike ${patron}`,
    );
  }

  const filas = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      telefono: clientes.telefono,
      fechaNacimiento: clientes.fechaNacimiento,
      bajaEn: clientes.bajaEn,
      creadoEn: clientes.creadoEn,
      sellosDisponibles: sql<number>`
        count(${sellos.id}) filter (where ${sellos.canjeId} is null)::int`,
      visitasTotales: sql<number>`count(${sellos.id})::int`,
      ultimoSello: sql<string | null>`max(${sellos.fecha})`,
    })
    .from(clientes)
    .leftJoin(sellos, eq(sellos.clienteId, clientes.id))
    .where(and(...condiciones))
    .groupBy(clientes.id)
    .orderBy(sql`max(${sellos.fecha}) desc nulls last`)
    .limit(limite);

  return filas.map((f) => ({
    id: f.id,
    nombre: f.nombre,
    telefono: f.telefono,
    fechaNacimiento: f.fechaNacimiento,
    dadoDeBaja: f.bajaEn !== null,
    sellosDisponibles: f.sellosDisponibles,
    visitasTotales: f.visitasTotales,
    ultimoSello: f.ultimoSello,
    creadoEn: f.creadoEn,
  }));
}

/** Un cliente concreto, exigiendo el local. Null si es de otro local. */
export async function obtenerClienteDelPanel(
  localId: string,
  clienteId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ClienteDelPanel | null> {
  const filas = await listarClientes(localId, {}, db);
  return filas.find((c) => c.id === clienteId) ?? null;
}

/* -------------------------------------------------------- métricas */

export interface Periodo {
  /** Primer día incluido */
  desde: Dia;
  /** Último día incluido */
  hasta: Dia;
}

/**
 * El resumen del panel (RF-20, RF-21).
 *
 * La tasa de retorno mide: de los clientes que YA estaban antes de `desde`,
 * cuántos sumaron al menos un sello dentro del período. La definición y el
 * porqué están en `dominio/metricas.ts`.
 */
export async function resumenDelLocal(
  localId: string,
  periodo: Periodo,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResumenLocal & { sellosPorCanje: number | null }> {
  const inicioPeriodo = new Date(`${periodo.desde}T00:00:00Z`);

  const [[totales], [nuevos], [sellosPeriodo], [canjesPeriodo], [previos], [volvieron]] =
    await Promise.all([
      db.select({ n: count() }).from(clientes).where(eq(clientes.localId, localId)),

      db
        .select({ n: count() })
        .from(clientes)
        .where(and(eq(clientes.localId, localId), gte(clientes.creadoEn, inicioPeriodo))),

      db
        .select({ n: count() })
        .from(sellos)
        .where(
          and(
            eq(sellos.localId, localId),
            gte(sellos.fecha, periodo.desde),
            lte(sellos.fecha, periodo.hasta),
          ),
        ),

      db
        .select({ n: count() })
        .from(canjes)
        .where(and(eq(canjes.localId, localId), gte(canjes.creadoEn, inicioPeriodo))),

      // Denominador: clientes dados de alta ANTES del período.
      db
        .select({ n: count() })
        .from(clientes)
        .where(and(eq(clientes.localId, localId), lt(clientes.creadoEn, inicioPeriodo))),

      // Numerador: de esos, los que sumaron algún sello dentro del período.
      db
        .select({ n: countDistinct(sellos.clienteId) })
        .from(sellos)
        .innerJoin(clientes, eq(sellos.clienteId, clientes.id))
        .where(
          and(
            eq(sellos.localId, localId),
            lt(clientes.creadoEn, inicioPeriodo),
            gte(sellos.fecha, periodo.desde),
            lte(sellos.fecha, periodo.hasta),
          ),
        ),
    ]);

  const retorno = calcularTasaRetorno({
    clientesPrevios: previos.n,
    clientesQueVolvieron: volvieron.n,
  });

  return {
    clientesTotales: totales.n,
    clientesNuevosEnPeriodo: nuevos.n,
    sellosEnPeriodo: sellosPeriodo.n,
    canjesEnPeriodo: canjesPeriodo.n,
    retorno,
    sellosPorCanje: sellosPorCanje(sellosPeriodo.n, canjesPeriodo.n),
  };
}

/** Cumpleaños próximos, para la bandeja de la Fase 5 y la vista del panel. */
export async function cumpleanosProximos(
  localId: string,
  hoy: Dia,
  dias: number,
  db: BaseDeDatos = dbPorDefecto,
): Promise<Array<{ id: string; nombre: string; telefono: string; faltan: number }>> {
  const filas = await db
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      telefono: clientes.telefono,
      fechaNacimiento: clientes.fechaNacimiento,
    })
    .from(clientes)
    .where(and(eq(clientes.localId, localId), isNull(clientes.bajaEn)));

  return filas
    .filter((f) => f.fechaNacimiento !== null)
    .map((f) => ({
      id: f.id,
      nombre: f.nombre,
      telefono: f.telefono,
      faltan: diasHastaCumple(f.fechaNacimiento!, hoy),
    }))
    .filter((f) => f.faltan <= dias)
    .sort((a, b) => a.faltan - b.faltan);
}

/* --------------------------------------------------- configuración */

export interface CambiosPrograma {
  sellosObjetivo?: number;
  premio?: string;
  beneficioBienvenida?: string | null;
  semanasInactividad?: number;
  diasAntesCumple?: number;
}

export async function actualizarPrograma(
  localId: string,
  cambios: CambiosPrograma,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const filas = await db
    .update(programas)
    .set(cambios)
    .where(eq(programas.localId, localId))
    .returning({ id: programas.id });

  return filas.length > 0;
}

export interface CambiosLocal {
  nombre?: string;
  whatsapp?: string | null;
  googleMapsUrl?: string | null;
  lat?: string | null;
  lng?: string | null;
}

export async function actualizarLocal(
  localId: string,
  cambios: CambiosLocal,
  db: BaseDeDatos = dbPorDefecto,
): Promise<boolean> {
  const filas = await db
    .update(locales)
    .set(cambios)
    .where(eq(locales.id, localId))
    .returning({ id: locales.id });

  return filas.length > 0;
}

/** Los tags del local, para la página del QR y el alta de chips (RF-30). */
export async function listarTags(localId: string, db: BaseDeDatos = dbPorDefecto) {
  return db
    .select({ id: tags.id, token: tags.token, objeto: tags.objeto, activo: tags.activo })
    .from(tags)
    .where(eq(tags.localId, localId))
    .orderBy(tags.creadoEn);
}
