/**
 * Alta al club: /c/[slug]/alta
 *
 * Llega por dos caminos: el enlace de la pantalla del tap (con ?t=token) o el
 * QR impreso del local (sin token). El token solo sirve para registrar de
 * dónde vino el cliente y sumarle el sello de esta visita.
 */

import { notFound } from 'next/navigation';

import { resolverLocalPorSlug } from '@/servicios/tags';

import { FormularioAlta } from './formulario';

export default async function PaginaAlta({ params, searchParams }: PageProps<'/c/[slug]/alta'>) {
  const { slug } = await params;
  const { t } = await searchParams;

  const local = await resolverLocalPorSlug(slug);
  if (!local) notFound();

  const token = typeof t === 'string' ? t : undefined;

  return (
    <main>
      <h1>Club de {local.localNombre}</h1>

      <p>
        Suma un sello por visita. Al llegar a {local.sellosObjetivo}:{' '}
        <strong>{local.premio}</strong>.
      </p>

      {local.beneficioBienvenida && <p>Por unirte hoy: {local.beneficioBienvenida}</p>}

      <FormularioAlta slug={local.localSlug} localNombre={local.localNombre} token={token} />
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<'/c/[slug]/alta'>) {
  const { slug } = await params;
  const local = await resolverLocalPorSlug(slug);
  return { title: local ? `Unirme al club de ${local.localNombre}` : 'Sello Fiel' };
}
