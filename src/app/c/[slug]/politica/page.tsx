/**
 * Política de tratamiento de datos: /c/[slug]/politica
 *
 * No es papeleo decorativo: es el texto que el cliente acepta en el formulario
 * (RL-03), y la Ley 1581 de 2012 exige que esté accesible. El contenido vive
 * en `src/lib/consentimiento.ts` para que no pueda desincronizarse de la
 * frase de la casilla.
 *
 * El Responsable es el local; Sello Fiel es solo el Encargado (RL-06).
 */

import { notFound } from 'next/navigation';

import { NORMA_APLICABLE, seccionesPolitica, VERSION_CONSENTIMIENTO } from '@/lib/consentimiento';
import { resolverLocalPorSlug } from '@/servicios/tags';

export default async function PaginaPolitica({ params }: PageProps<'/c/[slug]/politica'>) {
  const { slug } = await params;

  const local = await resolverLocalPorSlug(slug);
  if (!local) notFound();

  const secciones = seccionesPolitica({
    nombreLocal: local.localNombre,
    whatsappLocal: local.whatsapp,
  });

  return (
    <main>
      <h1>Tratamiento de datos personales</h1>
      <p>Club de clientes de {local.localNombre}</p>

      {secciones.map((seccion) => (
        <section key={seccion.titulo}>
          <h2>{seccion.titulo}</h2>
          {seccion.cuerpo.map((parrafo) => (
            <p key={parrafo}>{parrafo}</p>
          ))}
        </section>
      ))}

      <hr />
      <p>
        <small>
          {NORMA_APLICABLE} Versión del texto: {VERSION_CONSENTIMIENTO}.
        </small>
      </p>
    </main>
  );
}

export async function generateMetadata({ params }: PageProps<'/c/[slug]/politica'>) {
  const { slug } = await params;
  const local = await resolverLocalPorSlug(slug);
  return {
    title: local ? `Tratamiento de datos · ${local.localNombre}` : 'Sello Fiel',
  };
}
