/**
 * Configuración del club: /panel/programa (RF-22, RF-23)
 *
 * Un formulario plano, sin componente de cliente: no necesita estado
 * interactivo, así que una Server Action basta y funciona incluso si el
 * JavaScript no cargó.
 */

import Link from 'next/link';
import { notFound } from 'next/navigation';

import { exigirSesion } from '@/lib/cookies-panel';
import { obtenerLocalDelPanel } from '@/servicios/panel';

import { accionGuardarPrograma } from './acciones';

export default async function PaginaPrograma({ searchParams }: PageProps<'/panel/programa'>) {
  const sesion = await exigirSesion();
  const { guardado, error } = await searchParams;

  const local = await obtenerLocalDelPanel(sesion.localId);
  if (!local) notFound();

  return (
    <main>
      <p>
        <Link href="/panel">← Volver al panel</Link>
      </p>

      <h1>Configurar el club</h1>

      {guardado && <p>Cambios guardados.</p>}
      {typeof error === 'string' && <p className="error">{error}</p>}

      <form action={accionGuardarPrograma}>
        <h2>El local</h2>

        <div className="campo">
          <label htmlFor="nombre">Nombre del local</label>
          <input id="nombre" name="nombre" defaultValue={local.nombre} required />
          <small>
            Es el nombre que el cliente ve en el formulario y en la autorización de sus datos.
          </small>
        </div>

        <div className="campo">
          <label htmlFor="whatsapp">WhatsApp del local</label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            placeholder="300 123 4567"
            defaultValue={local.whatsapp ?? ''}
          />
          <small>Para el botón de pedir o reservar que ve el cliente en su tarjeta.</small>
        </div>

        <div className="campo">
          <label htmlFor="googleMapsUrl">Enlace para dejar reseñas en Google Maps</label>
          <input
            id="googleMapsUrl"
            name="googleMapsUrl"
            type="url"
            defaultValue={local.googleMapsUrl ?? ''}
          />
          <small>Se usará en la Fase 5, al preguntarle al cliente cómo estuvo su visita.</small>
        </div>

        <h2>El premio</h2>

        <div className="campo">
          <label htmlFor="sellosObjetivo">Sellos para el premio</label>
          <input
            id="sellosObjetivo"
            name="sellosObjetivo"
            type="number"
            min={1}
            max={50}
            defaultValue={local.sellosObjetivo}
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="premio">Qué se gana</label>
          <input id="premio" name="premio" defaultValue={local.premio} required />
          <small>Por ejemplo: una cena para dos, un café con leche, un postre.</small>
        </div>

        <div className="campo">
          <label htmlFor="beneficioBienvenida">Regalo por unirse (opcional)</label>
          <input
            id="beneficioBienvenida"
            name="beneficioBienvenida"
            defaultValue={local.beneficioBienvenida ?? ''}
          />
          <small>
            Sube mucho cuánta gente completa el formulario: da algo a cambio de los datos.
          </small>
        </div>

        <h2>Cuándo escribirle al cliente</h2>

        <div className="campo">
          <label htmlFor="semanasInactividad">Semanas sin venir para considerarlo perdido</label>
          <input
            id="semanasInactividad"
            name="semanasInactividad"
            type="number"
            min={1}
            max={52}
            defaultValue={local.semanasInactividad}
            required
          />
        </div>

        <div className="campo">
          <label htmlFor="diasAntesCumple">Días antes del cumpleaños para saludarlo</label>
          <input
            id="diasAntesCumple"
            name="diasAntesCumple"
            type="number"
            min={0}
            max={60}
            defaultValue={local.diasAntesCumple}
            required
          />
          <small>Mejor unos días antes que el mismo día: le da tiempo de hacer planes.</small>
        </div>

        <h2>Ubicación</h2>
        <p>
          <small>
            Se usará para que la tarjeta aparezca en el celular del cliente cuando pase cerca del
            local. Esa función llega en la Fase 4.
          </small>
        </p>

        <div className="campo">
          <label htmlFor="lat">Latitud</label>
          <input id="lat" name="lat" defaultValue={local.lat ?? ''} placeholder="4.6533" />
        </div>

        <div className="campo">
          <label htmlFor="lng">Longitud</label>
          <input id="lng" name="lng" defaultValue={local.lng ?? ''} placeholder="-74.0836" />
        </div>

        <button type="submit">Guardar cambios</button>
      </form>
    </main>
  );
}

export const metadata = { title: 'Configurar el club · SelloPlus' };
export const dynamic = 'force-dynamic';
