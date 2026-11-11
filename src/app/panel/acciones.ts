'use server';

import { redirect } from 'next/navigation';

import { cerrarSesion, exigirSesion } from '@/lib/cookies-panel';
import { darDeBaja } from '@/servicios/clientes';
import { obtenerClienteDelPanel, obtenerLocalDelPanel } from '@/servicios/panel';
import { canjear, sumarSello } from '@/servicios/sellos';

export async function accionSalir(): Promise<void> {
  await cerrarSesion();
  redirect('/panel/entrar');
}

/**
 * Sumar un sello a mano (RF-16), para cuando el chip falla.
 *
 * El clienteId llega del formulario, así que se comprueba contra el local de
 * la SESIÓN, no contra ningún dato enviado: un dueño no puede sumar sellos a
 * clientes de otro local.
 */
export async function accionSumarSelloManual(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const clienteId = String(datos.get('clienteId') ?? '');

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) redirect('/panel');

  const cliente = await obtenerClienteDelPanel(sesion.localId, clienteId);
  if (!cliente) redirect('/panel/clientes');

  await sumarSello({
    localId: sesion.localId,
    clienteId: cliente.id,
    sellosObjetivo: local.sellosObjetivo,
    zonaHoraria: local.zonaHoraria,
    origen: 'manual',
    usuarioLocalId: sesion.usuarioId,
  });

  redirect(`/panel/clientes/${cliente.id}`);
}

/** Entregar el premio y consumir los sellos (RF-17). */
export async function accionCanjear(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const clienteId = String(datos.get('clienteId') ?? '');

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) redirect('/panel');

  const cliente = await obtenerClienteDelPanel(sesion.localId, clienteId);
  if (!cliente) redirect('/panel/clientes');

  await canjear({
    localId: sesion.localId,
    clienteId: cliente.id,
    sellosObjetivo: local.sellosObjetivo,
    premio: local.premio,
    usuarioLocalId: sesion.usuarioId,
  });

  redirect(`/panel/clientes/${cliente.id}`);
}

/** El cliente pidió no recibir más mensajes (RF-12). */
export async function accionDarDeBaja(datos: FormData): Promise<void> {
  const sesion = await exigirSesion();
  const clienteId = String(datos.get('clienteId') ?? '');

  await darDeBaja(sesion.localId, clienteId);
  redirect(`/panel/clientes/${clienteId}`);
}
