/**
 * El texto del consentimiento y de la política de tratamiento de datos.
 *
 * Vive en un solo archivo porque el texto del formulario y el de la página de
 * la política TIENEN que coincidir: lo que el cliente acepta en la casilla es
 * exactamente lo que dice la política, y la versión que se guarda con cada
 * cliente (RL-02) se refiere a este contenido.
 *
 * Decisión de RL-06: Sello Fiel es **Encargado** del tratamiento; el
 * **Responsable** es cada local. Por eso la autorización se pide a nombre del
 * local y no de Sello Fiel: el cliente le está dando sus datos al restaurante
 * donde está comiendo, que es lo correcto legalmente y lo que menos fricción
 * genera.
 *
 * ADVERTENCIA: estos textos están redactados con la estructura que pide la Ley
 * 1581 de 2012, pero NO los ha revisado un abogado. Eso está pendiente en la
 * Fase 10, antes del primer local real.
 */

/** Se guarda con cada cliente. Cambiar SOLO si cambia el texto de abajo. */
export const VERSION_CONSENTIMIENTO = process.env.CONSENTIMIENTO_VERSION ?? '2026-11-v1';

export const NOMBRE_PLATAFORMA = 'Sello Fiel';

/** La frase de la casilla del formulario. Corta a propósito: nadie lee un párrafo. */
export function textoCasilla(nombreLocal: string): string {
  return `Autorizo a ${nombreLocal} a guardar y usar mis datos para enviarme información del club de clientes.`;
}

export interface DatosPolitica {
  nombreLocal: string;
  /** Para que el titular sepa a quién reclamar. Puede faltar al principio. */
  whatsappLocal?: string | null;
}

/**
 * La política completa. Devuelve secciones en vez de HTML para que la página
 * la dibuje y las pruebas puedan verificar que no falta ninguna.
 */
export function seccionesPolitica({ nombreLocal, whatsappLocal }: DatosPolitica) {
  return [
    {
      titulo: 'Quién responde por tus datos',
      cuerpo: [
        `${nombreLocal} es el Responsable del tratamiento de tus datos personales: es quien decide para qué se usan y a quien puedes dirigir cualquier reclamo.`,
        `${NOMBRE_PLATAFORMA} es solo el Encargado: es la plataforma que ${nombreLocal} usa para administrar su club de clientes, y trata tus datos únicamente siguiendo sus instrucciones. ${NOMBRE_PLATAFORMA} no usa tus datos para fines propios ni los comparte con otros locales.`,
      ],
    },
    {
      titulo: 'Qué datos guardamos',
      cuerpo: [
        'Tu nombre, tu número de teléfono y, si nos la das, tu fecha de nacimiento y tu correo.',
        'También el registro de tus visitas al local: la fecha de cada sello y los premios que canjeaste.',
      ],
    },
    {
      titulo: 'Para qué los usamos',
      cuerpo: [
        'Para llevar la cuenta de tus sellos y reconocerte cuando vuelves.',
        'Para avisarte cuando tienes un premio disponible.',
        `Para enviarte, por WhatsApp, mensajes del club de ${nombreLocal}: saludos de cumpleaños, promociones, eventos e invitaciones a volver.`,
        'Para entender cuántos clientes vuelven al local. Esto se mira de forma agregada, no individual.',
      ],
    },
    {
      titulo: 'Tus derechos',
      cuerpo: [
        'Puedes pedir en cualquier momento que te mostremos qué datos tenemos sobre ti, que los corrijamos si están mal, o que los eliminemos.',
        'Puedes pedir que dejemos de enviarte mensajes y seguir usando tu tarjeta de sellos igual.',
        'Dar esta autorización es voluntario. Si no la das, no puedes participar del club, pero eso no afecta en nada tu atención en el local.',
        whatsappLocal
          ? `Para ejercer cualquiera de estos derechos, escríbele a ${nombreLocal} por WhatsApp al +${whatsappLocal}.`
          : `Para ejercer cualquiera de estos derechos, pídeselo directamente a ${nombreLocal}.`,
      ],
    },
    {
      titulo: 'Cuánto tiempo los guardamos',
      cuerpo: [
        `Mientras seas parte del club de ${nombreLocal}, o hasta que pidas que los eliminemos.`,
        `Si ${nombreLocal} deja de usar ${NOMBRE_PLATAFORMA}, sus datos se le entregan a ${nombreLocal} y se borran de ${NOMBRE_PLATAFORMA}.`,
      ],
    },
  ];
}

/** Ley que ampara todo lo anterior, para citarla en la página. */
export const NORMA_APLICABLE =
  'Ley 1581 de 2012 y Decreto 1377 de 2013 (protección de datos personales en Colombia).';
