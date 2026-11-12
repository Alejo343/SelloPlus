/**
 * El tap: /t/[token]
 *
 * Es la pantalla que aparece cuando el mozo apoya el chip NFC en el celular
 * del cliente, o cuando el cliente escanea el QR de la mesa. Es la única que
 * el cliente ve cada vez que viene, así que es la que más importa.
 *
 * Nota sobre sumar un sello al cargar la página: normalmente no se muta nada
 * en un GET, pero acá no hay alternativa. Un tap NFC abre una URL, y no existe
 * forma de que el chip envíe un POST. Lo que lo hace seguro es la regla de un
 * sello por día: recargar la página no suma otro sello, devuelve "ya sumaste
 * tu visita de hoy". La idempotencia hace el trabajo que haría el POST.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { mensajeDelTap, type ResultadoTap } from '@/dominio/sellos';
import { clienteDeLaCookie } from '@/lib/cookies-cliente';
import { obtenerCliente } from '@/servicios/clientes';
import { sumarSello } from '@/servicios/sellos';
import { resolverTag } from '@/servicios/tags';

import { Tarjeta } from '../../c/[slug]/tarjeta/tarjeta';

export default async function PaginaTap({ params }: PageProps<'/t/[token]'>) {
  const { token } = await params;

  const tag = await resolverTag(token);
  if (!tag) notFound();

  const clienteId = await clienteDeLaCookie(tag.localSlug, tag.localId);

  // Cliente no reconocido: puede ser nuevo, o uno que volvió con el celular
  // limpio. En los dos casos el camino es el formulario, que sabe reconocerlo
  // por el teléfono si ya estaba (RF-13).
  if (!clienteId) {
    return (
      <main>
        <h1>{tag.localNombre}</h1>
        <p>{mensajeDelTap({ tipo: 'cliente_nuevo' })}</p>
        <p>
          Suma sellos cada vez que vengas. Al llegar a {tag.sellosObjetivo}:{' '}
          <strong>{tag.premio}</strong>.
        </p>
        <p>
          <Link href={`/c/${tag.localSlug}/alta?t=${encodeURIComponent(token)}`}>
            Unirme al club
          </Link>
        </p>
      </main>
    );
  }

  // La cookie dice quién es, pero se comprueba contra la base: el cliente
  // pudo haber sido borrado, o la cookie venir de otro entorno.
  const cliente = await obtenerCliente(tag.localId, clienteId);
  if (!cliente) {
    return (
      <main>
        <h1>{tag.localNombre}</h1>
        <p>No pudimos encontrar tu tarjeta. Vuelve a unirte al club, es rápido.</p>
        <p>
          <Link href={`/c/${tag.localSlug}/alta?t=${encodeURIComponent(token)}`}>
            Unirme al club
          </Link>
        </p>
      </main>
    );
  }

  const resultado = await procesarTap({
    localId: tag.localId,
    clienteId: cliente.id,
    sellosObjetivo: tag.sellosObjetivo,
    zonaHoraria: tag.zonaHoraria,
    tagId: tag.tagId,
  });

  return (
    <main>
      <h1>{tag.localNombre}</h1>
      <p>
        Hola, {cliente.nombre}. {mensajeDelTap(resultado)}
      </p>

      {'estado' in resultado && (
        <Tarjeta
          estado={resultado.estado}
          premio={tag.premio}
          localSlug={tag.localSlug}
          localNombre={tag.localNombre}
        />
      )}
    </main>
  );
}

async function procesarTap(opciones: {
  localId: string;
  clienteId: string;
  sellosObjetivo: number;
  zonaHoraria: string;
  tagId: string;
}): Promise<ResultadoTap> {
  const resultado = await sumarSello({ ...opciones, origen: 'nfc' });

  if (resultado.resultado === 'sumado') {
    return { tipo: 'sello_sumado', estado: resultado.estado };
  }

  if (resultado.motivo === 'ya_sumo_hoy') {
    return { tipo: 'ya_sumo_hoy', estado: resultado.estado };
  }

  // Tag dado de baja o cliente que pidió la baja: no se suma, pero se le
  // muestra su tarjeta igual, que es lo que vino a ver.
  return { tipo: 'rechazado', motivo: resultado.motivo };
}

export async function generateMetadata({ params }: PageProps<'/t/[token]'>) {
  const { token } = await params;
  const tag = await resolverTag(token);
  return { title: tag ? `Club de ${tag.localNombre}` : 'Sello Fiel' };
}

/** Una página que suma sellos nunca puede servirse desde caché. */
export const dynamic = 'force-dynamic';
