/**
 * Reconocimiento de errores de PostgreSQL.
 *
 * Drizzle envuelve el error original: su `message` dice solo "Failed query",
 * y el código real queda en `cause`. Comprobar el código es además más robusto
 * que comparar textos, que cambian entre versiones del motor.
 */

export const CODIGO_PG = {
  UNICO: '23505',
  NO_NULO: '23502',
  FORANEA: '23503',
} as const;

interface ErrorPg {
  code?: string;
  constraint_name?: string;
  constraint?: string;
}

function desenvolver(error: unknown): ErrorPg {
  const causa = (error as { cause?: unknown } | null)?.cause ?? error;
  return (causa ?? {}) as ErrorPg;
}

/**
 * Si el error es una violación de restricción única. Con `restriccion`, exige
 * además que sea esa restricción en concreto: así un error inesperado no se
 * confunde con el caso que sí sabemos manejar.
 */
export function esViolacionUnica(error: unknown, restriccion?: string): boolean {
  const pg = desenvolver(error);
  if (pg.code !== CODIGO_PG.UNICO) return false;
  if (!restriccion) return true;
  return (pg.constraint_name ?? pg.constraint) === restriccion;
}
