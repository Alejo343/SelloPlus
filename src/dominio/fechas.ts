/**
 * Fechas del dominio.
 *
 * Todo el sistema razona en "días del local", no en instantes UTC. Si un local
 * de Bogotá suma un sello a las 23:30, ese sello pertenece a ese día allá,
 * aunque en UTC ya sea el día siguiente. Confundir las dos cosas haría que la
 * regla de un sello por día se rompiera cada noche.
 *
 * Convención: un "día" es siempre una cadena 'YYYY-MM-DD'.
 */

/** Un día del calendario, en formato 'YYYY-MM-DD'. */
export type Dia = string;

const FORMATO_DIA = /^\d{4}-\d{2}-\d{2}$/;

export function esDiaValido(valor: string): valor is Dia {
  if (!FORMATO_DIA.test(valor)) return false;
  const [anio, mes, dia] = valor.split('-').map(Number);
  if (mes < 1 || mes > 12) return false;
  return dia >= 1 && dia <= diasDelMes(anio, mes);
}

export function esBisiesto(anio: number): boolean {
  return (anio % 4 === 0 && anio % 100 !== 0) || anio % 400 === 0;
}

export function diasDelMes(anio: number, mes: number): number {
  if (mes === 2) return esBisiesto(anio) ? 29 : 28;
  return [4, 6, 9, 11].includes(mes) ? 30 : 31;
}

/**
 * Qué día es en la zona horaria del local, para un instante dado.
 *
 * Se usa `Intl` en vez de aritmética manual porque es lo único que maneja bien
 * los cambios de horario de verano. Colombia no los tiene, pero Argentina y
 * Paraguay sí, y el sistema apunta a esos mercados.
 */
export function diaEnZona(instante: Date, zonaHoraria: string): Dia {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: zonaHoraria,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante);

  const valor = (tipo: string) => partes.find((p) => p.type === tipo)!.value;
  return `${valor('year')}-${valor('month')}-${valor('day')}`;
}

/**
 * Cuántos días hay de `desde` a `hasta`. Negativo si `hasta` es anterior.
 *
 * Se interpretan los días al mediodía UTC: así ningún desfase de zona horaria
 * puede mover el resultado en un día.
 */
export function diasEntre(desde: Dia, hasta: Dia): number {
  const MS_POR_DIA = 86_400_000;
  return Math.round((aMediodiaUtc(hasta) - aMediodiaUtc(desde)) / MS_POR_DIA);
}

function aMediodiaUtc(dia: Dia): number {
  const [anio, mes, d] = dia.split('-').map(Number);
  return Date.UTC(anio, mes - 1, d, 12);
}

/** Suma (o resta, con negativo) días a un día. */
export function sumarDias(dia: Dia, dias: number): Dia {
  const fecha = new Date(aMediodiaUtc(dia) + dias * 86_400_000);
  return fecha.toISOString().slice(0, 10);
}

/**
 * Cuántos días faltan para el próximo cumpleaños. 0 si es hoy.
 *
 * Caso borde que importa: quien nació un 29 de febrero. En los años no
 * bisiestos su cumpleaños se trata como el 28 de febrero, para que reciba el
 * saludo todos los años y no uno de cada cuatro.
 */
export function diasHastaCumple(fechaNacimiento: Dia, hoy: Dia): number {
  const [, mesNac, diaNac] = fechaNacimiento.split('-').map(Number);
  const anioHoy = Number(hoy.slice(0, 4));

  for (const anio of [anioHoy, anioHoy + 1]) {
    const dia = Math.min(diaNac, diasDelMes(anio, mesNac));
    const candidato: Dia = `${anio}-${String(mesNac).padStart(2, '0')}-${String(dia).padStart(2, '0')}`;
    const faltan = diasEntre(hoy, candidato);
    if (faltan >= 0) return faltan;
  }

  // Inalcanzable: el cumpleaños del año siguiente siempre está en el futuro.
  throw new Error(`No se pudo calcular el cumpleaños de ${fechaNacimiento} respecto a ${hoy}`);
}
