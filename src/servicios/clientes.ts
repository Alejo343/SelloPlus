/**
 * Alta y búsqueda de clientes.
 *
 * Reglas legales que se aplican acá y no se pueden saltar:
 *  - RL-01: sin consentimiento explícito no se guarda nada.
 *  - RL-02: se guarda la fecha y la versión del texto aceptado.
 */

import { and, eq } from 'drizzle-orm';
import { z } from 'zod';

import { db as dbPorDefecto } from '../db';
import { esViolacionUnica } from '../db/errores';
import { clientes, type Cliente } from '../db/schema';
import { esDiaValido } from '../dominio/fechas';
import { normalizarTelefono, type Indicativo } from '../dominio/telefono';
import type { BaseDeDatos } from './tipos';

export const VERSION_CONSENTIMIENTO = process.env.CONSENTIMIENTO_VERSION ?? '2026-11-v1';

/**
 * Validación de lo que llega del formulario público. Es una entrada abierta a
 * internet detrás de un QR pegado en una mesa (RNF-07), así que no se confía
 * en nada.
 */
export const esquemaAlta = z.object({
  nombre: z
    .string()
    .trim()
    .min(2, 'Necesitamos tu nombre')
    .max(80, 'El nombre es demasiado largo'),
  telefono: z.string().trim().min(1, 'Necesitamos tu teléfono'),
  /** Opcional: en los reels piden nombre, teléfono y cumpleaños, el email no siempre */
  email: z.string().trim().email('Ese correo no parece válido').max(120).optional().or(z.literal('')),
  /** 'YYYY-MM-DD'. Opcional, pero sin ella no hay saludo de cumpleaños. */
  fechaNacimiento: z.string().trim().optional().or(z.literal('')),
  /**
   * RL-01: tiene que llegar explícitamente en true. Un checkbox no marcado no
   * manda nada, así que el valor ausente se trata como rechazo.
   */
  consentimiento: z.literal(true, {
    message: 'Hace falta aceptar el tratamiento de datos para unirte al club',
  }),
});

export type DatosAlta = z.infer<typeof esquemaAlta>;

export type ResultadoAlta =
  | { ok: true; cliente: Cliente; yaExistia: boolean }
  | { ok: false; errores: Record<string, string> };

export interface OpcionesAlta {
  localId: string;
  datos: unknown;
  /** De dónde viene: el token del tag, 'qr' o 'panel' */
  origen?: string;
  /** Indicativo por defecto, según el país del local */
  indicativo?: Indicativo;
  /** Para poder fijar el instante en las pruebas */
  ahora?: Date;
}

/**
 * Da de alta un cliente en un local.
 *
 * Es idempotente a propósito: si el teléfono ya está en ese local, devuelve el
 * cliente existente con `yaExistia: true` en vez de fallar. El caso real es el
 * cliente que vuelve, apoya el celular, no lo reconocemos porque borró las
 * cookies, y rellena el formulario otra vez. Rechazarlo con "ya estás
 * registrado" lo dejaría sin su sello.
 */
export async function altaCliente(
  opciones: OpcionesAlta,
  db: BaseDeDatos = dbPorDefecto,
): Promise<ResultadoAlta> {
  const validacion = esquemaAlta.safeParse(opciones.datos);

  if (!validacion.success) {
    const errores: Record<string, string> = {};
    for (const problema of validacion.error.issues) {
      const campo = String(problema.path[0] ?? 'general');
      errores[campo] ??= problema.message;
    }
    return { ok: false, errores };
  }

  const { nombre, telefono: telefonoCrudo, email, fechaNacimiento } = validacion.data;

  const telefono = normalizarTelefono(telefonoCrudo, opciones.indicativo);
  if (!telefono.valido) {
    const mensajes = {
      vacio: 'Necesitamos tu teléfono',
      muy_corto: 'Ese número parece incompleto',
      muy_largo: 'Ese número tiene demasiados dígitos',
      caracteres_invalidos: 'El teléfono solo puede tener números',
    } as const;
    return { ok: false, errores: { telefono: mensajes[telefono.motivo] } };
  }

  if (fechaNacimiento && !esDiaValido(fechaNacimiento)) {
    return { ok: false, errores: { fechaNacimiento: 'Esa fecha no existe' } };
  }

  const ahora = opciones.ahora ?? new Date();

  try {
    const [cliente] = await db
      .insert(clientes)
      .values({
        localId: opciones.localId,
        nombre,
        telefono: telefono.telefono,
        email: email ? email : null,
        fechaNacimiento: fechaNacimiento ? fechaNacimiento : null,
        consentimientoEn: ahora,
        consentimientoVersion: VERSION_CONSENTIMIENTO,
        origen: opciones.origen ?? null,
      })
      .returning();

    return { ok: true, cliente, yaExistia: false };
  } catch (error) {
    if (esViolacionUnica(error, 'clientes_local_telefono_unico')) {
      const existente = await buscarPorTelefono(opciones.localId, telefono.telefono, db);
      if (existente) return { ok: true, cliente: existente, yaExistia: true };
    }
    throw error;
  }
}

/** Busca por teléfono dentro de un local. Normaliza antes de buscar. */
export async function buscarPorTelefono(
  localId: string,
  telefonoCrudo: string,
  db: BaseDeDatos = dbPorDefecto,
  indicativo?: Indicativo,
): Promise<Cliente | null> {
  const telefono = normalizarTelefono(telefonoCrudo, indicativo);
  if (!telefono.valido) return null;

  const filas = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.localId, localId), eq(clientes.telefono, telefono.telefono)))
    .limit(1);

  return filas[0] ?? null;
}

/**
 * Busca por id, pero EXIGIENDO el local.
 *
 * El parámetro `localId` no es opcional a propósito (RNF-05): obliga a que
 * cualquier lectura de un cliente diga en qué local la espera, y hace
 * imposible leer por accidente un cliente de otro local a partir de un id
 * suelto que venga de una cookie o de una URL.
 */
export async function obtenerCliente(
  localId: string,
  clienteId: string,
  db: BaseDeDatos = dbPorDefecto,
): Promise<Cliente | null> {
  const filas = await db
    .select()
    .from(clientes)
    .where(and(eq(clientes.id, clienteId), eq(clientes.localId, localId)))
    .limit(1);

  return filas[0] ?? null;
}

/** RF-12: el cliente pide no recibir más mensajes. No se borra el registro. */
export async function darDeBaja(
  localId: string,
  clienteId: string,
  db: BaseDeDatos = dbPorDefecto,
  ahora: Date = new Date(),
): Promise<boolean> {
  const filas = await db
    .update(clientes)
    .set({ bajaEn: ahora })
    .where(and(eq(clientes.id, clienteId), eq(clientes.localId, localId)))
    .returning({ id: clientes.id });

  return filas.length > 0;
}
