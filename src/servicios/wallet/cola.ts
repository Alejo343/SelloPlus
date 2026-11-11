/**
 * La cola de sincronización con Google Wallet.
 *
 * Por qué existe: sumar un sello corre delante del cliente, con el mozo
 * esperando, y tiene que responder en menos de 1,5 s (RNF-01). Google es un
 * servicio externo que puede tardar o estar caído, y además no tiene SLA
 * oficial. Si el tap esperara a Google, un mal día de Google sería un mal día
 * del restaurante.
 *
 * Así que el sello se guarda primero y el wallet se actualiza después. La
 * tarjeta del celular puede quedar unos segundos desactualizada; el sello, no.
 */

import { and, asc, eq, isNull, lt, sql } from 'drizzle-orm';

import { db as dbPorDefecto } from '../../db';
import { clientes, colaWallet, locales, programas, tarjetas } from '../../db/schema';
import { calcularEstado } from '../../dominio/sellos';
import { contarSellosDisponibles } from '../sellos';
import type { BaseDeDatos } from '../tipos';
import { issuerIdActual, obtenerEmisor } from './emisor';

/** Tras cuántos intentos fallidos se deja de reintentar. */
export const MAXIMO_INTENTOS = 5;

export type TipoSincronizacion = 'crear_clase' | 'crear_objeto' | 'actualizar_sellos';

/**
 * Encola un cambio.
 *
 * Es idempotente por diseño: hay un índice único parcial que solo permite un
 * pendiente por destinatario y tipo. Si el cliente suma un sello hoy y otro
 * mañana antes de que la cola se procese, no se encolan dos actualizaciones,
 * porque la única que hay ya mandará el total correcto cuando corra.
 *
 * Usa `on conflict do nothing` y NO un try/catch alrededor del insert. La
 * diferencia importa: en PostgreSQL, un statement que falla **aborta toda la
 * transacción**, así que capturar la violación de unicidad no sirve de nada
 * cuando se encola dentro de una transacción, como hace el canje. Con
 * `on conflict` el conflicto deja de ser un error y no hay nada que abortar.
 */
export async function encolar(
  opciones: {
    localId: string;
    clienteId?: string | null;
    tipo: TipoSincronizacion;
  },
  db: BaseDeDatos = dbPorDefecto,
): Promise<void> {
  await db
    .insert(colaWallet)
    .values({
      localId: opciones.localId,
      clienteId: opciones.clienteId ?? null,
      tipo: opciones.tipo,
    })
    .onConflictDoNothing();
}

export interface ResultadoProceso {
  procesados: number;
  fallidos: number;
  omitidos: number;
}

/**
 * Procesa los pendientes.
 *
 * La llama el script `scripts/procesar-wallet.ts`, que corre por cron. No se
 * llama desde el tap: ese solo encola.
 */
export async function procesarCola(
  opciones: { limite?: number } = {},
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoProceso> {
  const emisor = obtenerEmisor();
  const issuerId = issuerIdActual();
  const limite = opciones.limite ?? 50;

  const pendientes = await db
    .select()
    .from(colaWallet)
    .where(and(eq(colaWallet.estado, 'pendiente'), lt(colaWallet.intentos, MAXIMO_INTENTOS)))
    .orderBy(asc(colaWallet.creadoEn))
    .limit(limite);

  let procesados = 0;
  let fallidos = 0;
  let omitidos = 0;

  for (const item of pendientes) {
    try {
      const hecho = await ejecutar(item, issuerId, emisor, db);

      if (hecho) {
        await db
          .update(colaWallet)
          .set({ estado: 'hecha', procesadoEn: new Date() })
          .where(eq(colaWallet.id, item.id));
        procesados += 1;
      } else {
        // No había nada que hacer (por ejemplo, el cliente ya no existe).
        await db
          .update(colaWallet)
          .set({ estado: 'hecha', procesadoEn: new Date(), ultimoError: 'sin efecto' })
          .where(eq(colaWallet.id, item.id));
        omitidos += 1;
      }
    } catch (error) {
      const intentos = item.intentos + 1;
      const mensaje = error instanceof Error ? error.message : String(error);

      await db
        .update(colaWallet)
        .set({
          intentos,
          ultimoError: mensaje.slice(0, 500),
          // Se marca como fallida solo al agotar los intentos: así un corte de
          // red de un minuto no deja la tarjeta desincronizada para siempre.
          estado: intentos >= MAXIMO_INTENTOS ? 'fallida' : 'pendiente',
        })
        .where(eq(colaWallet.id, item.id));

      fallidos += 1;
    }
  }

  return { procesados, fallidos, omitidos };
}

/** Devuelve false si el cambio ya no tiene sentido (datos borrados). */
async function ejecutar(
  item: typeof colaWallet.$inferSelect,
  issuerId: string,
  emisor: ReturnType<typeof obtenerEmisor>,
  db: BaseDeDatos,
): Promise<boolean> {
  const [local] = await db
    .select({
      localId: locales.id,
      nombre: locales.nombre,
      slug: locales.slug,
      lat: locales.lat,
      lng: locales.lng,
      whatsapp: locales.whatsapp,
      logoUrl: locales.logoUrl,
      colorPrimario: locales.colorPrimario,
      sellosObjetivo: programas.sellosObjetivo,
      premio: programas.premio,
    })
    .from(locales)
    .innerJoin(programas, eq(programas.localId, locales.id))
    .where(eq(locales.id, item.localId))
    .limit(1);

  if (!local) return false;

  if (item.tipo === 'crear_clase') {
    await emisor.guardarClase({
      issuerId,
      localId: local.localId,
      localNombre: local.nombre,
      premio: local.premio,
      sellosObjetivo: local.sellosObjetivo,
      lat: local.lat,
      lng: local.lng,
      whatsapp: local.whatsapp,
      logoUrl: local.logoUrl,
      colorPrimario: local.colorPrimario,
    });
    return true;
  }

  if (!item.clienteId) return false;

  const [cliente] = await db
    .select({ id: clientes.id, nombre: clientes.nombre })
    .from(clientes)
    .where(and(eq(clientes.id, item.clienteId), eq(clientes.localId, item.localId)))
    .limit(1);

  if (!cliente) return false;

  const estado = calcularEstado(
    await contarSellosDisponibles(cliente.id, db),
    local.sellosObjetivo,
  );

  if (item.tipo === 'actualizar_sellos') {
    await emisor.actualizarSellos({
      issuerId,
      clienteId: cliente.id,
      estado,
      premio: local.premio,
    });
    return true;
  }

  // crear_objeto
  const base = process.env.URL_PUBLICA ?? 'http://localhost:3011';
  const { enlace } = await emisor.crearObjeto({
    issuerId,
    localId: local.localId,
    clienteId: cliente.id,
    clienteNombre: cliente.nombre,
    estado,
    premio: local.premio,
    urlTarjeta: `${base}/c/${local.slug}/tarjeta`,
  });

  // Se registra la tarjeta para no volver a crearla y para saber si se logró
  // reflejar el estado.
  await db
    .insert(tarjetas)
    .values({
      clienteId: cliente.id,
      plataforma: 'google',
      serial: enlace,
      sincronizadoEn: new Date(),
    })
    .onConflictDoUpdate({
      target: [tarjetas.clienteId, tarjetas.plataforma],
      set: { serial: enlace, sincronizadoEn: new Date() },
    });

  return true;
}

/** Para el panel: cuántos cambios están esperando y cuántos fallaron. */
export async function estadoDeLaCola(localId: string, db: BaseDeDatos = dbPorDefecto) {
  const [fila] = await db
    .select({
      pendientes: sql<number>`count(*) filter (where ${colaWallet.estado} = 'pendiente')::int`,
      fallidos: sql<number>`count(*) filter (where ${colaWallet.estado} = 'fallida')::int`,
    })
    .from(colaWallet)
    .where(eq(colaWallet.localId, localId));

  return fila ?? { pendientes: 0, fallidos: 0 };
}

/** El enlace guardado para añadir la tarjeta, si ya se generó. */
export async function enlaceDeTarjeta(
  clienteId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<string | null> {
  const filas = await db
    .select({ serial: tarjetas.serial })
    .from(tarjetas)
    .where(and(eq(tarjetas.clienteId, clienteId), eq(tarjetas.plataforma, 'google')))
    .limit(1);

  return filas[0]?.serial ?? null;
}

/** Clientes sin tarjeta creada todavía, para diagnóstico. */
export async function clientesSinTarjeta(localId: string, db: BaseDeDatos = dbPorDefecto) {
  return db
    .select({ id: clientes.id, nombre: clientes.nombre })
    .from(clientes)
    .leftJoin(tarjetas, eq(tarjetas.clienteId, clientes.id))
    .where(and(eq(clientes.localId, localId), isNull(tarjetas.id)));
}
