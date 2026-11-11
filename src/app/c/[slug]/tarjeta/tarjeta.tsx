/**
 * La tarjeta de sellos del cliente (RF-06).
 *
 * Componente compartido entre la pantalla del tap y la de la tarjeta, para
 * que lo que el cliente ve después de sumar un sello y lo que ve al volver a
 * entrar sean exactamente lo mismo.
 *
 * Sin estilos: la Fase 8 convierte esto en una tarjeta de verdad. Los sellos
 * se dibujan con caracteres por ahora, que ya comunica el avance.
 */

import Link from 'next/link';

import type { EstadoClub } from '@/dominio/sellos';

export interface PropsTarjeta {
  estado: EstadoClub;
  premio: string;
  localSlug: string;
  localNombre: string;
  /** En formato internacional sin signos, para armar el enlace de WhatsApp */
  whatsappLocal?: string | null;
  /** Enlace para añadir la tarjeta al wallet, si ya se generó */
  enlaceWallet?: string | null;
}

export function Tarjeta({
  estado,
  premio,
  localSlug,
  localNombre,
  whatsappLocal,
  enlaceWallet,
}: PropsTarjeta) {
  const llenos = '●'.repeat(Math.min(estado.sellos, estado.objetivo));
  const vacios = '○'.repeat(estado.faltan);

  return (
    <section>
      <h2>Tus sellos</h2>

      <p className="sellos" aria-hidden="true">
        {llenos}
        {vacios}
      </p>

      <p>
        {estado.sellos} de {estado.objetivo} sellos
        {estado.sellos > estado.objetivo && ` (${estado.sellos - estado.objetivo} a favor)`}
      </p>

      {estado.premioDisponible ? (
        <p>
          <strong>¡Tienes tu premio listo!</strong> Pídelo en el local: {premio}
        </p>
      ) : (
        <p>
          Te {estado.faltan === 1 ? 'falta' : 'faltan'} {estado.faltan}{' '}
          {estado.faltan === 1 ? 'sello' : 'sellos'} para: {premio}
        </p>
      )}

      {enlaceWallet && (
        <p>
          {/* Guardar la tarjeta en el wallet es OPCIONAL: si el cliente no lo
              hace, sigue en el club igual y suma sellos sin problema. */}
          <a href={enlaceWallet}>Guardar mi tarjeta en Google Wallet</a>
          <br />
          <small>
            Así la tienes junto a tus tarjetas del celular, y te aparece cuando pasas cerca del
            local. Es opcional.
          </small>
        </p>
      )}

      {whatsappLocal && (
        <p>
          <a
            href={`https://wa.me/${whatsappLocal}?text=${encodeURIComponent(
              `Hola ${localNombre}, quiero hacer un pedido.`,
            )}`}
          >
            Pedir o reservar por WhatsApp
          </a>
        </p>
      )}

      <p>
        <Link href={`/c/${localSlug}/politica`}>Cómo tratamos tus datos</Link>
      </p>
    </section>
  );
}
