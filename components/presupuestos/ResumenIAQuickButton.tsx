'use client'

import { useState } from 'react'
import { Sparkles, X, RefreshCw, Loader2, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  presupuestoId: number
  numero: string
  resumenIA: string | null
  resumenIAGeneradoAt: string | null
}

export function ResumenIAQuickButton({ presupuestoId, numero, resumenIA: initialResumen, resumenIAGeneradoAt: initialFecha }: Props) {
  const [open, setOpen] = useState(false)
  const [resumen, setResumen] = useState<string | null>(initialResumen)
  const [generadoAt, setGeneradoAt] = useState<string | null>(initialFecha)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/resumen`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar el resumen')
      setResumen(data.resumen)
      setGeneradoAt(data.generadoAt)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const fechaTexto = generadoAt
    ? new Date(generadoAt).toLocaleString('es-DO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <>
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(true) }}
        title={resumen ? 'Ver resumen IA' : 'Generar resumen IA'}
        className={`p-1.5 rounded transition-colors ${
          resumen ? 'text-violet-600 hover:bg-violet-50' : 'text-muted-foreground hover:bg-muted hover:text-violet-600'
        }`}
      >
        <Sparkles className="w-4 h-4" />
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 bg-black/40 z-40" onClick={() => setOpen(false)} />

          {/* Modal */}
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-card rounded-2xl shadow-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden pointer-events-auto">
              {/* Header */}
              <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-border bg-gradient-to-r from-violet-50 to-blue-50">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-xl bg-violet-100 flex items-center justify-center flex-shrink-0">
                    <Sparkles className="w-5 h-5 text-violet-600" />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-base font-bold text-foreground truncate">Resumen IA — {numero}</h2>
                    {fechaTexto && (
                      <p className="text-[11px] text-muted-foreground">Generado el {fechaTexto}</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="p-2 rounded-lg text-muted-foreground hover:bg-muted transition-colors flex-shrink-0"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-5 py-4">
                {error && (
                  <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
                    <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{error}</span>
                  </div>
                )}

                {loading && !resumen && (
                  <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
                    <Loader2 className="w-8 h-8 animate-spin text-violet-600 mb-3" />
                    <p className="text-sm">La IA está leyendo el presupuesto...</p>
                  </div>
                )}

                {!loading && !resumen && (
                  <div className="flex flex-col items-center justify-center py-10 text-center">
                    <div className="w-14 h-14 rounded-full bg-violet-100 flex items-center justify-center mb-3">
                      <Sparkles className="w-7 h-7 text-violet-600" />
                    </div>
                    <p className="text-sm font-semibold text-foreground mb-1">Aún no hay resumen</p>
                    <p className="text-xs text-muted-foreground mb-4 max-w-md">
                      La IA leerá los capítulos y partidas y generará un resumen ejecutivo del alcance del trabajo.
                    </p>
                    <Button onClick={handleGenerate}>
                      <Sparkles className="w-4 h-4" /> Generar resumen
                    </Button>
                  </div>
                )}

                {resumen && <MarkdownLite text={resumen} />}
              </div>

              {/* Footer */}
              {resumen && (
                <div className="flex items-center justify-between gap-3 px-5 py-3 border-t border-border bg-muted/30">
                  <p className="text-[11px] text-muted-foreground">El resumen se cachea y se muestra a todos los usuarios.</p>
                  <Button variant="secondary" onClick={handleGenerate} disabled={loading} className="!py-1.5 !px-3 text-xs">
                    {loading ? <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Regenerando...</> : <><RefreshCw className="w-3.5 h-3.5" /> Regenerar</>}
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Mini markdown renderer (lightweight, no dependency) ─────────────────────
function MarkdownLite({ text }: { text: string }) {
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/)
  return (
    <div className="text-sm text-foreground space-y-3 leading-relaxed">
      {blocks.map((block, bi) => renderBlock(block, bi))}
    </div>
  )
}

function renderBlock(block: string, key: number) {
  const lines = block.split('\n')
  if (/^###\s+/.test(lines[0])) {
    return <h4 key={key} className="text-sm font-bold text-violet-800 mt-1">{renderInline(lines[0].replace(/^###\s+/, ''))}</h4>
  }
  if (/^##\s+/.test(lines[0])) {
    return <h3 key={key} className="text-base font-bold text-foreground mt-1">{renderInline(lines[0].replace(/^##\s+/, ''))}</h3>
  }
  if (/^#\s+/.test(lines[0])) {
    return <h2 key={key} className="text-lg font-bold text-foreground mt-1">{renderInline(lines[0].replace(/^#\s+/, ''))}</h2>
  }
  if (lines.every(l => /^\s*[-*]\s+/.test(l) || l.trim() === '')) {
    const items = lines.filter(l => l.trim()).map(l => l.replace(/^\s*[-*]\s+/, ''))
    return (
      <ul key={key} className="list-disc pl-5 space-y-1">
        {items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
      </ul>
    )
  }
  return <p key={key}>{renderInline(block)}</p>
}

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}
