/**
 * Procesa la cola de sincronización con Google Wallet.
 *
 * Pensado para correr por cron, cada minuto:
 *   * * * * * cd /ruta/al/proyecto && npm run wallet:procesar >> /var/log/selloplus-wallet.log 2>&1
 *
 * Es seguro ejecutarlo de nuevo si falla: la cola solo marca como hecho lo que
 * se completó, y reintenta lo demás hasta cinco veces.
 */

import 'dotenv/config';

import { crearConexion } from '../src/db';
import { obtenerEmisor } from '../src/servicios/wallet/emisor';
import { procesarCola } from '../src/servicios/wallet/cola';

async function principal() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('Falta DATABASE_URL en el .env');

  const { cliente: sql, db } = crearConexion(url, 2);
  const emisor = obtenerEmisor();

  try {
    const resultado = await procesarCola({ limite: 200 }, db);

    const modo = emisor.real ? 'Google (real)' : 'SIMULADO (sin credenciales)';
    console.log(
      `[${new Date().toISOString()}] modo=${modo} ` +
        `procesados=${resultado.procesados} fallidos=${resultado.fallidos} ` +
        `omitidos=${resultado.omitidos}`,
    );

    if (!emisor.real && resultado.procesados > 0) {
      console.log(
        '  Nada se envió a Google: falta configurar WALLET_ISSUER_ID, ' +
          'WALLET_CUENTA_SERVICIO_EMAIL y WALLET_CLAVE_PRIVADA en el .env.',
      );
    }
  } finally {
    await sql.end();
  }
}

principal().catch((error) => {
  console.error('Falló el proceso de la cola:', error);
  process.exit(1);
});
