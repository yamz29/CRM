// lib/informe-economico.ts
// Lógica pura de agregación para el Informe Económico (Resultado).
// Base caja, RD$. Reusa helpers de fecha/presets de gastos-informe.
// Consumida por el endpoint del dashboard y (fase 2) export Excel/PDF.

import { DESTINOS, mesLabel, ymd } from './gastos-informe'

// ── Filas normalizadas (lo que el endpoint construye desde Prisma) ─────

export interface IngresoRow {
  fecha: string            // ISO o 'YYYY-MM-DD'
  monto: number
  proyectoId: number | null
  proyectoNombre: string | null
}

export interface GastoRow {
  fecha: string
  monto: number
  destinoTipo: string      // proyecto|oficina|taller|general|sin_asignar
  proyectoId: number | null
  proyectoNombre: string | null
}

// ── KPIs del período ───────────────────────────────────────────────────

export interface KpisEconomicos {
  ingresos: number
  gastos: number
  resultado: number
  margen: number | null    // resultado / ingresos; null si no hay ingresos
}

export function calcularKpisEconomicos(ingresos: IngresoRow[], gastos: GastoRow[]): KpisEconomicos {
  const totalIngresos = sum(ingresos)
  const totalGastos = sum(gastos)
  const resultado = totalIngresos - totalGastos
  return {
    ingresos: totalIngresos,
    gastos: totalGastos,
    resultado,
    margen: totalIngresos > 0 ? resultado / totalIngresos : null,
  }
}

// ── Gasto por renglón (destino) ────────────────────────────────────────

export interface FilaRenglon { destino: string; label: string; total: number; pct: number }

export function gastosPorRenglon(gastos: GastoRow[]): FilaRenglon[] {
  const map = new Map<string, number>()
  let granTotal = 0
  for (const g of gastos) {
    map.set(g.destinoTipo, (map.get(g.destinoTipo) ?? 0) + g.monto)
    granTotal += g.monto
  }
  return DESTINOS
    .filter(d => map.has(d.key))
    .map(d => ({
      destino: d.key,
      label: d.label,
      total: map.get(d.key)!,
      pct: granTotal ? map.get(d.key)! / granTotal : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

// ── Rentabilidad por proyecto (cruce ingreso ↔ gasto) ──────────────────

export interface FilaProyectoEconomico {
  proyectoId: number | null
  nombre: string
  ingresos: number
  gastos: number
  resultado: number
  margen: number | null
}

export function rentabilidadPorProyecto(ingresos: IngresoRow[], gastos: GastoRow[]): FilaProyectoEconomico[] {
  const map = new Map<string, FilaProyectoEconomico>()

  const obtener = (id: number | null, nombre: string | null): FilaProyectoEconomico => {
    const key = id != null ? String(id) : 'sin'
    let fila = map.get(key)
    if (!fila) {
      fila = {
        proyectoId: id,
        nombre: id != null ? (nombre ?? `Proyecto ${id}`) : 'Sin proyecto',
        ingresos: 0,
        gastos: 0,
        resultado: 0,
        margen: null,
      }
      map.set(key, fila)
    }
    return fila
  }

  for (const i of ingresos) {
    const f = obtener(i.proyectoId, i.proyectoNombre)
    f.ingresos += i.monto
  }
  for (const g of gastos) {
    const f = obtener(g.proyectoId, g.proyectoNombre)
    f.gastos += g.monto
  }

  const filas = [...map.values()]
  for (const f of filas) {
    f.resultado = f.ingresos - f.gastos
    f.margen = f.ingresos > 0 ? f.resultado / f.ingresos : null
  }
  // Mayor resultado primero; "Sin proyecto" al final si no aporta ingresos
  return filas.sort((a, b) => b.resultado - a.resultado)
}

// ── Evolución mensual (ingresos vs gastos vs resultado) ────────────────

export interface FilaMesEconomico {
  mes: string              // 'YYYY-MM'
  label: string            // 'ene 2026'
  ingresos: number
  gastos: number
  resultado: number
}

export function evolucionMensual(ingresos: IngresoRow[], gastos: GastoRow[]): FilaMesEconomico[] {
  const map = new Map<string, FilaMesEconomico>()

  const fila = (fecha: string): FilaMesEconomico => {
    const key = fecha.slice(0, 7)
    let f = map.get(key)
    if (!f) { f = { mes: key, label: mesLabel(key), ingresos: 0, gastos: 0, resultado: 0 }; map.set(key, f) }
    return f
  }

  for (const i of ingresos) fila(toIsoDate(i.fecha)).ingresos += i.monto
  for (const g of gastos) fila(toIsoDate(g.fecha)).gastos += g.monto

  const filas = [...map.values()]
  for (const f of filas) f.resultado = f.ingresos - f.gastos
  return filas.sort((a, b) => a.mes.localeCompare(b.mes))
}

// ── Respuesta agregada completa del endpoint ───────────────────────────

export interface InformeEconomicoData {
  kpis: KpisEconomicos
  kpisAnterior: KpisEconomicos
  porRenglon: FilaRenglon[]
  porProyecto: FilaProyectoEconomico[]
  porMes: FilaMesEconomico[]
  otrasMonedas: { count: number; total: number }   // gastos no-RD$ excluidos
}

export function construirInforme(
  ingresos: IngresoRow[],
  gastos: GastoRow[],
  ingresosAnterior: IngresoRow[],
  gastosAnterior: GastoRow[],
  otrasMonedas: { count: number; total: number },
): InformeEconomicoData {
  return {
    kpis: calcularKpisEconomicos(ingresos, gastos),
    kpisAnterior: calcularKpisEconomicos(ingresosAnterior, gastosAnterior),
    porRenglon: gastosPorRenglon(gastos),
    porProyecto: rentabilidadPorProyecto(ingresos, gastos),
    porMes: evolucionMensual(ingresos, gastos),
    otrasMonedas,
  }
}

// ── Helpers ────────────────────────────────────────────────────────────

function sum(rows: { monto: number }[]): number {
  return rows.reduce((s, r) => s + r.monto, 0)
}

// Normaliza a 'YYYY-MM-DD' en UTC, tolerando ISO completo o fecha simple.
function toIsoDate(f: string): string {
  return f.length > 10 ? ymd(new Date(f)) : f
}
