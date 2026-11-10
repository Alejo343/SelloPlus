/**
 * Utilidades para las pruebas de integración.
 *
 * Reglas (PLAN.md §Estrategia de pruebas):
 *  - Se usa SIEMPRE la base de pruebas, nunca la de desarrollo. Si la URL no
 *    termina en `fidelizacion_test`, se aborta: es la salvaguarda contra
 *    borrar datos reales por un .env mal puesto.
 *  - Cada archivo de pruebas limpia las tablas antes de empezar.
 */

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { crearConexion } from '../../src/db';

const urlPruebas = process.env.DATABASE_URL_TEST;

if (!urlPruebas) {
  throw new Error('Falta DATABASE_URL_TEST en el .env');
}

if (!urlPruebas.split('?')[0].endsWith('fidelizacion_test')) {
  throw new Error(
    `DATABASE_URL_TEST apunta a "${urlPruebas.split('?')[0]}", que no es la base de pruebas. ` +
      'Las pruebas borran tablas: se aborta por seguridad.',
  );
}

export const URL_PRUEBAS = urlPruebas;

/** Abre una conexión a la base de pruebas con el esquema al día. */
export async function abrirBaseDePruebas() {
  const { cliente, db } = crearConexion(URL_PRUEBAS, 1);
  await migrate(db, { migrationsFolder: './drizzle' });
  return {
    db,
    cliente,
    /** Deja todas las tablas vacías. */
    async limpiar() {
      await cliente`truncate table sellos, canjes, mensajes, alertas_fraude, tarjetas,
                                   clientes, tags, plantillas, programas, usuarios_local, locales
                             restart identity cascade`;
    },
    async cerrar() {
      await cliente.end();
    },
  };
}

export type BaseDePruebas = Awaited<ReturnType<typeof abrirBaseDePruebas>>;

/** Códigos de error de PostgreSQL que nos interesan. */
export const ERROR_PG = {
  /** Violación de restricción única */
  UNICO: '23505',
  /** Columna NOT NULL sin valor */
  NO_NULO: '23502',
  /** Clave foránea inexistente */
  FORANEA: '23503',
} as const;

/**
 * Ejecuta algo que debe fallar y devuelve el código de error de PostgreSQL y
 * el nombre de la restricción.
 *
 * Hace falta porque Drizzle envuelve el error original: su `message` dice solo
 * "Failed query: ...", y el código real queda en `cause`. Comprobar el código
 * es además más robusto que comparar textos, que cambian entre versiones.
 */
export async function capturarErrorPg(
  accion: () => Promise<unknown>,
): Promise<{ codigo?: string; restriccion?: string }> {
  try {
    await accion();
  } catch (error) {
    const causa = (error as { cause?: unknown }).cause ?? error;
    const { code, constraint_name, constraint } = causa as {
      code?: string;
      constraint_name?: string;
      constraint?: string;
    };
    return { codigo: code, restriccion: constraint_name ?? constraint };
  }
  throw new Error('Se esperaba que la operación fallara, pero funcionó.');
}
