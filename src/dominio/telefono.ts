/**
 * Normalización de teléfonos.
 *
 * El teléfono es la identidad del cliente dentro de un local: si no se
 * normaliza, el mismo cliente entra tres veces porque una escribió
 * "300 123 4567", otra "+57 300 1234567" y otra "3001234567". Y cuando llegue
 * la Fase 5, el link de WhatsApp necesita el número en formato internacional
 * sin signos.
 *
 * Deliberadamente simple: no valida que el número exista, solo lo lleva a una
 * forma canónica y descarta lo que claramente no es un teléfono.
 */

/** Teléfono en formato internacional, solo dígitos: '573001234567'. */
export type Telefono = string;

/** Indicativos soportados, con la longitud del número nacional. */
const PAISES = {
  /** Colombia: celulares de 10 dígitos que empiezan por 3 */
  '57': { digitosNacionales: 10 },
  /** Argentina: 10 dígitos sin el 0 ni el 15 */
  '54': { digitosNacionales: 10 },
  /** Paraguay: 9 dígitos */
  '595': { digitosNacionales: 9 },
} as const;

export type Indicativo = keyof typeof PAISES;

export const INDICATIVO_POR_DEFECTO: Indicativo = '57';

export type ResultadoTelefono =
  | { valido: true; telefono: Telefono }
  | { valido: false; motivo: 'vacio' | 'muy_corto' | 'muy_largo' | 'caracteres_invalidos' };

/**
 * Lleva lo que escribió el cliente a formato internacional.
 *
 * Acepta '+57 300 123 4567', '(300) 123-4567', '3001234567' y
 * '573001234567', y devuelve siempre '573001234567'.
 */
export function normalizarTelefono(
  entrada: string,
  indicativoPorDefecto: Indicativo = INDICATIVO_POR_DEFECTO,
): ResultadoTelefono {
  const texto = entrada.trim();
  if (texto.length === 0) return { valido: false, motivo: 'vacio' };

  // Se permiten espacios, guiones, puntos y paréntesis como separadores, y un
  // '+' inicial. Cualquier otra cosa (letras, por ejemplo) se rechaza en vez
  // de ignorarse en silencio: un número con letras suele ser un error de carga.
  if (/[^\d\s()+.\-]/.test(texto)) {
    return { valido: false, motivo: 'caracteres_invalidos' };
  }

  const traiaMas = texto.startsWith('+');
  let digitos = texto.replace(/\D/g, '');

  if (digitos.length === 0) return { valido: false, motivo: 'vacio' };

  // Prefijo de salida internacional: '0057...' o '+0057...'
  if (digitos.startsWith('00')) digitos = digitos.slice(2);

  const nacional = PAISES[indicativoPorDefecto].digitosNacionales;

  // Si ya viene con indicativo conocido y la longitud cuadra, se respeta.
  for (const [indicativo, { digitosNacionales }] of Object.entries(PAISES)) {
    if (digitos.startsWith(indicativo) && digitos.length === indicativo.length + digitosNacionales) {
      return { valido: true, telefono: digitos };
    }
  }

  // Número nacional sin indicativo: se le pone el del local.
  if (digitos.length === nacional) {
    return { valido: true, telefono: `${indicativoPorDefecto}${digitos}` };
  }

  // Formato nacional argentino con el 0 inicial: 011..., 0351...
  if (indicativoPorDefecto === '54' && digitos.length === nacional + 1 && digitos.startsWith('0')) {
    return { valido: true, telefono: `54${digitos.slice(1)}` };
  }

  // Si traía '+' pero no reconocemos el indicativo, se acepta tal cual: puede
  // ser un turista. Solo se exige que tenga una longitud plausible.
  if (traiaMas && digitos.length >= 8 && digitos.length <= 15) {
    return { valido: true, telefono: digitos };
  }

  if (digitos.length < nacional) return { valido: false, motivo: 'muy_corto' };
  return { valido: false, motivo: 'muy_largo' };
}

/** Para mostrar en el panel: '+57 300 123 4567'. */
export function formatearParaMostrar(telefono: Telefono): string {
  for (const indicativo of Object.keys(PAISES)) {
    if (telefono.startsWith(indicativo)) {
      const resto = telefono.slice(indicativo.length);
      const grupos = resto.match(/^(\d{3})(\d{3})(\d+)$/);
      if (grupos) return `+${indicativo} ${grupos[1]} ${grupos[2]} ${grupos[3]}`;
      return `+${indicativo} ${resto}`;
    }
  }
  return `+${telefono}`;
}
