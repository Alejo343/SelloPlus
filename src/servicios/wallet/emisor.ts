/**
 * El emisor de pases: la frontera con Google.
 *
 * Hay dos implementaciones detrás de la misma interfaz:
 *
 *  - **simulado**: no llama a nada. Registra lo que habría enviado y devuelve
 *    enlaces falsos. Es el que corre mientras la cuenta de emisor está en
 *    trámite, y el que usan las pruebas.
 *  - **google**: habla con la API REST de verdad.
 *
 * El sistema funciona igual con los dos. Eso significa que nadie queda
 * bloqueado esperando a Google, y que cuando lleguen las credenciales no hay
 * que reescribir nada: solo poner tres variables en el .env.
 *
 * ADVERTENCIA HONESTA: la implementación real está escrita según la
 * documentación de Google, pero **no se ha podido probar contra la API** porque
 * todavía no hay cuenta de emisor. Hay que verificarla a mano en la Fase 4B.
 */

import { readFileSync } from 'node:fs';

import {
  construirClase,
  construirObjeto,
  construirParcheSellos,
  enlaceParaAgregar,
  construirCargaJwt,
  idDeClase,
  idDeObjeto,
  type DatosClase,
  type DatosObjeto,
} from '../../dominio/wallet';
import type { EstadoClub } from '../../dominio/sellos';
import { firmarRs256, obtenerTokenDeAcceso } from '../../lib/jwt-google';

export interface ConfiguracionEmisor {
  issuerId: string;
  cuentaServicioEmail: string;
  clavePrivada: string;
  /** Dominios desde los que vale el enlace de "Añadir a Google Wallet" */
  origenes: string[];
}

/** Lo que registra el emisor simulado, para poder afirmar sobre él. */
export interface LlamadaRegistrada {
  operacion: 'crear_clase' | 'crear_objeto' | 'actualizar_sellos';
  id: string;
  cuerpo: unknown;
}

export interface Emisor {
  /** True si de verdad habla con Google */
  readonly real: boolean;
  /** Crea o actualiza la plantilla del local. Idempotente. */
  guardarClase(datos: DatosClase): Promise<void>;
  /** Crea la tarjeta de un cliente y devuelve el enlace para añadirla. */
  crearObjeto(datos: DatosObjeto): Promise<{ enlace: string }>;
  /** Refleja los sellos en una tarjeta ya existente. */
  actualizarSellos(opciones: {
    issuerId: string;
    clienteId: string;
    estado: EstadoClub;
    premio: string;
  }): Promise<void>;
}

/* --------------------------------------------------------- simulado */

export interface EmisorSimulado extends Emisor {
  readonly llamadas: LlamadaRegistrada[];
  limpiar(): void;
}

export function crearEmisorSimulado(issuerIdFalso = 'SIMULADO'): EmisorSimulado {
  const llamadas: LlamadaRegistrada[] = [];

  return {
    real: false,
    llamadas,

    limpiar() {
      llamadas.length = 0;
    },

    async guardarClase(datos) {
      const cuerpo = construirClase(datos);
      llamadas.push({
        operacion: 'crear_clase',
        id: idDeClase(datos.issuerId, datos.localId),
        cuerpo,
      });
    },

    async crearObjeto(datos) {
      const cuerpo = construirObjeto(datos);
      llamadas.push({
        operacion: 'crear_objeto',
        id: idDeObjeto(datos.issuerId, datos.clienteId),
        cuerpo,
      });
      // Enlace reconocible como falso: si aparece en producción, se nota.
      return { enlace: `https://simulado.sellofiel.local/wallet/${issuerIdFalso}/${datos.clienteId}` };
    },

    async actualizarSellos({ issuerId, clienteId, estado, premio }) {
      llamadas.push({
        operacion: 'actualizar_sellos',
        id: idDeObjeto(issuerId, clienteId),
        cuerpo: construirParcheSellos(estado, premio),
      });
    },
  };
}

/* ----------------------------------------------------------- google */

const BASE_API = 'https://walletobjects.googleapis.com/walletobjects/v1';

export function crearEmisorGoogle(config: ConfiguracionEmisor): Emisor {
  let tokenEnCache: { token: string; expiraEn: number } | null = null;

  async function token(): Promise<string> {
    const ahora = Math.floor(Date.now() / 1000);
    // Se renueva un minuto antes de que caduque, para no usar uno al límite.
    if (tokenEnCache && tokenEnCache.expiraEn - 60 > ahora) {
      return tokenEnCache.token;
    }

    tokenEnCache = await obtenerTokenDeAcceso({
      cuentaServicioEmail: config.cuentaServicioEmail,
      clavePrivada: config.clavePrivada,
    });

    return tokenEnCache.token;
  }

  async function llamar(
    metodo: 'GET' | 'POST' | 'PUT' | 'PATCH',
    ruta: string,
    cuerpo?: unknown,
  ): Promise<Response> {
    const respuesta = await fetch(`${BASE_API}${ruta}`, {
      method: metodo,
      headers: {
        Authorization: `Bearer ${await token()}`,
        'Content-Type': 'application/json',
      },
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      // Google recomienda 10 s de tiempo límite para esta API.
      signal: AbortSignal.timeout(10_000),
    });

    return respuesta;
  }

  async function existe(ruta: string): Promise<boolean> {
    const respuesta = await llamar('GET', ruta);
    if (respuesta.status === 404) return false;
    if (!respuesta.ok) {
      throw new Error(`Google respondió ${respuesta.status} al consultar ${ruta}`);
    }
    return true;
  }

  return {
    real: true,

    async guardarClase(datos) {
      const id = idDeClase(datos.issuerId, datos.localId);
      const cuerpo = construirClase(datos);

      /**
       * Google NO permite borrar clases, así que esto tiene que ser
       * idempotente: si ya existe se actualiza, si no se crea. Llamar a POST
       * sobre una clase existente da error.
       */
      if (await existe(`/loyaltyClass/${encodeURIComponent(id)}`)) {
        const respuesta = await llamar('PUT', `/loyaltyClass/${encodeURIComponent(id)}`, cuerpo);
        if (!respuesta.ok) {
          throw new Error(`No se pudo actualizar la clase: ${respuesta.status} ${await respuesta.text()}`);
        }
        return;
      }

      const respuesta = await llamar('POST', '/loyaltyClass', cuerpo);
      if (!respuesta.ok) {
        throw new Error(`No se pudo crear la clase: ${respuesta.status} ${await respuesta.text()}`);
      }
    },

    async crearObjeto(datos) {
      const id = idDeObjeto(datos.issuerId, datos.clienteId);
      const cuerpo = construirObjeto(datos);

      if (!(await existe(`/loyaltyObject/${encodeURIComponent(id)}`))) {
        const respuesta = await llamar('POST', '/loyaltyObject', cuerpo);
        if (!respuesta.ok) {
          throw new Error(
            `No se pudo crear la tarjeta: ${respuesta.status} ${await respuesta.text()}`,
          );
        }
      }

      /**
       * El enlace del botón se firma localmente y no pasa por la API: no hace
       * falta token ni red. Por eso funciona incluso si Google está lento.
       */
      const jwt = firmarRs256(
        construirCargaJwt({
          cuentaServicioEmail: config.cuentaServicioEmail,
          objeto: cuerpo,
          origenes: config.origenes,
        }),
        config.clavePrivada,
      );

      return { enlace: enlaceParaAgregar(jwt) };
    },

    async actualizarSellos({ issuerId, clienteId, estado, premio }) {
      const id = idDeObjeto(issuerId, clienteId);
      const respuesta = await llamar(
        'PATCH',
        `/loyaltyObject/${encodeURIComponent(id)}`,
        construirParcheSellos(estado, premio),
      );

      if (!respuesta.ok) {
        throw new Error(
          `No se pudieron actualizar los sellos: ${respuesta.status} ${await respuesta.text()}`,
        );
      }
    },
  };
}

/* ------------------------------------------------------- selección */

export function leerConfiguracionDelEntorno(): ConfiguracionEmisor | null {
  const issuerId = process.env.WALLET_ISSUER_ID;
  if (!issuerId) return null;

  /**
   * Las credenciales se leen del JSON que descarga Google, por ruta, y no de
   * una variable con la clave dentro. Dos motivos: el archivo vive fuera del
   * repositorio con permisos 600, y así no hay que pelear con los saltos de
   * línea de la clave al meterla en un .env, que es la fuente de error más
   * común al configurar esto.
   */
  const rutaCredenciales = process.env.WALLET_CREDENCIALES_ARCHIVO;

  let cuentaServicioEmail = process.env.WALLET_CUENTA_SERVICIO_EMAIL;
  let clavePrivada = process.env.WALLET_CLAVE_PRIVADA;

  if (rutaCredenciales) {
    try {
      const contenido = readFileSync(rutaCredenciales, 'utf8');
      const credenciales = JSON.parse(contenido) as {
        client_email?: string;
        private_key?: string;
      };
      cuentaServicioEmail = credenciales.client_email ?? cuentaServicioEmail;
      clavePrivada = credenciales.private_key ?? clavePrivada;
    } catch (error) {
      // Si la ruta está puesta pero el archivo no se puede leer, es mejor
      // fallar ruidosamente que caer en silencio al modo simulado y que
      // alguien crea que está emitiendo pases reales.
      throw new Error(
        `No se pudieron leer las credenciales de Google Wallet en ${rutaCredenciales}: ` +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }

  if (!cuentaServicioEmail || !clavePrivada) return null;

  const origenes = (process.env.URL_PUBLICA ?? 'http://localhost:3011')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);

  return { issuerId, cuentaServicioEmail, clavePrivada, origenes };
}

let emisorActual: Emisor | null = null;

/**
 * El emisor que toca usar: el real si hay credenciales, el simulado si no.
 *
 * Decidir esto por la presencia de credenciales, y no por una bandera aparte,
 * evita el fallo clásico de desplegar con las credenciales puestas pero el
 * modo simulado encendido, o al revés.
 */
export function obtenerEmisor(): Emisor {
  if (emisorActual) return emisorActual;

  const config = leerConfiguracionDelEntorno();
  emisorActual = config ? crearEmisorGoogle(config) : crearEmisorSimulado();
  return emisorActual;
}

/** Solo para pruebas: fuerza un emisor concreto. */
export function fijarEmisor(emisor: Emisor | null): void {
  emisorActual = emisor;
}

/** El issuer ID configurado, o uno falso en modo simulado. */
export function issuerIdActual(): string {
  return process.env.WALLET_ISSUER_ID ?? 'SIMULADO';
}
