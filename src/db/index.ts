/**
 * Conexión a PostgreSQL.
 *
 * Se conecta por socket Unix local, así que no hay contraseña que guardar:
 * el sistema operativo ya autentica al usuario `claude`. Eso también significa
 * que la base no está expuesta a la red.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

import * as schema from './schema';

export const urlBaseDeDatos =
  process.env.DATABASE_URL ?? 'postgres:///fidelizacion_dev?host=/var/run/postgresql';

/**
 * `max: 1` en las pruebas para que las transacciones de aislamiento no se
 * repartan entre conexiones distintas.
 */
export function crearConexion(url: string = urlBaseDeDatos, max = 10) {
  const cliente = postgres(url, { max });
  return { cliente, db: drizzle(cliente, { schema }) };
}

const global_ = globalThis as unknown as {
  __conexionFidelizacion?: ReturnType<typeof crearConexion>;
};

/** Reutiliza la conexión entre recargas del servidor de desarrollo. */
const conexion = (global_.__conexionFidelizacion ??= crearConexion());

export const db = conexion.db;
export const clienteSql = conexion.cliente;
export { schema };
