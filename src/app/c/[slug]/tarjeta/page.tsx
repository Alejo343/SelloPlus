/**
 * La tarjeta del cliente: /c/[slug]/tarjeta
 *
 * Es donde el cliente vuelve a mirar cuántos sellos tiene, sin que eso sume
 * nada. A diferencia del tap, esta pantalla NO muta: entrar diez veces no
 * cambia nada.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { clienteDeLaCookie } from '@/lib/cookies-cliente';
import { obtenerCliente } from '@/servicios/clientes';
import { estadoDelClub } from '@/servicios/sellos';
import { resolverLocalPorSlug } from '@/servicios/tags';

import { Tarjeta } from './tarjeta';

export default async function PaginaTarjeta({ params }: PageProps<'/c/[slug]/tarjeta'>) {
  const { slug } = await params;

  const local = await resolverLocalPorSlug(slug);
  if (!local) notFound();

  const clienteId = await clienteDeLaCookie(local.localSlug, local.localId);
  const cliente = clienteId ? await obtenerCliente(local.localId, clienteId) : null;

  if (!cliente) {
    return (
      <main>
        <h1>Club de {local.localNombre}</h1>
        <p>No reconocimos tu tarjeta en este celular.</p>
        <p>
          <Link href={`/c/${local.localSlug}/alta`}>Unirme al club</Link>
        </p>
      </main>
    );
  }

  const estado = await estadoDelClub(cliente.id, local.sellosObjetivo);

  return (
    <main>
      <h1>Club de {local.localNombre}</h1>
      <p>Hola, {cliente.nombre}.</p>

      <Tarjeta
        estado={estado}
        premio={local.premio}
        localSlug={local.localSlug}
        localNombre={local.localNombre}
        whatsappLocal={local.whatsapp}
      />
    </main>
  );
}

export const dynamic = 'force-dynamic';
