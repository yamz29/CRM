'use client'

import { formatCurrency } from '@/lib/utils'
import {
  calcTapacantoByColor,
  type PiezaLine, type MaterialModuloLine, type MaterialRef, type TableroGroup,
} from './modulo-despiece'

/**
 * Tab de resumen de costos y distribución de tableros (extraído de
 * ModuloEditor, auditoría F6). Presentacional: todos los agregados llegan
 * ya calculados; el único estado que toca es precioVenta, vía callback.
 */
interface Props {
  piezas: PiezaLine[]
  totalAreaM2: number
  tableroGroups: TableroGroup[]
  materialTablero: MaterialRef | null
  materialesModulo: MaterialModuloLine[]
  materialesDisponibles: MaterialRef[]
  totalMateriales: number
  costoTablero: number
  costoTotal: number
  precioVenta: string
  onPrecioVentaChange: (v: string) => void
  margen: number
  cantidad: string
  pv: number
}

export function ModuloResumenTab({
  piezas, totalAreaM2, tableroGroups, materialTablero,
  materialesModulo, materialesDisponibles,
  totalMateriales, costoTablero, costoTotal,
  precioVenta, onPrecioVentaChange, margen, cantidad, pv,
}: Props) {
  return (
    <div className="space-y-4 print:hidden">
      {/* Tablero — distribución por tipo */}
      <div className="bg-card rounded-xl border border-border p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Distribución de tableros</p>
          <span className="text-xs text-muted-foreground">{piezas.length} piezas · {totalAreaM2.toFixed(3)} m² total</span>
        </div>
        {tableroGroups.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin piezas definidas.</p>
        ) : (
          <div className="space-y-3">
            {tableroGroups.map((g) => {
              const costoG = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * (g.mat?.precio || 0) : 0
              const pctPlancha = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * 100 : 0
              return (
                <div key={g.nombre} className="border border-border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">{g.nombre}</span>
                    <span className="text-sm font-bold text-foreground">{formatCurrency(costoG)}</span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    <div>
                      <p className="text-muted-foreground">Área usada</p>
                      <p className="font-semibold text-foreground">{g.areaM2.toFixed(3)} m²</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Plancha ({g.boardW}×{g.boardH})</p>
                      <p className="font-semibold text-foreground">{g.boardAreaM2.toFixed(3)} m²</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">% plancha consumida</p>
                      <p className={`font-bold ${pctPlancha >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                        {pctPlancha.toFixed(1)}%
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Precio plancha</p>
                      <p className="font-semibold text-foreground">{g.mat?.precio ? formatCurrency(g.mat.precio) : '—'}</p>
                    </div>
                  </div>
                  {/* Barra visual de uso */}
                  <div className="flex items-center gap-2">
                    <div className="flex-1 bg-muted rounded-full h-2">
                      <div
                        className={`h-2 rounded-full transition-all ${pctPlancha >= 70 ? 'bg-green-500' : 'bg-amber-400'}`}
                        style={{ width: `${Math.min(100, pctPlancha)}%` }}
                      />
                    </div>
                    <span className="text-xs text-muted-foreground w-20 text-right">
                      {pctPlancha.toFixed(1)}% × {formatCurrency(g.mat?.precio || 0)}
                    </span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Tapacanto: {g.tapacantoMl.toFixed(2)} ml
                    {Object.entries(calcTapacantoByColor(piezas.filter((p) =>
                      (p.material || materialTablero?.nombre || 'Sin tablero') === g.nombre
                    ))).map(([color, ml]) => (
                      <span key={color} className="ml-2 px-1 py-0.5 bg-amber-50 border border-amber-200 rounded text-amber-700 text-2xs">
                        {color}: {ml.toFixed(2)} ml
                      </span>
                    ))}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Cantos y Herrajes */}
      <div className="bg-card rounded-xl border border-border p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
          Cantos y Herrajes ({materialesModulo.length})
        </p>
        {materialesModulo.length === 0 ? (
          <p className="text-sm text-muted-foreground">Sin cantos ni herrajes agregados.</p>
        ) : (
          <div className="space-y-1.5">
            {materialesModulo.map((r) => {
              const mat = materialesDisponibles.find((x) => x.id === r.materialId)
              return (
                <div key={r._key} className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">
                    {mat?.nombre || r.search || 'Material'}
                    {r.tipo === 'canto'
                      ? <span className="text-xs text-muted-foreground ml-1">— {r.cantidad} {r.unidad} × {formatCurrency(r.costoSnapshot)}/{r.unidad}</span>
                      : <span className="text-xs text-muted-foreground ml-1">— {r.cantidad} {r.unidad}</span>
                    }
                    {r.tipo && (
                      <span className={`ml-2 text-xs px-1.5 py-0.5 rounded ${r.tipo === 'canto' ? 'bg-amber-100 text-amber-700' : 'bg-muted text-muted-foreground'}`}>
                        {r.tipo}
                      </span>
                    )}
                  </span>
                  <span className="font-medium text-foreground">{formatCurrency(r.subtotal)}</span>
                </div>
              )
            })}
            <div className="flex items-center justify-between text-sm font-bold border-t border-border pt-1.5 mt-2">
              <span className="text-foreground">Total cantos + herrajes</span>
              <span className="text-foreground">{formatCurrency(totalMateriales)}</span>
            </div>
            {costoTotal > 0 && (
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-1">
                <span className="w-4 h-2 rounded-full bg-amber-500 shrink-0" />
                <div className="flex-1 bg-muted rounded-full h-2">
                  <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${Math.min(100, (totalMateriales / costoTotal) * 100)}%` }} />
                </div>
                <span className="w-10 text-right shrink-0">{((totalMateriales / costoTotal) * 100).toFixed(1)}%</span>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Resumen de costos */}
      <div className="bg-card rounded-xl border border-border p-5">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-4">Resumen de costos</p>
        <div className="space-y-2">
          {/* Tablero: una línea por cada tipo con su costo proporcional */}
          {tableroGroups.map((g) => {
            const costoG = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * (g.mat?.precio || 0) : 0
            const pctG   = g.boardAreaM2 > 0 ? (g.areaM2 / g.boardAreaM2) * 100 : 0
            return (
              <div key={g.nombre} className="flex justify-between text-sm">
                <span className="text-muted-foreground">
                  {g.nombre}
                  <span className="text-xs text-muted-foreground ml-1">({pctG.toFixed(1)}% plancha)</span>
                </span>
                <span className="font-medium">{formatCurrency(costoG)}</span>
              </div>
            )
          })}
          {tableroGroups.length > 1 && (
            <div className="flex justify-between text-xs text-muted-foreground border-t border-dashed border-border pt-1">
              <span>Subtotal tableros</span>
              <span className="font-semibold">{formatCurrency(costoTablero)}</span>
            </div>
          )}
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Cantos y Herrajes</span>
            <span className="font-medium">{formatCurrency(totalMateriales)}</span>
          </div>
          <div className="flex justify-between text-sm font-bold border-t border-border pt-2 mt-2">
            <span className="text-foreground">Costo estimado total</span>
            <span className="text-foreground">{formatCurrency(costoTotal)}</span>
          </div>
          <div className="flex justify-between text-sm items-center">
            <span className="text-muted-foreground">Precio de venta</span>
            <input
              type="number" min="0" step="1"
              className="border border-border rounded-md px-2 py-0.5 text-sm text-right w-36 focus:outline-none focus:ring-1 focus:ring-ring"
              value={precioVenta}
              onChange={(e) => onPrecioVentaChange(e.target.value)}
            />
          </div>
          <div className={`flex justify-between text-sm font-bold ${margen >= 0 ? 'text-green-700' : 'text-red-600'}`}>
            <span>Margen estimado</span>
            <span>{margen.toFixed(1)}%</span>
          </div>
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-blue-800">Total módulo × {cantidad} unidad(es)</p>
          <p className="text-xs text-blue-600 mt-0.5">Precio de venta total</p>
        </div>
        <p className="text-2xl font-bold text-blue-800">{formatCurrency(pv * (parseInt(cantidad) || 1))}</p>
      </div>
    </div>
  )
}
