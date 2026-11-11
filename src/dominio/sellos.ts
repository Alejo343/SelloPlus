/**
 * Las reglas del club: cuándo se puede sumar un sello, cuántos faltan para el
 * premio y cuándo se puede canjear.
 *
 * Son funciones puras. No tocan la base de datos ni HTTP: reciben datos y
 * devuelven una decisión. Eso permite probar todos los casos borde en
 * milisegundos, y es donde vive el valor del producto.
 */

import type { Dia } from './fechas';

/** Lo que ve el cliente en su tarjeta (RF-06). */
export interface EstadoClub {
  /** Sellos disponibles, es decir, los que todavía no se canjearon */
  sellos: number;
  objetivo: number;
  /** Cuántos le faltan para el premio. 0 si ya llegó. */
  faltan: number;
  premioDisponible: boolean;
}

export function calcularEstado(sellosDisponibles: number, objetivo: number): EstadoClub {
  if (objetivo < 1) {
    throw new Error(`El objetivo de sellos debe ser al menos 1, llegó ${objetivo}`);
  }

  const sellos = Math.max(0, sellosDisponibles);
  return {
    sellos,
    objetivo,
    faltan: Math.max(0, objetivo - sellos),
    premioDisponible: sellos >= objetivo,
  };
}

/* ------------------------------------------------------- sumar un sello */

export type MotivoRechazo = 'ya_sumo_hoy' | 'tag_inactivo' | 'cliente_dado_de_baja';

export type DecisionSello =
  | { puede: true }
  | { puede: false; motivo: MotivoRechazo };

export interface ContextoSello {
  /** Día del último sello del cliente, o null si nunca sumó */
  ultimoSello: Dia | null;
  /** Día de hoy en la zona horaria del local */
  hoy: Dia;
  /** Si el tag usado está activo */
  tagActivo?: boolean;
  /** Si el cliente pidió la baja del club */
  dadoDeBaja?: boolean;
}

/**
 * RN-01: un sello por cliente por día.
 *
 * Esta función es la primera línea de defensa, pero no la única: la base de
 * datos tiene una restricción única sobre (cliente, día) que atrapa el caso de
 * dos taps simultáneos, donde esta comprobación pasaría dos veces. Las dos
 * capas son necesarias: esta da un mensaje claro, la otra da la garantía.
 */
export function puedeSumarSello(contexto: ContextoSello): DecisionSello {
  if (contexto.tagActivo === false) {
    return { puede: false, motivo: 'tag_inactivo' };
  }

  if (contexto.dadoDeBaja === true) {
    return { puede: false, motivo: 'cliente_dado_de_baja' };
  }

  if (contexto.ultimoSello === contexto.hoy) {
    return { puede: false, motivo: 'ya_sumo_hoy' };
  }

  return { puede: true };
}

/* ------------------------------------------------------------ el canje */

export type DecisionCanje =
  | { puede: true; sellosAUsar: number }
  | { puede: false; motivo: 'sellos_insuficientes'; faltan: number };

/**
 * RN-02: se canjea solo con el objetivo cumplido, y se consumen exactamente
 * `objetivo` sellos, no todos los que tenga.
 *
 * Importa para el cliente con 12 sellos y objetivo 10: canjea y le quedan 2 a
 * favor, en vez de perderlos. Es lo que hace que siga sumando después del
 * primer premio.
 */
export function puedeCanjear(sellosDisponibles: number, objetivo: number): DecisionCanje {
  const estado = calcularEstado(sellosDisponibles, objetivo);

  if (!estado.premioDisponible) {
    return { puede: false, motivo: 'sellos_insuficientes', faltan: estado.faltan };
  }

  return { puede: true, sellosAUsar: objetivo };
}

/* ---------------------------------------------- resultado de un tap */

/** Lo que hay que mostrarle al cliente después de apoyar el celular (RF-07). */
export type ResultadoTap =
  | { tipo: 'cliente_nuevo' }
  | { tipo: 'sello_sumado'; estado: EstadoClub }
  | { tipo: 'ya_sumo_hoy'; estado: EstadoClub }
  | { tipo: 'rechazado'; motivo: MotivoRechazo };

/** El mensaje que ve el cliente, en las palabras de los reels. */
export function mensajeDelTap(resultado: ResultadoTap): string {
  switch (resultado.tipo) {
    case 'cliente_nuevo':
      return 'Ya registramos tu visita. Déjanos tus datos para sumar el sello.';

    case 'sello_sumado':
      return resultado.estado.premioDisponible
        ? '¡Sumaste tu sello y ya tienes premio disponible!'
        : `¡Sumaste tu sello! Te ${resultado.estado.faltan === 1 ? 'falta' : 'faltan'} ${resultado.estado.faltan} para el premio.`;

    case 'ya_sumo_hoy':
      return 'Ya sumaste tu visita de hoy. Vuelve mañana para sumar otro sello.';

    case 'rechazado':
      return resultado.motivo === 'tag_inactivo'
        ? 'Este código ya no está activo. Pídele ayuda al personal del local.'
        : 'No pudimos sumar tu sello. Pídele ayuda al personal del local.';
  }
}
