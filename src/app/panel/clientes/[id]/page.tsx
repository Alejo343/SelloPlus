/**
 * Un cliente visto desde el panel: /panel/clientes/[id]
 *
 * Es la pantalla que el cajero usa cuando el chip falla (RF-16) y cuando hay
 * que entregar un premio (RF-17).
 *
 * El id viene de la URL, así que se busca SIEMPRE exigiendo el local de la
 * sesión: pedir el id de un cliente de otro local da 404, no sus datos.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { calcularEstado } from '@/dominio/sellos';
import { formatearParaMostrar } from '@/dominio/telefono';
import { exigirSesion } from '@/lib/cookies-panel';
import { obtenerClienteDelPanel, obtenerLocalDelPanel } from '@/servicios/panel';

import { accionCanjear, accionDarDeBaja, accionSumarSelloManual } from '../../acciones';

export default async function PaginaCliente({ params }: PageProps<'/panel/clientes/[id]'>) {
  const sesion = await exigirSesion();
  const { id } = await params;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const cliente = await obtenerClienteDelPanel(sesion.localId, id);
  if (!cliente) notFound();

  const estado = calcularEstado(cliente.sellosDisponibles, local.sellosObjetivo);

  return (
    <main>
      <p>
        <Link href="/panel/clientes">← Volver a mis clientes</Link>
      </p>

      <h1>{cliente.nombre}</h1>

      <ul>
        <li>WhatsApp: {formatearParaMostrar(cliente.telefono)}</li>
        <li>Cumpleaños: {cliente.fechaNacimiento ?? 'no lo dio'}</li>
        <li>
          Sellos: {estado.sellos} de {estado.objetivo}
          {estado.premioDisponible && ' — premio disponible'}
        </li>
        <li>Visitas totales: {cliente.visitasTotales}</li>
        <li>Última visita: {cliente.ultimoSello ?? 'nunca'}</li>
        <li>En el club desde: {cliente.creadoEn.toISOString().slice(0, 10)}</li>
        {cliente.dadoDeBaja && <li>Pidió no recibir más mensajes</li>}
      </ul>

      {estado.premioDisponible ? (
        <section>
          <h2>Entregar el premio</h2>
          <p>
            Tiene derecho a: <strong>{local.premio}</strong>
          </p>
          <form action={accionCanjear}>
            <input type="hidden" name="clienteId" value={cliente.id} />
            <button type="submit">Entregué el premio, descontar {estado.objetivo} sellos</button>
          </form>
        </section>
      ) : (
        <section>
          <h2>Sumar un sello a mano</h2>
          <p>
            Para cuando el chip falla. Si ya sumó hoy, no se suma otro: la regla de un sello por
            día se aplica igual que con el chip.
          </p>
          <form action={accionSumarSelloManual}>
            <input type="hidden" name="clienteId" value={cliente.id} />
            <button type="submit">Sumar un sello</button>
          </form>
        </section>
      )}

      {!cliente.dadoDeBaja && (
        <section>
          <h2>Baja de los mensajes</h2>
          <p>
            Si el cliente pide que no le escriban más. Sus sellos se mantienen y puede seguir
            usando su tarjeta.
          </p>
          <form action={accionDarDeBaja}>
            <input type="hidden" name="clienteId" value={cliente.id} />
            <button type="submit">No enviarle más mensajes</button>
          </form>
        </section>
      )}
    </main>
  );
}

export const dynamic = 'force-dynamic';
