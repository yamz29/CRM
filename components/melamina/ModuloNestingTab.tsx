'use client'

import { NestingSVG, NEST_COLORS, type NestGroup } from './modulo-despiece'

/**
 * Tab de optimización de corte (extraído de ModuloEditor, auditoría F6).
 * Presentacional: recibe los grupos ya calculados por runNesting y los
 * controles de configuración como callbacks.
 */
interface Props {
  piezasCount: number
  grupos: NestGroup[]
  kerf: number
  rotation: boolean
  onKerfChange: (v: number) => void
  onToggleRotation: () => void
}

export function ModuloNestingTab({ piezasCount, grupos, kerf, rotation, onKerfChange, onToggleRotation }: Props) {
  return (
    <div className="space-y-4 print:hidden">
      {/* Configuración */}
      <div className="bg-card rounded-xl border border-border p-4">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">Configuración de optimización</p>
        <div className="flex flex-wrap items-center gap-5">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Kerf (espesor de corte)</label>
            <div className="flex items-center gap-1.5">
              <input
                type="number" min="0" max="10" step="0.5"
                value={kerf}
                onChange={(e) => onKerfChange(parseFloat(e.target.value) || 0)}
                className="border border-border rounded-md px-2.5 py-1.5 text-sm w-20 focus:outline-none focus:ring-2 focus:ring-ring"
              />
              <span className="text-xs text-muted-foreground">mm</span>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Rotación de piezas</label>
            <button
              onClick={onToggleRotation}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-medium transition-colors ${
                rotation
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-muted/40 border-border text-muted-foreground'
              }`}
            >
              <span>{rotation ? '✓ Permitida' : 'Desactivada'}</span>
            </button>
          </div>
          <div className="text-xs text-muted-foreground max-w-xs">
            Algoritmo Shelf — ordena piezas de mayor a menor, empaqueta en filas dentro de cada plancha.
          </div>
        </div>
      </div>

      {piezasCount === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
          Agrega piezas en el tab Despiece para ver la optimización de corte.
        </div>
      ) : grupos.length === 0 ? (
        <div className="bg-card rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
          Calculando…
        </div>
      ) : (
        grupos.map((ng) => (
          <div key={ng.tablero} className="bg-card rounded-xl border border-border overflow-hidden">
            {/* Tablero header */}
            <div className="px-5 py-3 bg-muted/40 border-b border-border flex items-center justify-between">
              <div>
                <p className="text-sm font-semibold text-foreground">{ng.tablero}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Plancha {ng.boardW}×{ng.boardH} mm ·
                  <span className="text-blue-700 font-semibold ml-1">{ng.sheets.length} plancha{ng.sheets.length !== 1 ? 's' : ''}</span>
                </p>
              </div>
              <div className="text-right">
                <p className={`text-lg font-bold ${ng.aprovechamiento >= 70 ? 'text-green-600' : 'text-amber-600'}`}>
                  {ng.aprovechamiento.toFixed(1)}%
                </p>
                <p className="text-xs text-muted-foreground">aprovechamiento</p>
              </div>
            </div>

            {/* Resumen */}
            <div className="grid grid-cols-3 gap-4 px-5 py-3 border-b border-border">
              <div>
                <p className="text-xs text-muted-foreground">Área total piezas</p>
                <p className="text-sm font-bold text-foreground">{(ng.totalPiezaAreaMm2 / 1_000_000).toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Área total planchas</p>
                <p className="text-sm font-bold text-foreground">{(ng.totalSheetAreaMm2 / 1_000_000).toFixed(3)} m²</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Desperdicio</p>
                <p className="text-sm font-bold text-red-600">
                  {((ng.totalSheetAreaMm2 - ng.totalPiezaAreaMm2) / 1_000_000).toFixed(3)} m²
                </p>
              </div>
            </div>

            {/* SVG por plancha */}
            <div className="p-4 space-y-4">
              {ng.sheets.map((sheet) => (
                <div key={sheet.id}>
                  <p className="text-xs text-muted-foreground mb-1.5 font-medium">
                    Plancha {sheet.id} — {sheet.piezas.length} pieza{sheet.piezas.length !== 1 ? 's' : ''}
                  </p>
                  <NestingSVG sheet={sheet} boardW={ng.boardW} boardH={ng.boardH} />
                  {/* Leyenda */}
                  <div className="mt-1.5 flex flex-wrap gap-1.5">
                    {Array.from(new Set(sheet.piezas.map((p) => p.etiqueta))).map((et) => {
                      const p = sheet.piezas.find((x) => x.etiqueta === et)!
                      return (
                        <span key={et} className="flex items-center gap-1 text-xs text-muted-foreground px-1.5 py-0.5 rounded bg-muted/40 border border-border">
                          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: NEST_COLORS[p.colorIdx] }} />
                          {et} — {p.nombre}
                        </span>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
