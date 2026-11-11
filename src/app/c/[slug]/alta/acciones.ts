'use server';

/**
 * La acción que da de alta al cliente en el club.
 *
 * Es una Server Action, así que es alcanzable por POST directo y no solo
 * desde el formulario: todo lo que llega se valida de nuevo acá, incluido el
 * slug del local, y nada se confía al cliente.
 */

import { redirect } from 'next/navigation';

import { recordarCliente } from '@/lib/cookies-cliente';
import { altaCliente } from '@/servicios/clientes';
import { sumarSello } from '@/servicios/sellos';
import { resolverLocalPorSlug, resolverTag } from '@/servicios/tags';
import { encolar } from '@/servicios/wallet/cola';

export interface EstadoFormulario {
  errores?: Record<string, string>;
  /** Para no perder lo que el cliente ya escribió cuando hay un error */
  valores?: { nombre: string; telefono: string; fechaNacimiento: string };
}

export async function accionAlta(
  _anterior: EstadoFormulario,
  datos: FormData,
): Promise<EstadoFormulario> {
  const slug = String(datos.get('slug') ?? '');
  const token = String(datos.get('token') ?? '');

  const valores = {
    nombre: String(datos.get('nombre') ?? ''),
    telefono: String(datos.get('telefono') ?? ''),
    fechaNacimiento: String(datos.get('fechaNacimiento') ?? ''),
  };

  const local = await resolverLocalPorSlug(slug);
  if (!local) {
    return { errores: { general: 'Este local no está disponible.' }, valores };
  }

  // El tag solo sirve para registrar de dónde vino el cliente y para sumarle
  // el sello de esta visita. Si no cuadra con el local, se ignora en vez de
  // fallar: lo importante es que el cliente entre al club.
  const tag = token ? await resolverTag(token) : null;
  const tagValido = tag && tag.localId === local.localId && tag.tagActivo ? tag : null;

  const resultado = await altaCliente({
    localId: local.localId,
    datos: {
      nombre: valores.nombre,
      telefono: valores.telefono,
      fechaNacimiento: valores.fechaNacimiento,
      // La casilla solo llega cuando está marcada. Ausente = no aceptado.
      consentimiento: datos.get('consentimiento') === 'si',
    },
  });

  if (!resultado.ok) {
    return { errores: resultado.errores, valores };
  }

  await recordarCliente(local.localSlug, {
    clienteId: resultado.cliente.id,
    localId: local.localId,
  });

  /**
   * Se prepara su tarjeta de Google Wallet. La clase del local se encola
   * también: es idempotente, así que no importa que se encole en cada alta, y
   * garantiza que exista antes del primer objeto que la referencia.
   */
  if (!resultado.yaExistia) {
    await encolar({ localId: local.localId, tipo: 'crear_clase' });
    await encolar({
      localId: local.localId,
      clienteId: resultado.cliente.id,
      tipo: 'crear_objeto',
    });
  }

  // El cliente acaba de apoyar el celular: esta visita cuenta. Si ya tenía
  // sello hoy, `sumarSello` lo rechaza solo y no pasa nada.
  if (tagValido) {
    await sumarSello({
      localId: local.localId,
      clienteId: resultado.cliente.id,
      sellosObjetivo: local.sellosObjetivo,
      zonaHoraria: local.zonaHoraria,
      origen: 'nfc',
      tagId: tagValido.tagId,
    });
  }

  redirect(`/c/${local.localSlug}/tarjeta`);
}
