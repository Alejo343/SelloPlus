/**
 * Base de clientes del local: /panel/clientes (RF-19)
 *
 * Ordenada por última visita, que es el orden en que al dueño le interesa
 * mirarla: arriba quien acaba de venir, abajo quien se está perdiendo.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { formatearParaMostrar } from '@/dominio/telefono';
import { exigirSesion } from '@/lib/cookies-panel';
import { listarClientes, obtenerLocalDelPanel } from '@/servicios/panel';

export default async function PaginaClientes({ searchParams }: PageProps<'/panel/clientes'>) {
  const sesion = await exigirSesion();
  const { q } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const busqueda = typeof q === 'string' ? q : undefined;
  const clientes = await listarClientes(sesion.localId, { busqueda });

  return (
    <main>
      <p>
        <Link href="/panel">← Volver al panel</Link>
      </p>

      <h1>Mis clientes</h1>

      <form method="get">
        <div className="campo">
          <label htmlFor="q">Buscar por nombre o teléfono</label>
          <input id="q" name="q" type="search" defaultValue={busqueda ?? ''} />
        </div>
        <button type="submit">Buscar</button>
      </form>

      {busqueda && (
        <p>
          {clientes.length} resultado{clientes.length === 1 ? '' : 's'} para «{busqueda}».{' '}
          <Link href="/panel/clientes">Ver todos</Link>
        </p>
      )}

      {clientes.length === 0 ? (
        <p>
          {busqueda
            ? 'Ningún cliente coincide con esa búsqueda.'
            : 'Todavía no hay clientes en el club. Imprime tu QR y empieza a sumarlos.'}
        </p>
      ) : (
        <ul>
          {clientes.map((cliente) => (
            <li key={cliente.id}>
              <Link href={`/panel/clientes/${cliente.id}`}>{cliente.nombre}</Link>{' '}
              — {formatearParaMostrar(cliente.telefono)}
              <br />
              <small>
                {cliente.sellosDisponibles}/{local.sellosObjetivo} sellos ·{' '}
                {cliente.visitasTotales} visita{cliente.visitasTotales === 1 ? '' : 's'} ·{' '}
                {cliente.ultimoSello ? `última: ${cliente.ultimoSello}` : 'sin visitas'}
                {cliente.dadoDeBaja && ' · pidió la baja'}
              </small>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

export const metadata = { title: 'Mis clientes · Sello Fiel' };
export const dynamic = 'force-dynamic';
