# Informe de Gastos — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Añadir un informe analítico de gastos (dashboard interactivo por destino/mes/proyecto + exportación a Excel y PDF) dentro de la página `/gastos`.

**Architecture:** El dashboard agrega en cliente los gastos **ya cargados** por `app/gastos/page.tsx` (enfoque A, sin API nueva). Toda la lógica de filtrado/agregación vive en funciones puras en `lib/gastos-informe.ts`, reusadas también por los endpoints de exportación (enfoque C): un endpoint Excel y una ruta server A4 para PDF.

**Tech Stack:** Next.js 16 (App Router), TypeScript, Prisma/SQLite, recharts (ya instalado), SheetJS `xlsx` (ya instalado), Tailwind/shadcn.

**Nota sobre testing:** Este repo **no tiene suite de tests automatizados** (ver CLAUDE.md). La verificación es: `npx tsc --noEmit` + `npm run lint` (0 errores) + `npm run build` (ignorar error Prisma de prerender) + verificación manual en navegador. Los pasos de verificación de cada tarea usan estos gates, no un test runner.

---

## File Structure

| Archivo | Acción | Responsabilidad |
|---------|--------|-----------------|
| `lib/gastos-informe.ts` | Crear | Tipos + funciones puras: filtrar, agrupar (mes/destino/proyecto), KPIs, periodo anterior, presets de fecha, formateo de moneda. Fuente de verdad única. |
| `components/gastos/GastosInforme.tsx` | Crear | Dashboard cliente: barra de filtros, KPIs, gráficos recharts, tablas, botones de export. |
| `app/gastos/GastosPageClient.tsx` | Modificar | Toggle `Lista \| Informe`; renderiza `<GastosInforme>`. |
| `app/api/export/gastos/informe/route.ts` | Crear | Excel formateado (hojas Resumen + Detalle). |
| `app/gastos/informe/imprimir/page.tsx` | Crear | Vista A4 server-rendered (shell-free por `/imprimir`). |
| `app/gastos/informe/imprimir/PrintButton.tsx` | Crear | Botón `window.print()`. |

---

## Task 1: Helpers puros de agregación (`lib/gastos-informe.ts`)

**Files:**
- Create: `lib/gastos-informe.ts`

- [ ] **Step 1: Crear el archivo con tipos y funciones puras**

```typescript
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
```

- [ ] **Step 2: Verificar que compila**

Run: `npx tsc --noEmit`
Expected: PASS (sin errores relacionados a `lib/gastos-informe.ts`).

- [ ] **Step 3: Commit**

```bash
git add lib/gastos-informe.ts
git commit -m "feat(gastos): helpers puros de agregacion para informe"
```

---

## Task 2: Dashboard cliente (`components/gastos/GastosInforme.tsx`)

**Files:**
- Create: `components/gastos/GastosInforme.tsx`

Recibe el array de gastos ya cargado por la página y `proyectos`. La interfaz `Gasto` debe ser compatible con `GastoInput` de Task 1 (los gastos de `app/gastos/page.tsx` incluyen `proyecto` y `partida`).

- [ ] **Step 1: Crear el componente**

```tsx
'use client'

import { useMemo, useState } from 'react'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { ChevronRight, Download, Printer, Info } from 'lucide-react'
import {
  DESTINOS, MONEDA_DEFAULT,
  filtrarGastos, gastosEnOtrasMonedas, agruparPorDestino, agruparPorMes, agruparPorProyecto,
  calcularKpis, rangoPeriodoAnterior, presetRango, formatMonto,
  type GastoInput, type PresetRango,
} from '@/lib/gastos-informe'

interface Gasto extends GastoInput {
  id: number
  fecha: string
  monto: number
  moneda: string
  estado: string
  destinoTipo: string
  proyectoId: number | null
  proyecto: { id: number; nombre: string } | null
  partida: { id: number; descripcion: string; codigo: string | null } | null
}

interface Props {
  gastos: Gasto[]
  proyectos: { id: number; nombre: string }[]
}

const PRESETS: { key: PresetRango; label: string }[] = [
  { key: 'este-mes', label: 'Este mes' },
  { key: 'mes-pasado', label: 'Mes pasado' },
  { key: 'este-anio', label: 'Este año' },
  { key: 'todo', label: 'Todo' },
]

export function GastosInforme({ gastos, proyectos }: Props) {
  const [preset, setPreset] = useState<PresetRango>('este-anio')
  const inicial = presetRango('este-anio')
  const [desde, setDesde] = useState(inicial.desde)
  const [hasta, setHasta] = useState(inicial.hasta)
  const [moneda, setMoneda] = useState(MONEDA_DEFAULT)
  const [destino, setDestino] = useState('')
  const [proyectoId, setProyectoId] = useState('')
  const [verTodosProyectos, setVerTodosProyectos] = useState(false)
  const [expandido, setExpandido] = useState<string | null>(null)

  function aplicarPreset(p: PresetRango) {
    setPreset(p)
    if (p !== 'personalizado') {
      const r = presetRango(p)
      setDesde(r.desde); setHasta(r.hasta)
    }
  }

  const monedasDisponibles = useMemo(
    () => [...new Set(gastos.filter(g => g.estado !== 'Anulado').map(g => g.moneda))].sort(),
    [gastos],
  )

  const filtro = { moneda, desde, hasta, destino: destino || null, proyectoId: proyectoId ? Number(proyectoId) : null }

  const filtrados = useMemo(() => filtrarGastos(gastos, filtro), [gastos, moneda, desde, hasta, destino, proyectoId])

  const kpis = useMemo(() => {
    const prev = rangoPeriodoAnterior(desde, hasta)
    const anteriores = filtrarGastos(gastos, { ...filtro, desde: prev.desde, hasta: prev.hasta })
    return calcularKpis(filtrados, anteriores)
  }, [filtrados, gastos, desde, hasta, moneda, destino, proyectoId])

  const porDestino = useMemo(() => agruparPorDestino(filtrados), [filtrados])
  const porMes = useMemo(() => agruparPorMes(filtrados), [filtrados])
  const porProyecto = useMemo(() => agruparPorProyecto(filtrados), [filtrados])
  const otrasMonedas = useMemo(() => gastosEnOtrasMonedas(gastos, filtro), [gastos, moneda, desde, hasta])

  const proyectosVisibles = verTodosProyectos ? porProyecto : porProyecto.slice(0, 10)

  const queryExport = new URLSearchParams({
    desde, hasta, moneda,
    ...(destino ? { destino } : {}),
    ...(proyectoId ? { proyectoId } : {}),
  }).toString()

  const chartData = porMes.map(m => ({
    name: m.label,
    ...Object.fromEntries(DESTINOS.map(d => [d.label, m.porDestino[d.key] ?? 0])),
  }))

  return (
    <div className="space-y-5">
      {/* Barra de filtros */}
      <div className="bg-card rounded-xl border border-border p-3 flex flex-wrap gap-3 items-center">
        <div className="flex gap-1">
          {PRESETS.map(p => (
            <button key={p.key} onClick={() => aplicarPreset(p.key)}
              className={`px-2.5 py-1.5 text-xs rounded-lg border transition-colors ${
                preset === p.key ? 'bg-primary text-primary-foreground border-primary' : 'border-border text-muted-foreground hover:text-foreground'
              }`}>{p.label}</button>
          ))}
        </div>
        <input type="date" value={desde} onChange={e => { setPreset('personalizado'); setDesde(e.target.value) }}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground" />
        <span className="text-xs text-muted-foreground">a</span>
        <input type="date" value={hasta} onChange={e => { setPreset('personalizado'); setHasta(e.target.value) }}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground" />
        <select value={moneda} onChange={e => setMoneda(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          {(monedasDisponibles.length ? monedasDisponibles : [MONEDA_DEFAULT]).map(m => <option key={m} value={m}>{m}</option>)}
        </select>
        <select value={destino} onChange={e => setDestino(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          <option value="">Todos los destinos</option>
          {DESTINOS.map(d => <option key={d.key} value={d.key}>{d.label}</option>)}
        </select>
        <select value={proyectoId} onChange={e => setProyectoId(e.target.value)}
          className="h-8 text-xs border border-border rounded-lg px-2 bg-input text-foreground">
          <option value="">Todos los proyectos</option>
          {proyectos.map(p => <option key={p.id} value={String(p.id)}>{p.nombre}</option>)}
        </select>
        <div className="ml-auto flex gap-2">
          <a href={`/api/export/gastos/informe?${queryExport}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs border border-border rounded-lg text-muted-foreground hover:text-foreground transition-colors">
            <Download className="w-3.5 h-3.5" /> Excel
          </a>
          <a href={`/gastos/informe/imprimir?${queryExport}`} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity">
            <Printer className="w-3.5 h-3.5" /> PDF
          </a>
        </div>
      </div>

      {otrasMonedas > 0 && (
        <div className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
          <Info className="w-3.5 h-3.5 shrink-0" />
          Hay {otrasMonedas} gasto(s) en otra moneda no incluidos. Cambia la moneda para verlos.
        </div>
      )}

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiCard label="Total del periodo" valor={formatMonto(kpis.total, moneda)} />
        <KpiCard label="# de gastos" valor={String(kpis.count)} />
        <KpiCard label="Ticket promedio" valor={formatMonto(kpis.promedio, moneda)} />
        <KpiCard label="vs periodo anterior"
          valor={kpis.deltaPct === null ? '—' : `${kpis.deltaPct >= 0 ? '+' : ''}${(kpis.deltaPct * 100).toFixed(1)}%`}
          tono={kpis.deltaPct === null ? 'neutro' : kpis.deltaPct > 0 ? 'malo' : 'bueno'} />
      </div>

      {filtrados.length === 0 ? (
        <div className="bg-card rounded-xl border border-border py-16 text-center text-muted-foreground text-sm">
          No hay gastos en este periodo con los filtros seleccionados.
        </div>
      ) : (
        <>
          {/* Por destino */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por destino</h3>
            <div className="space-y-2">
              {porDestino.map(d => (
                <div key={d.destino} className="flex items-center gap-3">
                  <span className="text-xs w-24 text-muted-foreground shrink-0">{d.label}</span>
                  <div className="flex-1 bg-muted/40 rounded-full h-5 overflow-hidden">
                    <div className="h-full rounded-full" style={{ width: `${(d.pct * 100).toFixed(1)}%`, backgroundColor: DESTINOS.find(x => x.key === d.destino)?.color ?? '#64748b' }} />
                  </div>
                  <span className="text-xs font-medium text-foreground w-32 text-right tabular-nums">{formatMonto(d.total, moneda)}</span>
                  <span className="text-xs text-muted-foreground w-12 text-right">{(d.pct * 100).toFixed(0)}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Por mes */}
          <div className="bg-card rounded-xl border border-border p-4">
            <h3 className="text-sm font-semibold text-foreground mb-3">Por mes</h3>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} width={70}
                    tickFormatter={(v: number) => v.toLocaleString('en-US', { notation: 'compact' })} />
                  <Tooltip formatter={(v: number) => formatMonto(v, moneda)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  {DESTINOS.map(d => <Bar key={d.key} dataKey={d.label} stackId="a" fill={d.color} />)}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Por proyecto */}
          {porProyecto.length > 0 && (
            <div className="bg-card rounded-xl border border-border overflow-hidden">
              <h3 className="text-sm font-semibold text-foreground p-4 pb-2">Por proyecto</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-muted/40 border-y border-border text-xs font-semibold text-muted-foreground uppercase">
                    <th className="px-4 py-2 text-left">Proyecto</th>
                    <th className="px-4 py-2 text-center">Gastos</th>
                    <th className="px-4 py-2 text-right">Total</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {proyectosVisibles.map(p => {
                    const key = p.proyectoId != null ? String(p.proyectoId) : 'sin'
                    const abierto = expandido === key
                    return (
                      <>
                        <tr key={key} className="hover:bg-muted/30 cursor-pointer" onClick={() => setExpandido(abierto ? null : key)}>
                          <td className="px-4 py-2 font-medium text-foreground flex items-center gap-1">
                            <ChevronRight className={`w-3.5 h-3.5 transition-transform ${abierto ? 'rotate-90' : ''}`} />
                            {p.nombre}
                          </td>
                          <td className="px-4 py-2 text-center text-muted-foreground">{p.count}</td>
                          <td className="px-4 py-2 text-right font-semibold tabular-nums">{formatMonto(p.total, moneda)}</td>
                        </tr>
                        {abierto && p.partidas.map((pt, i) => (
                          <tr key={`${key}-${i}`} className="bg-muted/20 text-xs">
                            <td className="px-4 py-1.5 pl-10 text-muted-foreground">{pt.codigo ? `${pt.codigo} · ` : ''}{pt.descripcion}</td>
                            <td></td>
                            <td className="px-4 py-1.5 text-right tabular-nums text-muted-foreground">{formatMonto(pt.total, moneda)}</td>
                          </tr>
                        ))}
                      </>
                    )
                  })}
                </tbody>
              </table>
              {porProyecto.length > 10 && (
                <button onClick={() => setVerTodosProyectos(!verTodosProyectos)}
                  className="w-full py-2 text-xs text-muted-foreground hover:text-foreground border-t border-border transition-colors">
                  {verTodosProyectos ? 'Ver menos' : `Ver todos (${porProyecto.length})`}
                </button>
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}

function KpiCard({ label, valor, tono = 'neutro' }: { label: string; valor: string; tono?: 'neutro' | 'bueno' | 'malo' }) {
  const color = tono === 'bueno' ? 'text-green-600 dark:text-green-400'
    : tono === 'malo' ? 'text-red-600 dark:text-red-400' : 'text-foreground'
  return (
    <div className="bg-card rounded-xl border border-border p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`text-xl font-bold tabular-nums mt-1 ${color}`}>{valor}</p>
    </div>
  )
}
```

- [ ] **Step 2: Verificar compilación y lint**

Run: `npx tsc --noEmit`
Expected: PASS. Si recharts marca tipos en `tickFormatter`/`formatter`, mantener los `(v: number)` anotados como en el código.

Run: `npm run lint`
Expected: 0 errores. Nota: el patrón `<>...</>` como key en `.map` puede requerir mover la `key` al primer `<tr>` (ya está); si ESLint pide key en el fragment, envolver cada fila en un `<Fragment key={key}>` importando `Fragment` de react.

- [ ] **Step 3: Commit**

```bash
git add components/gastos/GastosInforme.tsx
git commit -m "feat(gastos): dashboard de informe (KPIs, charts, por proyecto)"
```

---

## Task 3: Toggle Lista | Informe (`app/gastos/GastosPageClient.tsx`)

**Files:**
- Modify: `app/gastos/GastosPageClient.tsx`

- [ ] **Step 1: Importar el dashboard y el ícono**

En el bloque de imports (junto a la línea 7, `lucide-react`), añadir `BarChart3` a la lista de íconos:

```tsx
import { Plus, Search, Pencil, Trash2, Paperclip, Building2, Wrench, LayoutGrid, HelpCircle, FolderOpen, Receipt, BarChart3, List } from 'lucide-react'
```

Y debajo de la línea `import { useToast } from '@/components/ui/toast'` (línea 12):

```tsx
import { GastosInforme } from '@/components/gastos/GastosInforme'
```

- [ ] **Step 2: Añadir estado de vista**

Dentro de `GastosPageClient`, junto a los demás `useState` (después de `const [borrarId, setBorrarId] = useState<number | null>(null)`, línea 78):

```tsx
  const [vista, setVista] = useState<'lista' | 'informe'>('lista')
```

- [ ] **Step 3: Añadir el control segmentado en el header**

En el header, dentro del `<div className="flex items-center gap-2">` de acciones (línea 165), **antes** de `<HelpDrawer ... />`, insertar:

```tsx
          <div className="flex rounded-lg border border-border overflow-hidden mr-1">
            <button onClick={() => setVista('lista')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                vista === 'lista' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <List className="w-3.5 h-3.5" /> Lista
            </button>
            <button onClick={() => setVista('informe')}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium transition-colors ${
                vista === 'informe' ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              }`}>
              <BarChart3 className="w-3.5 h-3.5" /> Informe
            </button>
          </div>
```

- [ ] **Step 4: Renderizar condicionalmente**

Envolver el bloque que va desde `{/* Stats cards */}` (línea 176) hasta el cierre de la `{/* Table */}` (el `</div>` de cierre del bloque de tabla en línea 341) de modo que solo se muestre en vista lista, y añadir el informe. Concretamente, **antes** de `{/* Stats cards */}` insertar:

```tsx
      {vista === 'informe' ? (
        <GastosInforme gastos={gastos as any} proyectos={proyectos} />
      ) : (
      <>
```

Y **después** del `</div>` que cierra el bloque `{/* Table */}` (línea 341, justo antes de `{/* GastoForm modal */}`), insertar el cierre:

```tsx
      </>
      )}
```

Los modales (`GastoForm`, `ConfirmDialog`) quedan **fuera** del condicional para que sigan disponibles.

- [ ] **Step 5: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: 0 errores.

- [ ] **Step 6: Verificación manual**

Run: `npm run dev` y abrir `http://localhost:3000/gastos`.
Expected: aparece el toggle `Lista | Informe`. En "Informe" se ven KPIs, gráfico por mes, barras por destino y tabla por proyecto. Los presets de fecha y el cambio de moneda recalculan. El toggle a "Lista" muestra la tabla original intacta.

- [ ] **Step 7: Commit**

```bash
git add app/gastos/GastosPageClient.tsx
git commit -m "feat(gastos): toggle Lista/Informe en pagina de gastos"
```

---

## Task 4: Export Excel del informe (`app/api/export/gastos/informe/route.ts`)

**Files:**
- Create: `app/api/export/gastos/informe/route.ts`

- [ ] **Step 1: Crear el endpoint**

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import * as XLSX from 'xlsx'
import { withPermiso } from '@/lib/with-permiso'
import {
  MONEDA_DEFAULT, filtrarGastos, agruparPorDestino, agruparPorMes,
  type GastoInput,
} from '@/lib/gastos-informe'

export const GET = withPermiso('gastos', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const moneda     = searchParams.get('moneda') || MONEDA_DEFAULT
  const desde      = searchParams.get('desde') || null
  const hasta      = searchParams.get('hasta') || null
  const destino    = searchParams.get('destino') || null
  const proyectoId = searchParams.get('proyectoId')

  const gastosRaw = await prisma.gastoProyecto.findMany({
    include: {
      proyecto: { select: { id: true, nombre: true } },
      partida:  { select: { id: true, descripcion: true, codigo: true } },
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
  })

  const gastos = gastosRaw as unknown as (GastoInput & {
    fecha: Date; categoria: string | null; suplidor: string | null; descripcion: string
  })[]

  const filtrados = filtrarGastos(gastos, {
    moneda, desde, hasta, destino,
    proyectoId: proyectoId ? Number(proyectoId) : null,
  })

  const wb = XLSX.utils.book_new()

  // Hoja Resumen
  const total = filtrados.reduce((s, g) => s + g.monto, 0)
  const resumenRows: (string | number)[][] = [
    ['Informe de Gastos'],
    ['Moneda', moneda],
    ['Desde', desde ?? '—', 'Hasta', hasta ?? '—'],
    ['Total del periodo', total],
    ['# de gastos', filtrados.length],
    [],
    ['Por destino', 'Total', '% del total', '# gastos'],
    ...agruparPorDestino(filtrados).map(d => [d.label, d.total, Number((d.pct * 100).toFixed(1)), d.count]),
    [],
    ['Por mes', 'Total'],
    ...agruparPorMes(filtrados).map(m => [m.label, m.total]),
  ]
  const wsResumen = XLSX.utils.aoa_to_sheet(resumenRows)
  wsResumen['!cols'] = [{ wch: 28 }, { wch: 16 }, { wch: 12 }, { wch: 10 }]
  XLSX.utils.book_append_sheet(wb, wsResumen, 'Resumen')

  // Hoja Detalle
  const detalleRows = filtrados.map(g => ({
    'Fecha':       new Date(g.fecha).toISOString().slice(0, 10),
    'Destino':     g.destinoTipo,
    'Proyecto':    g.proyecto?.nombre ?? '',
    'Descripción': g.descripcion ?? '',
    'Categoría':   g.categoria ?? '',
    'Suplidor':    g.suplidor ?? '',
    'Moneda':      g.moneda,
    'Monto':       g.monto,
    'Estado':      g.estado,
  }))
  const wsDetalle = XLSX.utils.json_to_sheet(detalleRows)
  wsDetalle['!cols'] = [
    { wch: 12 }, { wch: 12 }, { wch: 25 }, { wch: 35 }, { wch: 16 }, { wch: 20 }, { wch: 8 }, { wch: 14 }, { wch: 12 },
  ]
  XLSX.utils.book_append_sheet(wb, wsDetalle, 'Detalle')

  const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
  const fechaArchivo = new Date().toISOString().slice(0, 10)

  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename="informe-gastos-${fechaArchivo}.xlsx"`,
    },
  })
})
```

- [ ] **Step 2: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS.

- [ ] **Step 3: Verificación manual**

Con `npm run dev`, en el informe pulsar "Excel" (o abrir `/api/export/gastos/informe?moneda=RD$&desde=2026-01-01&hasta=2026-12-31`).
Expected: descarga `informe-gastos-YYYY-MM-DD.xlsx` con hojas **Resumen** y **Detalle**; los totales coinciden con el dashboard para los mismos filtros.

- [ ] **Step 4: Commit**

```bash
git add app/api/export/gastos/informe/route.ts
git commit -m "feat(gastos): export Excel del informe (Resumen + Detalle)"
```

---

## Task 5: Vista PDF A4 (`app/gastos/informe/imprimir/`)

**Files:**
- Create: `app/gastos/informe/imprimir/PrintButton.tsx`
- Create: `app/gastos/informe/imprimir/page.tsx`

La ruta termina en `/imprimir`, por lo que `AppLayout` la renderiza **sin shell** automáticamente (`pathname.endsWith('/imprimir')`, ver `components/layout/AppLayout.tsx:20`).

- [ ] **Step 1: Crear el PrintButton**

```tsx
'use client'

import { Printer } from 'lucide-react'

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors shadow-sm print:hidden"
    >
      <Printer className="w-4 h-4" />
      Imprimir / Guardar PDF
    </button>
  )
}
```

- [ ] **Step 2: Crear la página server A4**

```tsx
import { prisma } from '@/lib/prisma'
import {
  MONEDA_DEFAULT, filtrarGastos, agruparPorDestino, agruparPorMes, agruparPorProyecto,
  calcularKpis, rangoPeriodoAnterior, formatMonto, presetRango,
  type GastoInput,
} from '@/lib/gastos-informe'
import { PrintButton } from './PrintButton'

export default async function ImprimirInformeGastosPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>
}) {
  const sp = await searchParams
  const moneda     = sp.moneda || MONEDA_DEFAULT
  const fallback   = presetRango('este-anio')
  const desde      = sp.desde || fallback.desde
  const hasta      = sp.hasta || fallback.hasta
  const destino    = sp.destino || null
  const proyectoId = sp.proyectoId ? Number(sp.proyectoId) : null

  const [gastosRaw, empresa] = await Promise.all([
    prisma.gastoProyecto.findMany({
      include: {
        proyecto: { select: { id: true, nombre: true } },
        partida:  { select: { id: true, descripcion: true, codigo: true } },
      },
      orderBy: [{ fecha: 'desc' }],
    }),
    prisma.empresa.findFirst({ select: { nombre: true } }),
  ])

  const gastos = gastosRaw as unknown as GastoInput[]
  const filtro = { moneda, desde, hasta, destino, proyectoId }
  const filtrados = filtrarGastos(gastos, filtro)
  const prev = rangoPeriodoAnterior(desde, hasta)
  const anteriores = filtrarGastos(gastos, { ...filtro, desde: prev.desde, hasta: prev.hasta })

  const kpis = calcularKpis(filtrados, anteriores)
  const porDestino = agruparPorDestino(filtrados)
  const porMes = agruparPorMes(filtrados)
  const porProyecto = agruparPorProyecto(filtrados)
  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'

  return (
    <div className="max-w-[800px] mx-auto p-8 text-slate-900 bg-white print:p-0">
      <div className="flex items-center justify-between mb-6 print:hidden">
        <a href="/gastos" className="text-sm text-slate-500 hover:text-slate-800">← Volver a Gastos</a>
        <PrintButton />
      </div>

      <header className="border-b-2 border-slate-800 pb-3 mb-5">
        <h1 className="text-xl font-bold">{nombreEmpresa}</h1>
        <p className="text-lg font-semibold mt-1">Informe de Gastos</p>
        <p className="text-xs text-slate-500 mt-1">
          {desde} a {hasta} · Moneda: {moneda}
          {destino ? ` · Destino: ${destino}` : ''}
        </p>
      </header>

      <section className="grid grid-cols-4 gap-3 mb-6">
        <KpiBox label="Total" valor={formatMonto(kpis.total, moneda)} />
        <KpiBox label="# Gastos" valor={String(kpis.count)} />
        <KpiBox label="Promedio" valor={formatMonto(kpis.promedio, moneda)} />
        <KpiBox label="vs anterior" valor={kpis.deltaPct === null ? '—' : `${kpis.deltaPct >= 0 ? '+' : ''}${(kpis.deltaPct * 100).toFixed(1)}%`} />
      </section>

      <Seccion titulo="Por destino">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
            <th className="py-1">Destino</th><th className="py-1 text-right">Total</th><th className="py-1 text-right">%</th>
          </tr></thead>
          <tbody>
            {porDestino.map(d => (
              <tr key={d.destino} className="border-b border-slate-100">
                <td className="py-1">{d.label}</td>
                <td className="py-1 text-right tabular-nums">{formatMonto(d.total, moneda)}</td>
                <td className="py-1 text-right">{(d.pct * 100).toFixed(0)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      <Seccion titulo="Por mes">
        <table className="w-full text-sm border-collapse">
          <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
            <th className="py-1">Mes</th><th className="py-1 text-right">Total</th>
          </tr></thead>
          <tbody>
            {porMes.map(m => (
              <tr key={m.mes} className="border-b border-slate-100">
                <td className="py-1">{m.label}</td>
                <td className="py-1 text-right tabular-nums">{formatMonto(m.total, moneda)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Seccion>

      {porProyecto.length > 0 && (
        <Seccion titulo="Por proyecto">
          <table className="w-full text-sm border-collapse">
            <thead><tr className="border-b border-slate-300 text-left text-xs uppercase text-slate-500">
              <th className="py-1">Proyecto</th><th className="py-1 text-right"># Gastos</th><th className="py-1 text-right">Total</th>
            </tr></thead>
            <tbody>
              {porProyecto.map(p => (
                <tr key={p.proyectoId ?? 'sin'} className="border-b border-slate-100">
                  <td className="py-1">{p.nombre}</td>
                  <td className="py-1 text-right">{p.count}</td>
                  <td className="py-1 text-right tabular-nums">{formatMonto(p.total, moneda)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Seccion>
      )}

      {filtrados.length === 0 && (
        <p className="text-center text-slate-400 text-sm py-10">No hay gastos en este periodo.</p>
      )}
    </div>
  )
}

function KpiBox({ label, valor }: { label: string; valor: string }) {
  return (
    <div className="border border-slate-200 rounded-lg p-3">
      <p className="text-[10px] uppercase text-slate-500">{label}</p>
      <p className="text-sm font-bold tabular-nums mt-0.5">{valor}</p>
    </div>
  )
}

function Seccion({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 break-inside-avoid">
      <h2 className="text-sm font-bold border-b border-slate-800 pb-1 mb-2">{titulo}</h2>
      {children}
    </section>
  )
}
```

- [ ] **Step 3: Verificar**

Run: `npx tsc --noEmit`
Expected: PASS.

Run: `npm run lint`
Expected: 0 errores.

- [ ] **Step 4: Verificación manual**

Con `npm run dev`, abrir `/gastos/informe/imprimir?moneda=RD$&desde=2026-01-01&hasta=2026-12-31`.
Expected: vista A4 **sin sidebar** (shell-free), con KPIs y tablas por destino/mes/proyecto. El botón "Imprimir / Guardar PDF" abre el diálogo de impresión y desaparece en el PDF (`print:hidden`). Los totales coinciden con el dashboard.

- [ ] **Step 5: Commit**

```bash
git add app/gastos/informe/imprimir/page.tsx app/gastos/informe/imprimir/PrintButton.tsx
git commit -m "feat(gastos): vista PDF A4 del informe de gastos"
```

---

## Task 6: Verificación final (gates del proyecto)

**Files:** ninguno (solo verificación).

- [ ] **Step 1: TypeScript**

Run: `npx tsc --noEmit`
Expected: 0 errores.

- [ ] **Step 2: Lint**

Run: `npm run lint`
Expected: 0 errores (warnings preexistentes = deuda conocida, OK).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build exitoso. Ignorar el error conocido de Prisma de prerender (ver memoria del proyecto / gates).

- [ ] **Step 4: Verificación manual integral**

Con `npm run dev`:
1. `/gastos` → toggle `Lista | Informe` visible; lista intacta.
2. Informe: cambiar presets (Este mes / Mes pasado / Este año / Todo) → KPIs y charts cambian.
3. Cambiar moneda; si hay gastos en otra moneda, aparece el aviso ámbar.
4. Filtrar por destino y proyecto → tablas y KPIs reflejan el filtro.
5. Expandir un proyecto → muestra desglose por partida.
6. Botón Excel → descarga con totales correctos.
7. Botón PDF → abre `/gastos/informe/imprimir` con los filtros; imprimir/guardar PDF funciona.

- [ ] **Step 5: Commit final (si hubo ajustes)**

```bash
git add -A
git commit -m "chore(gastos): ajustes finales informe de gastos"
```

---

## Self-Review (cobertura del spec)

| Requisito del spec | Tarea |
|--------------------|-------|
| Toggle Lista \| Informe en /gastos | Task 3 |
| Dashboard cliente reusando datos cargados (enfoque A) | Task 2 |
| Filtros: rango de fecha + presets, moneda, destino, proyecto | Task 2 |
| Anulados excluidos siempre | Task 1 (`filtrarGastos`) |
| Separar por moneda + aviso otras monedas | Task 1 + Task 2 |
| KPIs con Δ% vs periodo anterior | Task 1 (`calcularKpis`, `rangoPeriodoAnterior`) + Task 2/5 |
| Análisis por destino | Task 1 (`agruparPorDestino`) + Task 2/5 |
| Análisis por mes (BarChart) | Task 1 (`agruparPorMes`) + Task 2/5 |
| Análisis por proyecto + desglose partidas | Task 1 (`agruparPorProyecto`) + Task 2/5 |
| Export Excel formateado (Resumen + Detalle, enfoque C) | Task 4 |
| PDF A4 server shell-free (enfoque C) | Task 5 |
| Fuente de verdad única de agregación | Task 1 (`lib/gastos-informe.ts`) |
| Gates de verificación | Task 6 |

Sin placeholders. Nombres de funciones consistentes entre tareas (`filtrarGastos`, `agruparPorDestino/Mes/Proyecto`, `calcularKpis`, `rangoPeriodoAnterior`, `presetRango`, `formatMonto`).
```

