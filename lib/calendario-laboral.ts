/**
 * Calendario laboral con soporte opcional de feriados.
 *
 * Uso básico:
 *   const d = addWorkingDays(new Date('2026-04-24'), 3)   // viernes → miércoles
 *
 * Con feriados:
 *   const feriados = [new Date('2026-05-01')]             // día del trabajo
 *   const d = addWorkingDays(new Date('2026-04-30'), 2, { feriados })
 */

// ═══════════════════════════════════════════════════════════════════════
// Helpers de fecha
// ═══════════════════════════════════════════════════════════════════════

/** Retorna una copia normalizada a medianoche UTC */
function atMidnight(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()))
}

/** YYYY-MM-DD para comparación rápida */
function dateKey(d: Date): string {
  return d.toISOString().slice(0, 10)
}

/** Construye un Set de YYYY-MM-DD de los feriados */
function toHolidaySet(feriados?: Date[]): Set<string> {
  if (!feriados || feriados.length === 0) return new Set()
  return new Set(feriados.map(f => dateKey(atMidnight(f))))
}

// ═══════════════════════════════════════════════════════════════════════
// API
// ═══════════════════════════════════════════════════════════════════════

export interface CalendarioOptions {
  usarCalendarioLaboral?: boolean   // skip weekends. Default true.
  feriados?: Date[]                  // skip these dates. Default [].
}

/**
 * Retorna true si la fecha es día laboral:
 *   - No es sábado ni domingo (si usarCalendarioLaboral=true)
 *   - No está en la lista de feriados
 */
export function esDiaLaboral(fecha: Date, opts: CalendarioOptions = {}): boolean {
  const { usarCalendarioLaboral = true, feriados = [] } = opts
  if (!usarCalendarioLaboral) return true

  const d = atMidnight(fecha)
  const dia = d.getUTCDay() // 0=dom, 6=sab
  if (dia === 0 || dia === 6) return false

  if (feriados.length > 0) {
    const set = toHolidaySet(feriados)
    if (set.has(dateKey(d))) return false
  }

  return true
}

/**
 * Suma N días laborales a una fecha (N puede ser negativo).
 * Si la fecha de inicio NO es laboral y N > 0, primero avanza al siguiente
 * día laboral y desde ahí cuenta.
 *
 * Si usarCalendarioLaboral=false, funciona como suma simple de días.
 */
export function addWorkingDays(fecha: Date, dias: number, opts: CalendarioOptions = {}): Date {
  const { usarCalendarioLaboral = true } = opts
  if (!usarCalendarioLaboral) {
    // Modo día calendario: suma directa
    const d = new Date(fecha)
    d.setUTCDate(d.getUTCDate() + dias)
    return d
  }

  let current = atMidnight(fecha)

  if (dias === 0) {
    // Si la fecha no es laboral, avanza al siguiente laboral
    while (!esDiaLaboral(current, opts)) {
      current = new Date(current)
      current.setUTCDate(current.getUTCDate() + 1)
    }
    return current
  }

  const step = dias > 0 ? 1 : -1
  let remaining = Math.abs(dias)

  while (remaining > 0) {
    current = new Date(current)
    current.setUTCDate(current.getUTCDate() + step)
    if (esDiaLaboral(current, opts)) remaining--
  }

  return current
}

/**
 * Cuenta cuántos días laborales hay entre desde y hasta (inclusivo en ambos extremos).
 * Si desde > hasta, retorna 0.
 */
export function diffWorkingDays(desde: Date, hasta: Date, opts: CalendarioOptions = {}): number {
  let d = atMidnight(desde)
  const end = atMidnight(hasta)
  if (d > end) return 0

  let count = 0
  while (d <= end) {
    if (esDiaLaboral(d, opts)) count++
    d = new Date(d)
    d.setUTCDate(d.getUTCDate() + 1)
  }
  return count
}

// ═══════════════════════════════════════════════════════════════════════
// Feriados dominicanos
// ═══════════════════════════════════════════════════════════════════════

/**
 * Calcula la fecha de Pascua (Domingo de Resurrección) para un año
 * usando el algoritmo de Butcher / Meeus. Retorna Date UTC.
 */
function calcularPascua(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)       // 3=marzo, 4=abril
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

/** Feriado dominicano computado para un año dado */
export interface FeriadoRD {
  fecha: Date
  nombre: string
  recurrente: boolean   // true si es fecha fija (ej. 1-ene); false si depende de Pascua
}

/**
 * Retorna la lista oficial de feriados de República Dominicana para el año dado.
 * Incluye:
 *   - Fijos: Año Nuevo, Reyes, Altagracia, Duarte, Independencia, Trabajo,
 *     Restauración, Virgen de las Mercedes, Constitución, Navidad
 *   - Variables: Viernes Santo, Corpus Christi (calculados desde Pascua)
 *
 * Nota: por Ley 139-97 algunos feriados se trasladan al lunes más cercano,
 * pero DGT/empresas privadas suelen usar la fecha calendario. Este módulo
 * devuelve las fechas oficiales sin traslado — si el usuario prefiere los
 * lunes moviendo, puede editar las entradas en /configuracion/feriados.
 */
export function feriadosDominicanos(year: number): FeriadoRD[] {
  const fijos: FeriadoRD[] = [
    { fecha: new Date(Date.UTC(year, 0, 1)),   nombre: 'Año Nuevo',                       recurrente: true },
    { fecha: new Date(Date.UTC(year, 0, 6)),   nombre: 'Día de los Santos Reyes',         recurrente: true },
    { fecha: new Date(Date.UTC(year, 0, 21)),  nombre: 'Virgen de la Altagracia',         recurrente: true },
    { fecha: new Date(Date.UTC(year, 0, 26)),  nombre: 'Día de Juan Pablo Duarte',        recurrente: true },
    { fecha: new Date(Date.UTC(year, 1, 27)),  nombre: 'Día de la Independencia',         recurrente: true },
    { fecha: new Date(Date.UTC(year, 4, 1)),   nombre: 'Día del Trabajo',                 recurrente: true },
    { fecha: new Date(Date.UTC(year, 7, 16)),  nombre: 'Día de la Restauración',          recurrente: true },
    { fecha: new Date(Date.UTC(year, 8, 24)),  nombre: 'Virgen de las Mercedes',          recurrente: true },
    { fecha: new Date(Date.UTC(year, 10, 6)),  nombre: 'Día de la Constitución',          recurrente: true },
    { fecha: new Date(Date.UTC(year, 11, 25)), nombre: 'Navidad',                         recurrente: true },
  ]

  // Variables basadas en Pascua
  const pascua = calcularPascua(year)
  const viernesSanto = new Date(pascua)
  viernesSanto.setUTCDate(pascua.getUTCDate() - 2)

  const corpusChristi = new Date(pascua)
  corpusChristi.setUTCDate(pascua.getUTCDate() + 60)

  const variables: FeriadoRD[] = [
    { fecha: viernesSanto,   nombre: 'Viernes Santo',   recurrente: false },
    { fecha: corpusChristi,  nombre: 'Corpus Christi',  recurrente: false },
  ]

  return [...fijos, ...variables].sort((a, b) => a.fecha.getTime() - b.fecha.getTime())
}
