/**
 * Sumar sellos y canjear premios.
 *
 * Es el servicio más delicado del sistema, porque corre delante del cliente y
 * porque un error acá regala premios o pierde visitas.
 *
 * La defensa de "un sello por día" es doble, y las dos capas hacen falta:
 *  1. La comprobación del dominio da un mensaje claro ("vuelve mañana").
 *  2. La restricción única de la base garantiza el resultado cuando dos taps
 *     llegan a la vez y las dos comprobaciones pasan.
 */

import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../db';
import { esViolacionUnica } from '../db/errores';
import { canjes, clientes, sellos, tags } from '../db/schema';
import { diaEnZona, type Dia } from '../dominio/fechas';
import {
  calcularEstado,
  puedeCanjear,
  puedeSumarSello,
  type EstadoClub,
  type MotivoRechazo,
} from '../dominio/sellos';
import type { BaseDeDatos } from './tipos';
import { encolar } from './wallet/cola';

/* ------------------------------------------------------- estado del club */

/** Cuántos sellos tiene disponibles (los que no consumió ningún canje). */
export async function contarSellosDisponibles(
  clienteId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<number> {
  const [fila] = await db
    .select({ total: sql<number>`count(*)::int` })
    .from(sellos)
    .where(and(eq(sellos.clienteId, clienteId), isNull(sellos.canjeId)));

  return fila?.total ?? 0;
}

/** El día del último sello del cliente, o null si nunca sumó. */
export async function ultimoDiaConSello(
  clienteId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<Dia | null> {
  const filas = await db
    .select({ fecha: sellos.fecha })
    .from(sellos)
    .where(eq(sellos.clienteId, clienteId))
    .orderBy(desc(sellos.fecha))
    .limit(1);

  return filas[0]?.fecha ?? null;
}

export async function estadoDelClub(
  clienteId: string,
  sellosObjetivo: number,
  db: BaseDeDatos = dbPorDefecto,
): Promise<EstadoClub> {
  return calcularEstado(await contarSellosDisponibles(clienteId, db), sellosObjetivo);
}

/* ---------------------------------------------------------- sumar sello */

export interface OpcionesSumarSello {
  localId: string;
  clienteId: string;
  sellosObjetivo: number;
  zonaHoraria: string;
  origen: 'nfc' | 'qr' | 'manual';
  tagId?: string | null;
  contadorChip?: number | null;
  usuarioLocalId?: string | null;
  ip?: string | null;
  /** Para fijar el instante en las pruebas */
  ahora?: Date;
}

export type ResultadoSumarSello =
  | { resultado: 'sumado'; estado: EstadoClub; dia: Dia }
  | { resultado: 'rechazado'; motivo: MotivoRechazo; estado: EstadoClub };

/**
 * Suma un sello al cliente, si corresponde.
 *
 * Nunca lanza por un segundo sello del mismo día: eso es un caso esperado del
 * negocio, no un error, y se devuelve como 'rechazado' con el motivo.
 */
export async function sumarSello(
  opciones: OpcionesSumarSello,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoSumarSello> {
  const ahora = opciones.ahora ?? new Date();
  const hoy = diaEnZona(ahora, opciones.zonaHoraria);

  const [cliente] = await db
    .select({ bajaEn: clientes.bajaEn })
    .from(clientes)
    .where(and(eq(clientes.id, opciones.clienteId), eq(clientes.localId, opciones.localId)))
    .limit(1);

  if (!cliente) {
    throw new Error(
      `El cliente ${opciones.clienteId} no pertenece al local ${opciones.localId}`,
    );
  }

  let tagActivo: boolean | undefined;
  if (opciones.tagId) {
    const [tag] = await db
      .select({ activo: tags.activo })
      .from(tags)
      .where(and(eq(tags.id, opciones.tagId), eq(tags.localId, opciones.localId)))
      .limit(1);
    tagActivo = tag?.activo ?? false;
  }

  const ultimoSello = await ultimoDiaConSello(opciones.clienteId, db);

  const decision = puedeSumarSello({
    ultimoSello,
    hoy,
    tagActivo,
    dadoDeBaja: cliente.bajaEn !== null,
  });

  if (!decision.puede) {
    return {
      resultado: 'rechazado',
      motivo: decision.motivo,
      estado: await estadoDelClub(opciones.clienteId, opciones.sellosObjetivo, db),
    };
  }

  try {
    await db.insert(sellos).values({
      localId: opciones.localId,
      clienteId: opciones.clienteId,
      fecha: hoy,
      origen: opciones.origen,
      tagId: opciones.tagId ?? null,
      contadorChip: opciones.contadorChip ?? null,
      usuarioLocalId: opciones.usuarioLocalId ?? null,
      ip: opciones.ip ?? null,
    });
  } catch (error) {
    // Dos taps simultáneos: la comprobación de arriba pasó en los dos, pero la
    // base solo deja entrar uno. El segundo recibe el mismo mensaje que si la
    // comprobación lo hubiera atrapado, que es lo que el cliente espera ver.
    if (esViolacionUnica(error, 'sellos_cliente_fecha_unico')) {
      return {
        resultado: 'rechazado',
        motivo: 'ya_sumo_hoy',
        estado: await estadoDelClub(opciones.clienteId, opciones.sellosObjetivo, db),
      };
    }
    throw error;
  }

  const estado = await estadoDelClub(opciones.clienteId, opciones.sellosObjetivo, db);

  /**
   * Se encola, no se llama a Google: el tap corre delante del cliente y
   * Google no tiene SLA. El sello ya está guardado; la tarjeta del wallet se
   * actualiza unos segundos después (ver servicios/wallet/cola.ts).
   */
  await encolar(
    { localId: opciones.localId, clienteId: opciones.clienteId, tipo: 'actualizar_sellos' },
    db,
  );

  return { resultado: 'sumado', estado, dia: hoy };
}

/* --------------------------------------------------------------- canjear */

export interface OpcionesCanje {
  localId: string;
  clienteId: string;
  sellosObjetivo: number;
  premio: string;
  usuarioLocalId?: string | null;
}

export type ResultadoCanje =
  | { resultado: 'canjeado'; canjeId: string; estado: EstadoClub }
  | { resultado: 'sellos_insuficientes'; faltan: number; estado: EstadoClub };

/**
 * Canjea el premio y consume exactamente `sellosObjetivo` sellos, los más
 * antiguos primero.
 *
 * Todo en una transacción con los sellos bloqueados (`for update`): si dos
 * cajeros canjean a la vez, el segundo encuentra los sellos ya consumidos y
 * recibe 'sellos_insuficientes' en lugar de regalar dos premios.
 */
export async function canjear(
  opciones: OpcionesCanje,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoCanje> {
  const ejecutar = async (tx: BaseDeDatos): Promise<ResultadoCanje> => {
    const disponibles = await tx
      .select({ id: sellos.id })
      .from(sellos)
      .where(
        and(
          eq(sellos.clienteId, opciones.clienteId),
          eq(sellos.localId, opciones.localId),
          isNull(sellos.canjeId),
        ),
      )
      .orderBy(sellos.fecha)
      .for('update');

    const decision = puedeCanjear(disponibles.length, opciones.sellosObjetivo);

    if (!decision.puede) {
      return {
        resultado: 'sellos_insuficientes',
        faltan: decision.faltan,
        estado: calcularEstado(disponibles.length, opciones.sellosObjetivo),
      };
    }

    const [canje] = await tx
      .insert(canjes)
      .values({
        localId: opciones.localId,
        clienteId: opciones.clienteId,
        premio: opciones.premio,
        sellosUsados: decision.sellosAUsar,
        usuarioLocalId: opciones.usuarioLocalId ?? null,
      })
      .returning({ id: canjes.id });

    const aConsumir = disponibles.slice(0, decision.sellosAUsar).map((s) => s.id);

    await tx.update(sellos).set({ canjeId: canje.id }).where(inArray(sellos.id, aConsumir));

    // El canje baja los sellos: la tarjeta del wallet tiene que reflejarlo.
    await encolar(
      { localId: opciones.localId, clienteId: opciones.clienteId, tipo: 'actualizar_sellos' },
      tx,
    );

    return {
      resultado: 'canjeado',
      canjeId: canje.id,
      estado: calcularEstado(disponibles.length - decision.sellosAUsar, opciones.sellosObjetivo),
    };
  };

  // Si ya venimos dentro de una transacción, no se abre otra.
  if ('transaction' in db && typeof db.transaction === 'function') {
    return db.transaction(ejecutar);
  }
  return ejecutar(db);
}
