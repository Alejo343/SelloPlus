/**
 * Códigos QR para imprimir: /panel/qr (RF-24)
 *
 * Desvío respecto al plan, a propósito: el plan decía "QR en PDF", y esto
 * genera una página pensada para imprimir, que el dueño convierte en PDF con
 * la función de imprimir de su navegador o su celular. Evita una dependencia
 * de generación de PDF en el servidor y funciona igual de bien desde un
 * teléfono, que es desde donde el dueño va a hacerlo.
 *
 * Hay un QR por tag: uno para el chip de la caja, uno para cada mesa. Si el
 * local no tiene tags, se muestra el QR general del local, que lleva al alta.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';
import QRCode from 'qrcode';

import { exigirSesion } from '@/lib/cookies-panel';
import { listarTags, obtenerLocalDelPanel } from '@/servicios/panel';

/** La URL pública del servicio, para que el QR apunte a algo alcanzable. */
const BASE_PUBLICA = process.env.URL_PUBLICA ?? 'http://localhost:3011';

async function svgDeQr(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: 'svg',
    margin: 1,
    // Corrección de errores alta: estos QR se imprimen y acaban rayados,
    // mojados o pegados en una mesa. Vale la pena el código más denso.
    errorCorrectionLevel: 'H',
    width: 320,
  });
}

export default async function PaginaQr() {
  const sesion = await exigirSesion();

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  const tags = await listarTags(sesion.localId);
  const activos = tags.filter((t) => t.activo);

  const codigos = await Promise.all(
    activos.length > 0
      ? activos.map(async (tag) => ({
          titulo: tag.objeto ?? 'Código del local',
          url: `${BASE_PUBLICA}/t/${tag.token}`,
          svg: await svgDeQr(`${BASE_PUBLICA}/t/${tag.token}`),
        }))
      : [
          {
            titulo: 'Código general del local',
            url: `${BASE_PUBLICA}/c/${local.slug}/alta`,
            svg: await svgDeQr(`${BASE_PUBLICA}/c/${local.slug}/alta`),
          },
        ],
  );

  return (
    <main>
      <p className="sin-imprimir">
        <Link href="/panel">← Volver al panel</Link>
      </p>

      <h1>{local.nombre}</h1>

      <p className="sin-imprimir">
        Imprime esta página, o guárdala como PDF desde el menú de imprimir de tu navegador. Cada
        código va en un lugar distinto del local.
      </p>

      {codigos.map((codigo) => (
        <section key={codigo.url} className="hoja-qr">
          <h2>{codigo.titulo}</h2>
          <p>Escanea y suma un sello en cada visita</p>

          {/* El SVG viene de la librería de QR con datos que generamos
              nosotros, no de nada que escriba un usuario. */}
          <div dangerouslySetInnerHTML={{ __html: codigo.svg }} />

          <p>
            Al llegar a {local.sellosObjetivo} sellos: <strong>{local.premio}</strong>
          </p>
          <p className="sin-imprimir">
            <small>{codigo.url}</small>
          </p>
        </section>
      ))}

      {activos.length === 0 && (
        <p className="sin-imprimir">
          Este local todavía no tiene chips NFC dados de alta, así que se muestra el código
          general. El alta de chips llega en la Fase 7.
        </p>
      )}
    </main>
  );
}

export const metadata = { title: 'Códigos QR · Sello Fiel' };
export const dynamic = 'force-dynamic';
