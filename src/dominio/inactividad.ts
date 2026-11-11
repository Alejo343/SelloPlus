/**
 * A quién hay que escribirle hoy, y por qué.
 *
 * Son las reglas que deciden la bandeja de pendientes del panel (RF-26). Acá
 * solo se decide; el armado del texto y el envío son de la Fase 5.
 *
 * Funciones puras sobre días fijos: nunca leen el reloj. El día de hoy se pasa
 * como argumento, para que las pruebas no se rompan solas al cambiar el mes.
 */

import { diasEntre, diasHastaCumple, type Dia } from './fechas';

export interface ClienteParaEvaluar {
  /** Día del último sello, o null si nunca sumó */
  ultimoSello: Dia | null;
  /** Null si no lo dio */
  fechaNacimiento: Dia | null;
  /** True si pidió la baja (RN-08) */
  dadoDeBaja: boolean;
}

export interface ReglasDelPrograma {
  /** Semanas sin sellos para considerarlo inactivo (RN-06) */
  semanasInactividad: number;
  /** Días de anticipación del saludo de cumpleaños (RN-05) */
  diasAntesCumple: number;
}

/**
 * RN-06. Un cliente que nunca sumó un sello NO cuenta como inactivo: no se
 * "perdió", simplemente no ha venido. Escribirle un "hace mucho que no vienes"
 * a alguien que nunca vino queda mal y es la clase de detalle que hace que un
 * local deje de confiar en el sistema.
 */
export function estaInactivo(
  cliente: ClienteParaEvaluar,
  hoy: Dia,
  reglas: ReglasDelPrograma,
): boolean {
  if (cliente.dadoDeBaja) return false;
  if (cliente.ultimoSello === null) return false;

  const diasSinVenir = diasEntre(cliente.ultimoSello, hoy);
  return diasSinVenir >= reglas.semanasInactividad * 7;
}

/**
 * RN-05: el saludo se manda unos días ANTES, para que el cliente tenga tiempo
 * de usar la promoción, no el mismo día cuando ya hizo planes.
 */
export function cumpleEnVentana(
  cliente: ClienteParaEvaluar,
  hoy: Dia,
  reglas: ReglasDelPrograma,
): boolean {
  if (cliente.dadoDeBaja) return false;
  if (cliente.fechaNacimiento === null) return false;

  const faltan = diasHastaCumple(cliente.fechaNacimiento, hoy);
  return faltan >= 0 && faltan <= reglas.diasAntesCumple;
}

export type MotivoMensaje = 'cumpleanos' | 'inactividad';

/**
 * Por qué hay que escribirle hoy a este cliente. Puede ser por más de un
 * motivo, o por ninguno.
 *
 * El cumpleaños va primero a propósito: si alguien está inactivo Y cumple
 * años, el saludo es mejor excusa para volver que un "te echamos de menos".
 */
export function motivosParaEscribir(
  cliente: ClienteParaEvaluar,
  hoy: Dia,
  reglas: ReglasDelPrograma,
): MotivoMensaje[] {
  if (cliente.dadoDeBaja) return [];

  const motivos: MotivoMensaje[] = [];
  if (cumpleEnVentana(cliente, hoy, reglas)) motivos.push('cumpleanos');
  if (estaInactivo(cliente, hoy, reglas)) motivos.push('inactividad');
  return motivos;
}
