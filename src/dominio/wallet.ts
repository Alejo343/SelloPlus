/**
 * Construcción de los pases de Google Wallet.
 *
 * Son funciones puras que arman los objetos JSON que espera la API. Vive en
 * `dominio/` a propósito: así se puede verificar que la estructura es correcta
 * sin credenciales y sin red, que es justo lo que hace falta mientras la
 * cuenta de emisor está en trámite.
 *
 * Vocabulario de Google, para no perderse:
 *  - **loyaltyClass**: la plantilla del programa. Una por local.
 *  - **loyaltyObject**: la tarjeta de un cliente concreto. Una por cliente.
 *  - **Issuer ID**: el identificador de la cuenta emisora (nosotros).
 *
 * Los identificadores de clase y objeto se forman `issuerId.sufijo`, y el
 * sufijo lo elegimos nosotros. Google NO permite borrar clases ni objetos, así
 * que los sufijos tienen que ser estables y derivados de datos que no cambian:
 * se usan los UUID de la base.
 */

import type { EstadoClub } from './sellos';

/** Caracteres admitidos en un sufijo de identificador de Google Wallet. */
function sufijoSeguro(valor: string): string {
  // Google acepta alfanuméricos, guion bajo, guion y punto. Los UUID ya
  // cumplen, pero se normaliza por si el dato viniera de otra parte.
  return valor.replace(/[^a-zA-Z0-9_-]/g, '_');
}

export function idDeClase(issuerId: string, localId: string): string {
  return `${issuerId}.local_${sufijoSeguro(localId)}`;
}

export function idDeObjeto(issuerId: string, clienteId: string): string {
  return `${issuerId}.cliente_${sufijoSeguro(clienteId)}`;
}

/* ------------------------------------------------------------- la clase */

export interface DatosClase {
  issuerId: string;
  localId: string;
  localNombre: string;
  premio: string;
  sellosObjetivo: number;
  /** Coordenadas del local, para el aviso por cercanía */
  lat?: string | null;
  lng?: string | null;
  /** Enlace para que el cliente pida o reserve */
  whatsapp?: string | null;
  logoUrl?: string | null;
  colorPrimario?: string | null;
}

export function construirClase(datos: DatosClase) {
  const clase: Record<string, unknown> = {
    id: idDeClase(datos.issuerId, datos.localId),
    issuerName: datos.localNombre,
    programName: `Club de ${datos.localNombre}`,
    reviewStatus: 'UNDER_REVIEW',
    hexBackgroundColor: datos.colorPrimario ?? '#111111',

    // Lo que el cliente ve como "premio" en la tarjeta.
    rewardsTierLabel: 'Premio',
    rewardsTier: datos.premio,

    textModulesData: [
      {
        id: 'como_funciona',
        header: 'Cómo funciona',
        body: `Suma un sello por visita. Al llegar a ${datos.sellosObjetivo} sellos: ${datos.premio}.`,
      },
    ],
  };

  if (datos.logoUrl) {
    clase.programLogo = {
      sourceUri: { uri: datos.logoUrl },
      contentDescription: {
        defaultValue: { language: 'es', value: `Logo de ${datos.localNombre}` },
      },
    };
  }

  /**
   * El aviso por cercanía.
   *
   * Va en `merchantLocations` y NO en `locations`: ese campo está deprecado y
   * ya no dispara notificaciones. Google decide el radio, el tiempo de
   * permanencia y el texto del aviso; nosotros solo damos el punto. Y en
   * Android solo le llega a quien le dio al wallet permiso de ubicación
   * siempre, así que no se le puede prometer al local que llega a todos.
   */
  if (datos.lat && datos.lng) {
    const latitud = Number(datos.lat);
    const longitud = Number(datos.lng);
    if (Number.isFinite(latitud) && Number.isFinite(longitud)) {
      clase.merchantLocations = [{ latitude: latitud, longitude: longitud }];
    }
  }

  if (datos.whatsapp) {
    clase.linksModuleData = {
      uris: [
        {
          uri: `https://wa.me/${datos.whatsapp}`,
          description: 'Pedir o reservar por WhatsApp',
          id: 'whatsapp',
        },
      ],
    };
  }

  return clase;
}

/* ------------------------------------------------------------ el objeto */

export interface DatosObjeto {
  issuerId: string;
  localId: string;
  clienteId: string;
  clienteNombre: string;
  estado: EstadoClub;
  premio: string;
  /** URL de la tarjeta web, para el código de barras y el enlace */
  urlTarjeta: string;
}

export function construirObjeto(datos: DatosObjeto) {
  return {
    id: idDeObjeto(datos.issuerId, datos.clienteId),
    classId: idDeClase(datos.issuerId, datos.localId),
    state: 'ACTIVE',

    accountName: datos.clienteNombre,
    // El identificador que el local ve si tiene que buscar al cliente.
    accountId: datos.clienteId,

    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: datos.estado.sellos },
    },

    /**
     * El código QR lleva a la tarjeta web del cliente. Así el personal del
     * local puede escanearlo para ver su estado, y el cliente tiene su
     * tarjeta a mano aunque borre el navegador.
     */
    barcode: {
      type: 'QR_CODE',
      value: datos.urlTarjeta,
      alternateText: `${datos.estado.sellos}/${datos.estado.objetivo} sellos`,
    },

    textModulesData: [
      {
        id: 'estado',
        header: datos.estado.premioDisponible ? '¡Premio disponible!' : 'Te faltan',
        body: datos.estado.premioDisponible
          ? `Pide tu premio en el local: ${datos.premio}`
          : `${datos.estado.faltan} ${datos.estado.faltan === 1 ? 'sello' : 'sellos'} para: ${datos.premio}`,
      },
    ],
  };
}

/* --------------------------------------------- el enlace para agregar */

/**
 * El cuerpo del JWT que firma el botón "Añadir a Google Wallet".
 *
 * `aud` y `typ` son valores fijos que exige Google. `origins` restringe desde
 * qué dominios se puede usar el enlace.
 */
export function construirCargaJwt(opciones: {
  cuentaServicioEmail: string;
  objeto: ReturnType<typeof construirObjeto>;
  origenes: string[];
  ahora?: Date;
}) {
  return {
    iss: opciones.cuentaServicioEmail,
    aud: 'google',
    typ: 'savetowallet',
    iat: Math.floor((opciones.ahora ?? new Date()).getTime() / 1000),
    origins: opciones.origenes,
    payload: {
      loyaltyObjects: [opciones.objeto],
    },
  };
}

/** La URL a la que apunta el botón, con el JWT ya firmado. */
export function enlaceParaAgregar(jwtFirmado: string): string {
  return `https://pay.google.com/gp/v/save/${jwtFirmado}`;
}

/**
 * El parche que se manda al actualizar los sellos.
 *
 * Es un PATCH y no un PUT: así se cambia solo el saldo y el texto, sin pisar
 * nada más del objeto.
 */
export function construirParcheSellos(estado: EstadoClub, premio: string) {
  return {
    loyaltyPoints: {
      label: 'Sellos',
      balance: { int: estado.sellos },
    },
    textModulesData: [
      {
        id: 'estado',
        header: estado.premioDisponible ? '¡Premio disponible!' : 'Te faltan',
        body: estado.premioDisponible
          ? `Pide tu premio en el local: ${premio}`
          : `${estado.faltan} ${estado.faltan === 1 ? 'sello' : 'sellos'} para: ${premio}`,
      },
    ],
  };
}
