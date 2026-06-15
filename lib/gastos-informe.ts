// lib/gastos-informe.ts
// Lógica pura de agregación para el Informe de Gastos.
// Reusada por el dashboard (cliente), el export Excel y la vista PDF (servidor).

export const MONEDA_DEFAULT = 'RD$'

export type DestinoKey = 'proyecto' | 'oficina' | 'taller' | 'general' | 'sin_asignar'

export const DESTINOS: { key: DestinoKey; label: string; color: string }[] = [
  { key: 'proyecto',    label: 'Proyectos',   color: '#3b82f6' },
  { key: 'oficina',     label: 'Oficina',     color: '#22c55e' },
  { key: 'taller',      label: 'Taller',      color: '#f97316' },
  { key: 'general',     label: 'General',     color: '#64748b' },
  { key: 'sin_asignar', label: 'Sin asignar', color: '#eab308' },
]

const DESTINO_LABEL: Record<string, string> =
  Object.fromEntries(DESTINOS.map(d => [d.key, d.label]))

export interface GastoInput {
  id: number
  fecha: string | Date
  monto: number
  moneda: string
  estado: string
  destinoTipo: string
  proyectoId: number | null
  proyecto?: { id: number; nombre: string } | null
  partida?: { id: number; descripcion: string; codigo: string | null } | null
  categoria?: string | null
  suplidor?: string | null
  descripcion?: string
}

export interface FiltroInforme {
  moneda: string
  desde?: string | null   // 'YYYY-MM-DD'
  hasta?: string | null   // 'YYYY-MM-DD'
  destino?: string | null
  proyectoId?: number | null
}

// ── Utilidades de fecha (UTC, igual que el resto del CRM) ──────────────
function toDate(f: string | Date): Date {
  return typeof f === 'string' ? new Date(f) : f
}
export function ymd(d: Date): string {
  return d.toISOString().slice(0, 10)
}
function ym(d: Date): string {
  return d.toISOString().slice(0, 7)
}
export function mesLabel(ymStr: string): string {
  // 'YYYY-MM' -> 'ene 2026'
  const [y, m] = ymStr.split('-').map(Number)
  const d = new Date(Date.UTC(y, m - 1, 1))
  return d.toLocaleDateString('es-DO', { month: 'short', year: 'numeric', timeZone: 'UTC' })
}

// ── Formateo de moneda (formatCurrency de lib/utils fija RD$) ──────────
export function formatMonto(monto: number, moneda: string): string {
  const n = monto.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return `${moneda} ${n}`
}

// ── Filtrado ──────────────────────────────────────────────────────────
export function filtrarGastos<T extends GastoInput>(gastos: T[], f: FiltroInforme): T[] {
  const desde = f.desde ? new Date(f.desde) : null
  const hasta = f.hasta ? new Date(f.hasta + 'T23:59:59.999Z') : null
  return gastos.filter(g => {
    if (g.estado === 'Anulado') return false
    if (g.moneda !== f.moneda) return false
    const fecha = toDate(g.fecha)
    if (desde && fecha < desde) return false
    if (hasta && fecha > hasta) return false
    if (f.destino && g.destinoTipo !== f.destino) return false
    if (f.proyectoId != null && g.proyectoId !== f.proyectoId) return false
    return true
  })
}

// ── Monedas presentes (para el aviso "X gastos en otra moneda") ────────
export function gastosEnOtrasMonedas(
  gastos: GastoInput[],
  f: Omit<FiltroInforme, 'moneda'> & { moneda: string },
): number {
  const desde = f.desde ? new Date(f.desde) : null
  const hasta = f.hasta ? new Date(f.hasta + 'T23:59:59.999Z') : null
  return gastos.filter(g => {
    if (g.estado === 'Anulado') return false
    if (g.moneda === f.moneda) return false
    const fecha = toDate(g.fecha)
    if (desde && fecha < desde) return false
    if (hasta && fecha > hasta) return false
    return true
  }).length
}

// ── Agrupaciones ──────────────────────────────────────────────────────
export interface FilaDestino { destino: string; label: string; total: number; count: number; pct: number }
export function agruparPorDestino(gastos: GastoInput[]): FilaDestino[] {
  const map = new Map<string, { total: number; count: number }>()
  let granTotal = 0
  for (const g of gastos) {
    const cur = map.get(g.destinoTipo) ?? { total: 0, count: 0 }
    cur.total += g.monto; cur.count += 1
    map.set(g.destinoTipo, cur)
    granTotal += g.monto
  }
  return DESTINOS
    .filter(d => map.has(d.key))
    .map(d => {
      const v = map.get(d.key)!
      return { destino: d.key, label: d.label, total: v.total, count: v.count, pct: granTotal ? v.total / granTotal : 0 }
    })
    .sort((a, b) => b.total - a.total)
}

export interface FilaMes { mes: string; label: string; total: number; porDestino: Record<string, number> }
export function agruparPorMes(gastos: GastoInput[]): FilaMes[] {
  const map = new Map<string, FilaMes>()
  for (const g of gastos) {
    const key = ym(toDate(g.fecha))
    let fila = map.get(key)
    if (!fila) { fila = { mes: key, label: mesLabel(key), total: 0, porDestino: {} }; map.set(key, fila) }
    fila.total += g.monto
    fila.porDestino[g.destinoTipo] = (fila.porDestino[g.destinoTipo] ?? 0) + g.monto
  }
  return [...map.values()].sort((a, b) => a.mes.localeCompare(b.mes))
}

export interface FilaPartida { partidaId: number | null; codigo: string | null; descripcion: string; total: number }
export interface FilaProyecto { proyectoId: number | null; nombre: string; total: number; count: number; partidas: FilaPartida[] }
export function agruparPorProyecto(gastos: GastoInput[]): FilaProyecto[] {
  const soloProyecto = gastos.filter(g => g.destinoTipo === 'proyecto')
  const map = new Map<string, FilaProyecto>()
  for (const g of soloProyecto) {
    const key = g.proyectoId != null ? String(g.proyectoId) : 'sin'
    let p = map.get(key)
    if (!p) {
      p = { proyectoId: g.proyectoId, nombre: g.proyecto?.nombre ?? 'Sin proyecto', total: 0, count: 0, partidas: [] }
      map.set(key, p)
    }
    p.total += g.monto; p.count += 1
    // desglose por partida
    const pk = g.partida?.id != null ? String(g.partida.id) : 'sin'
    let part = p.partidas.find(x => (x.partidaId != null ? String(x.partidaId) : 'sin') === pk)
    if (!part) {
      part = { partidaId: g.partida?.id ?? null, codigo: g.partida?.codigo ?? null, descripcion: g.partida?.descripcion ?? 'Sin partida', total: 0 }
      p.partidas.push(part)
    }
    part.total += g.monto
  }
  for (const p of map.values()) p.partidas.sort((a, b) => b.total - a.total)
  return [...map.values()].sort((a, b) => b.total - a.total)
}

// ── KPIs y periodo anterior ───────────────────────────────────────────
export interface Kpis { total: number; count: number; promedio: number; deltaPct: number | null }
export function calcularKpis(actual: GastoInput[], anterior: GastoInput[]): Kpis {
  const total = actual.reduce((s, g) => s + g.monto, 0)
  const count = actual.length
  const promedio = count ? total / count : 0
  const totalAnt = anterior.reduce((s, g) => s + g.monto, 0)
  const deltaPct = totalAnt > 0 ? (total - totalAnt) / totalAnt : null
  return { total, count, promedio, deltaPct }
}

export function rangoPeriodoAnterior(desde: string, hasta: string): { desde: string; hasta: string } {
  const d = new Date(desde + 'T00:00:00Z')
  const h = new Date(hasta + 'T00:00:00Z')
  const durMs = h.getTime() - d.getTime()
  const dayMs = 24 * 60 * 60 * 1000
  const prevHasta = new Date(d.getTime() - dayMs)
  const prevDesde = new Date(prevHasta.getTime() - durMs)
  return { desde: ymd(prevDesde), hasta: ymd(prevHasta) }
}

// ── Presets de rango de fecha ─────────────────────────────────────────
export type PresetRango = 'este-mes' | 'mes-pasado' | 'este-anio' | 'todo' | 'personalizado'
export function presetRango(preset: PresetRango, now = new Date()): { desde: string; hasta: string } {
  const y = now.getUTCFullYear()
  const m = now.getUTCMonth()
  const fin = (d: Date) => ymd(d)
  switch (preset) {
    case 'este-mes':   return { desde: ymd(new Date(Date.UTC(y, m, 1))),     hasta: fin(new Date(Date.UTC(y, m + 1, 0))) }
    case 'mes-pasado': return { desde: ymd(new Date(Date.UTC(y, m - 1, 1))), hasta: fin(new Date(Date.UTC(y, m, 0))) }
    case 'este-anio':  return { desde: ymd(new Date(Date.UTC(y, 0, 1))),     hasta: fin(new Date(Date.UTC(y, 11, 31))) }
    case 'todo':       return { desde: '2000-01-01',                          hasta: fin(new Date(Date.UTC(y, 11, 31))) }
    default:           return { desde: ymd(new Date(Date.UTC(y, 0, 1))),     hasta: fin(new Date(Date.UTC(y, 11, 31))) }
  }
}

export { DESTINO_LABEL }
