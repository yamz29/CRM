/**
 * Helpers PUROS para la línea de tiempo del cronograma.
 *
 * Convierten fechas a píxeles y viceversa, generan las columnas del encabezado
 * de escala (Día / Semana) y formatean las etiquetas.
 *
 * Reglas de fecha:
 *   - Las fechas "de calendario" del CRM se guardan como UTC midnight
 *     (ej. "2026-06-21T00:00:00Z"). Para evitar el corrimiento de un día en
 *     husos negativos (Santo Domingo UTC-4) todo el cálculo y formato usa
 *     componentes UTC.
 *   - El mapeo fecha↔píxel es lineal en días calendario. La distinción de
 *     días laborales la resuelve el servidor (motor de agendamiento); aquí
 *     solo se resaltan los fines de semana visualmente.
 *
 * Sin dependencias de React ni del DOM: 100% testeable.
 */

export type Escala = 'dia' | 'semana'

const MS_DIA = 86_400_000

/** Píxeles por día calendario según la escala. */
export const PX_POR_DIA: Record<Escala, number> = {
  dia: 36,
  semana: 24 / 7, // una semana ocupa ANCHO_COLUMNA.semana px
}

/** Ancho de cada columna del encabezado según la escala (px). */
export const ANCHO_COLUMNA: Record<Escala, number> = {
  dia: 36,
  semana: 24, // px que ocupa una semana completa
}

// Abreviaturas en español, índice 0=domingo .. 6=sábado (getUTCDay).
const DIAS_SEMANA = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb']

/** Normaliza a medianoche UTC, descartando la hora. */
function aMedianoche(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

const pad2 = (n: number) => String(n).padStart(2, '0')

/** Abreviatura del día de semana en minúsculas: "dom", "lun", … */
export function formatDiaSemana(fecha: Date): string {
  return DIAS_SEMANA[aMedianoche(fecha).getUTCDay()]
}

/** Fecha corta "dd/mm" con cero a la izquierda: "21/06", "05/12". */
export function formatFechaCorta(fecha: Date): string {
  const d = aMedianoche(fecha)
  return `${pad2(d.getUTCDate())}/${pad2(d.getUTCMonth() + 1)}`
}

/**
 * Encabezado por día en una línea: "dom 21/06" (día de semana + dd/mm).
 * El timeline lo muestra en dos líneas usando `diaSemana` y `fechaCorta`.
 */
export function formatHeaderDia(fecha: Date): string {
  return `${formatDiaSemana(fecha)} ${formatFechaCorta(fecha)}`
}

/** Encabezado por semana: "22/06" (fecha de inicio de semana, dd/mm). */
export function formatHeaderSemana(fecha: Date): string {
  return formatFechaCorta(fecha)
}

/**
 * Lunes de la semana a la que pertenece `fecha`.
 * El domingo se considera parte de la semana que arrancó el lunes anterior.
 */
export function inicioDeSemana(fecha: Date): Date {
  const d = aMedianoche(fecha)
  const dow = d.getUTCDay() // 0=dom .. 6=sáb
  const restar = dow === 0 ? 6 : dow - 1 // distancia al lunes
  d.setUTCDate(d.getUTCDate() - restar)
  return d
}

/** True si la fecha cae en sábado o domingo. */
export function esFinDeSemana(fecha: Date): boolean {
  const dow = aMedianoche(fecha).getUTCDay()
  return dow === 0 || dow === 6
}

/** Días calendario completos entre dos fechas (ignora la hora). */
export function diasEntre(desde: Date, hasta: Date): number {
  return Math.round((aMedianoche(hasta).getTime() - aMedianoche(desde).getTime()) / MS_DIA)
}

/** Posición horizontal (px) de una fecha respecto al origen, según la escala. */
export function fechaAPixel(fecha: Date, origen: Date, escala: Escala): number {
  return diasEntre(origen, fecha) * PX_POR_DIA[escala]
}

/**
 * Fecha (UTC midnight) correspondiente a una posición horizontal (px),
 * redondeando al día más cercano.
 */
export function pixelAFecha(px: number, origen: Date, escala: Escala): Date {
  const dias = Math.round(px / PX_POR_DIA[escala])
  const d = aMedianoche(origen)
  d.setUTCDate(d.getUTCDate() + dias)
  return d
}

export interface ColumnaEscala {
  /** Fecha que representa la columna (UTC midnight). */
  fecha: Date
  /** Etiqueta en una línea (compat): "dom 21/06" (día) o "22/06" (semana). */
  label: string
  /** Día de semana abreviado para la 1ª línea del encabezado (solo día). */
  diaSemana: string
  /** Fecha corta "dd/mm" para la 2ª línea del encabezado. */
  fechaCorta: string
  /** Posición horizontal del borde izquierdo de la columna (px). */
  x: number
  /** Ancho de la columna (px). */
  ancho: number
  /** Solo en escala día: true si es sábado/domingo. */
  finDeSemana: boolean
}

/**
 * Genera las columnas del encabezado entre `inicio` y `fin` (ambos inclusive).
 * El origen del eje X es siempre `inicio` (px 0).
 */
export function generarColumnas(inicio: Date, fin: Date, escala: Escala): ColumnaEscala[] {
  const origen = aMedianoche(inicio)
  const cols: ColumnaEscala[] = []

  if (escala === 'dia') {
    const total = diasEntre(origen, fin)
    for (let i = 0; i <= total; i++) {
      const fecha = new Date(origen)
      fecha.setUTCDate(fecha.getUTCDate() + i)
      cols.push({
        fecha,
        label: formatHeaderDia(fecha),
        diaSemana: formatDiaSemana(fecha),
        fechaCorta: formatFechaCorta(fecha),
        x: i * ANCHO_COLUMNA.dia,
        ancho: ANCHO_COLUMNA.dia,
        finDeSemana: esFinDeSemana(fecha),
      })
    }
    return cols
  }

  // Escala semana: columnas alineadas al lunes. El origen del eje X es el
  // lunes de la primera semana (ver origenEje), de modo que la primera
  // columna queda en x=0 y las barras se alinean usando el mismo origen.
  const ejeOrigen = origenEje(origen, 'semana')
  let semana = inicioDeSemana(origen)
  const ultimaSemana = inicioDeSemana(aMedianoche(fin))
  while (semana.getTime() <= ultimaSemana.getTime()) {
    cols.push({
      fecha: new Date(semana),
      label: formatHeaderSemana(semana),
      diaSemana: '',
      fechaCorta: formatFechaCorta(semana),
      x: fechaAPixel(semana, ejeOrigen, 'semana'),
      ancho: ANCHO_COLUMNA.semana,
      finDeSemana: false,
    })
    semana = new Date(semana)
    semana.setUTCDate(semana.getUTCDate() + 7)
  }
  return cols
}

/**
 * Origen del eje X (px = 0) según la escala.
 *   - Día: el propio `inicio`.
 *   - Semana: el lunes de la semana de `inicio` (las columnas semanales se
 *     alinean al lunes, así que las barras deben usar el mismo origen).
 *
 * El componente del timeline DEBE usar este origen tanto para generar las
 * columnas como para posicionar las barras, garantizando que coincidan.
 */
export function origenEje(inicio: Date, escala: Escala): Date {
  return escala === 'semana' ? inicioDeSemana(inicio) : aMedianoche(inicio)
}

/**
 * Calcula el rango [inicio, fin] que cubre todas las actividades, con un
 * `paddingDias` de margen a cada lado. Si no hay actividades, devuelve un
 * rango razonable alrededor de hoy.
 */
export function rangoCronograma(
  actividades: { fechaInicio: Date; fechaFin: Date }[],
  paddingDias = 3,
): { inicio: Date; fin: Date } {
  if (actividades.length === 0) {
    const hoy = aMedianoche(new Date())
    const inicio = new Date(hoy)
    inicio.setUTCDate(inicio.getUTCDate() - 7)
    const fin = new Date(hoy)
    fin.setUTCDate(fin.getUTCDate() + 21)
    return { inicio, fin }
  }

  let min = aMedianoche(actividades[0].fechaInicio)
  let max = aMedianoche(actividades[0].fechaFin)
  for (const a of actividades) {
    const ini = aMedianoche(a.fechaInicio)
    const fin = aMedianoche(a.fechaFin)
    if (ini.getTime() < min.getTime()) min = ini
    if (fin.getTime() > max.getTime()) max = fin
  }

  const inicio = new Date(min)
  inicio.setUTCDate(inicio.getUTCDate() - paddingDias)
  const fin = new Date(max)
  fin.setUTCDate(fin.getUTCDate() + paddingDias)
  return { inicio, fin }
}
