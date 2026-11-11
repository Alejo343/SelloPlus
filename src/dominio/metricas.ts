/**
 * Las métricas del panel (RF-20, RF-21).
 *
 * La métrica estrella es la **tasa de retorno**, y lo primero que hay que
 * hacer con ella es definirla sin ambigüedad, porque "cuántos clientes
 * volvieron" se puede calcular de cinco formas y cada una da un número
 * distinto. Si el dueño no entiende de dónde sale el número, no confía en él.
 *
 * Definición que usamos:
 *
 *   De los clientes que ya estaban en el club ANTES de que empezara el
 *   período, qué porcentaje sumó al menos un sello DURANTE el período.
 *
 * Por qué así:
 *  - Excluye del denominador a los que se dieron de alta dentro del período.
 *    Un cliente que se unió ayer no "dejó de volver": no ha tenido ocasión.
 *    Incluirlo hundiría la tasa justo en los meses en que el local crece, que
 *    es exactamente cuando el dueño necesita ver que va bien.
 *  - Mide lo que el local puede cambiar: que la gente vuelva.
 */

/** El cálculo es puro: recibe dos conteos y devuelve la tasa. */
export interface DatosRetorno {
  /** Clientes dados de alta antes del inicio del período */
  clientesPrevios: number;
  /** De esos, cuántos sumaron al menos un sello durante el período */
  clientesQueVolvieron: number;
}

export interface TasaRetorno {
  /** Porcentaje entre 0 y 100, redondeado a un decimal */
  porcentaje: number;
  clientesPrevios: number;
  clientesQueVolvieron: number;
  /**
   * False cuando no hay base suficiente para que el número signifique algo.
   * Mostrar "0% de retorno" con 2 clientes es engañoso y asusta al dueño sin
   * motivo; es mejor decir que todavía no hay datos.
   */
  significativa: boolean;
}

/** Por debajo de esto, el porcentaje es ruido. */
export const MINIMO_PARA_TASA = 10;

export function calcularTasaRetorno({
  clientesPrevios,
  clientesQueVolvieron,
}: DatosRetorno): TasaRetorno {
  if (clientesPrevios < 0 || clientesQueVolvieron < 0) {
    throw new Error('Los conteos de clientes no pueden ser negativos');
  }

  if (clientesQueVolvieron > clientesPrevios) {
    throw new Error(
      `Volvieron ${clientesQueVolvieron} de ${clientesPrevios} clientes previos: imposible`,
    );
  }

  const porcentaje =
    clientesPrevios === 0
      ? 0
      : Math.round((clientesQueVolvieron / clientesPrevios) * 1000) / 10;

  return {
    porcentaje,
    clientesPrevios,
    clientesQueVolvieron,
    significativa: clientesPrevios >= MINIMO_PARA_TASA,
  };
}

/* ------------------------------------------------- resumen del panel */

export interface ResumenLocal {
  clientesTotales: number;
  clientesNuevosEnPeriodo: number;
  sellosEnPeriodo: number;
  canjesEnPeriodo: number;
  retorno: TasaRetorno;
}

/**
 * Cuántos sellos hacen falta, en promedio, por premio entregado. Sirve para
 * que el dueño entienda cuánto le cuesta el programa.
 */
export function sellosPorCanje(sellos: number, canjes: number): number | null {
  if (canjes === 0) return null;
  return Math.round((sellos / canjes) * 10) / 10;
}

/**
 * Frase para el panel. El dueño no lee tablas: lee una frase y decide si el
 * programa le sirve.
 */
export function fraseRetorno(retorno: TasaRetorno): string {
  if (retorno.clientesPrevios === 0) {
    return 'Todavía no hay clientes de meses anteriores para medir el retorno.';
  }

  if (!retorno.significativa) {
    return `Volvieron ${retorno.clientesQueVolvieron} de ${retorno.clientesPrevios} clientes. Son pocos todavía para sacar un porcentaje confiable.`;
  }

  return `Volvieron ${retorno.clientesQueVolvieron} de ${retorno.clientesPrevios} clientes: ${retorno.porcentaje}%.`;
}
