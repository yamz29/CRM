'use client'

import { useState } from 'react'
import {
  X,
  FileText, Grid2x2,
} from 'lucide-react'
import { NEST_COLORS } from '@/lib/nesting'
import { cn } from '@/lib/utils'
import {
  type CalcResult, } from './kitchen-plan'

// ── Nesting Modal ─────────────────────────────────────────────────────────────

export function KitchenNestingModal({
  calcResults,
  projectName,
  onClose,
}: {
  calcResults: CalcResult[]
  projectName: string
  onClose: () => void
}) {
  const [activeMatIdx, setActiveMatIdx] = useState(0)
  const [activeSheetIdx, setActiveSheetIdx] = useState(0)

  const mat = calcResults[activeMatIdx]
  const sheet = mat?.sheets?.[activeSheetIdx]
  const numSheets = mat?.sheets?.length ?? 0

  // Scale to fit inside ~620px width
  const DISPLAY_W = 620
  const scale = mat ? DISPLAY_W / mat.boardW : 1
  const svgH = mat ? Math.round(mat.boardH * scale) : 400

  function handlePrint() {
    window.print()
  }

  function switchMat(idx: number) {
    setActiveMatIdx(idx)
    setActiveSheetIdx(0)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 print:bg-white print:p-0 print:fixed print:inset-0">
      <div className="bg-card border border-border rounded-xl w-full max-w-4xl max-h-[92vh] flex flex-col print:border-none print:rounded-none print:max-h-none print:max-w-none">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border flex-shrink-0 print:hidden">
          <div>
            <h3 className="text-foreground font-semibold flex items-center gap-2">
              <Grid2x2 className="w-4 h-4 text-blue-400" />
              Nesting — {projectName}
            </h3>
            <p className="text-muted-foreground text-xs mt-0.5">
              Distribución de piezas en planchas
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary hover:bg-primary/90 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <FileText className="w-3.5 h-3.5" />Imprimir
            </button>
            <button onClick={onClose} className="text-muted-foreground hover:text-foreground ml-1">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Material tabs */}
        <div className="flex gap-1 px-6 pt-3 flex-shrink-0 border-b border-border overflow-x-auto print:hidden">
          {calcResults.map((r, i) => (
            <button
              key={i}
              onClick={() => switchMat(i)}
              className={cn(
                'px-3 py-1.5 rounded-t-lg text-xs font-medium transition-colors whitespace-nowrap border-t border-l border-r',
                activeMatIdx === i
                  ? 'bg-muted border-border text-foreground'
                  : 'bg-transparent border-transparent text-muted-foreground hover:text-muted-foreground/70',
              )}
            >
              {r.tablero}
              <span className="ml-1.5 text-muted-foreground">({r.sheets.length} pl.)</span>
            </button>
          ))}
        </div>

        {/* Sheet navigation + SVG */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {/* Sheet nav */}
          {numSheets > 1 && (
            <div className="flex items-center gap-2 mb-3 print:hidden">
              <button
                onClick={() => setActiveSheetIdx((i) => Math.max(0, i - 1))}
                disabled={activeSheetIdx === 0}
                className="px-2 py-1 bg-muted hover:bg-muted/80 disabled:opacity-40 text-foreground rounded text-xs"
              >
                ← Anterior
              </button>
              <span className="text-muted-foreground text-xs flex-1 text-center">
                Plancha {activeSheetIdx + 1} de {numSheets}
              </span>
              <button
                onClick={() => setActiveSheetIdx((i) => Math.min(numSheets - 1, i + 1))}
                disabled={activeSheetIdx === numSheets - 1}
                className="px-2 py-1 bg-muted hover:bg-muted/80 disabled:opacity-40 text-foreground rounded text-xs"
              >
                Siguiente →
              </button>
            </div>
          )}

          {/* Print: iterate all sheets; screen: show active only */}
          <div className="space-y-6">
            {(mat?.sheets ?? []).map((sh, si) => (
              <div
                key={sh.id}
                className={cn(
                  'print:block print:mb-8 print:page-break-after',
                  si === activeSheetIdx ? 'block' : 'hidden print:block',
                )}
              >
                <p className="text-muted-foreground text-xs mb-2 print:text-black">
                  <span className="font-semibold text-foreground print:text-black">{mat.tablero}</span>
                  {' — '}Plancha {sh.id} / {numSheets}
                  {' · '}{mat.boardW}×{mat.boardH}mm
                  {' · '}{sh.piezas.length} pieza{sh.piezas.length !== 1 ? 's' : ''}
                </p>
                <div className="overflow-x-auto">
                  <svg
                    width={DISPLAY_W}
                    height={svgH + 2}
                    className="block"
                    style={{ background: '#1e293b', border: '1px solid #334155', borderRadius: 4 }}
                  >
                    {/* Board background */}
                    <rect x={0} y={0} width={DISPLAY_W} height={svgH} fill="#1e293b" />
                    {/* Board border */}
                    <rect x={0} y={0} width={DISPLAY_W} height={svgH} fill="none" stroke="#475569" strokeWidth={1.5} />

                    {sh.piezas.map((p, pi) => {
                      const px = p.x * scale
                      const py = p.y * scale
                      const pw = p.w * scale
                      const ph = p.h * scale
                      const color = NEST_COLORS[p.colorIdx % NEST_COLORS.length]
                      const labelW = Math.round(p.w)
                      const labelH = Math.round(p.h)
                      const labelFit = pw > 30 && ph > 14
                      return (
                        <g key={pi}>
                          <rect
                            x={px}
                            y={py}
                            width={pw}
                            height={ph}
                            fill={color}
                            fillOpacity={0.75}
                            stroke={color}
                            strokeWidth={1}
                            strokeOpacity={1}
                            rx={1}
                          />
                          {labelFit && (
                            <>
                              <text
                                x={px + pw / 2}
                                y={py + ph / 2 - (ph > 26 ? 5 : 0)}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={Math.min(10, pw / 5, ph / 2.5)}
                                fill="#0f172a"
                                fontFamily="monospace"
                                fontWeight="bold"
                              >
                                {p.etiqueta}
                              </text>
                              {ph > 26 && pw > 40 && (
                                <text
                                  x={px + pw / 2}
                                  y={py + ph / 2 + 7}
                                  textAnchor="middle"
                                  dominantBaseline="middle"
                                  fontSize={Math.min(8, pw / 7)}
                                  fill="#0f172a"
                                  fontFamily="sans-serif"
                                >
                                  {labelW}×{labelH}
                                </text>
                              )}
                            </>
                          )}
                        </g>
                      )
                    })}
                  </svg>
                </div>
              </div>
            ))}
          </div>

          {/* Legend */}
          {mat && mat.sheets.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border print:hidden">
              <p className="text-muted-foreground text-xs mb-2">Leyenda — Plancha {activeSheetIdx + 1}</p>
              <div className="grid grid-cols-2 gap-x-4 gap-y-1 max-h-36 overflow-y-auto">
                {(sheet?.piezas ?? []).map((p, i) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <span
                      className="w-3 h-3 rounded-sm flex-shrink-0"
                      style={{ background: NEST_COLORS[p.colorIdx % NEST_COLORS.length] }}
                    />
                    <span className="font-mono text-muted-foreground/70 w-12 flex-shrink-0">{p.etiqueta}</span>
                    <span className="text-muted-foreground truncate">{p.nombre} ({Math.round(p.w)}×{Math.round(p.h)})</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

