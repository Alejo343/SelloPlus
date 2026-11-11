/**
 * El tipo de la conexión que reciben los servicios.
 *
 * Todos los servicios aceptan la base como último argumento, con la conexión
 * real por defecto. Eso permite que las pruebas de integración les pasen la
 * conexión a `fidelizacion_test`, y que dentro de una transacción se les pase
 * la transacción, sin inyección de dependencias ni mocks.
 */

import type { db } from '../db';

export type BaseDeDatos = typeof db | Parameters<Parameters<typeof db.transaction>[0]>[0];
