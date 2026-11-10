/**
 * Aplica las migraciones pendientes.
 *
 *   npm run db:migrate          -> base de desarrollo
 *   npm run db:migrate:test     -> base de pruebas
 *
 * Es la misma función que usan las pruebas de integración para levantar un
 * esquema limpio, así que si funciona acá, funciona ahí.
 */

import 'dotenv/config';

import { migrate } from 'drizzle-orm/postgres-js/migrator';

import { crearConexion } from '../src/db';

export async function migrarBase(url: string) {
  const { cliente, db } = crearConexion(url, 1);
  try {
    await migrate(db, { migrationsFolder: './drizzle' });
  } finally {
    await cliente.end();
  }
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const url = process.env.OBJETIVO === 'test' ? process.env.DATABASE_URL_TEST : process.env.DATABASE_URL;

  if (!url) {
    console.error('Falta DATABASE_URL (o DATABASE_URL_TEST con OBJETIVO=test) en el .env');
    process.exit(1);
  }

  migrarBase(url)
    .then(() => {
      console.log(`Migraciones aplicadas en ${url.split('?')[0]}`);
      process.exit(0);
    })
    .catch((error) => {
      console.error('Falló la migración:', error);
      process.exit(1);
    });
}
