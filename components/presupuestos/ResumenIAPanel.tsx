'use client'

import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Sparkles, RefreshCw, AlertCircle, Loader2 } from 'lucide-react'

interface Props {
  presupuestoId: number
  resumenIA: string | null
  resumenIAGeneradoAt: string | null  // ISO date string
}

export function ResumenIAPanel({ presupuestoId, resumenIA, resumenIAGeneradoAt }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [, startTransition] = useTransition()

  const handleGenerate = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/presupuestos/${presupuestoId}/resumen`, { method: 'POST' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Error al generar el resumen')
      // Refresh server data so the new resumen shows up
      startTransition(() => router.refresh())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error inesperado')
    } finally {
      setLoading(false)
    }
  }

  const fechaTexto = resumenIAGeneradoAt
    ? new Date(resumenIAGeneradoAt).toLocaleString('es-DO', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      })
    : null

  return (
    <div className="rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50 via-card to-blue-50 overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-violet-200/70">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Resumen IA</h3>
            {fechaTexto && (
              <p className="text-[11px] text-muted-foreground">Generado el {fechaTexto}</p>
            )}
          </div>
        </div>
        <Button
          variant="secondary"
          onClick={handleGenerate}
          disabled={loading}
          className="!py-1.5 !px-3 text-xs"
        >
          {loading ? (
            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generando...</>
          ) : resumenIA ? (
            <><RefreshCw className="w-3.5 h-3.5" /> Regenerar</>
          ) : (
            <><Sparkles className="w-3.5 h-3.5" /> Generar resumen</>
          )}
        </Button>
      </div>

      <div className="px-4 py-4">
        {error && (
          <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-red-50 border border-red-200 text-red-800 text-xs">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        {resumenIA ? (
          <MarkdownLite text={resumenIA} />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            Aún no se ha generado un resumen para este presupuesto. Pulsa <strong>Generar resumen</strong> para que la IA describa el alcance del trabajo a partir de los capítulos y partidas.
          </p>
        )}
      </div>
    </div>
  )
}

// ── Mini renderer for markdown (headings, bold, lists, paragraphs) ─────────
// Lightweight: avoids adding react-markdown dependency for this single use.
function MarkdownLite({ text }: { text: string }) {
  // Block-level parsing: split by double newline into paragraphs/lists
  const blocks = text.replace(/\r\n/g, '\n').split(/\n\n+/)
  return (
    <div className="text-sm text-foreground space-y-3 leading-relaxed">
      {blocks.map((block, bi) => renderBlock(block, bi))}
    </div>
  )
}

function renderBlock(block: string, key: number) {
  const lines = block.split('\n')

  // Headings
  if (/^###\s+/.test(lines[0])) {
    return <h4 key={key} className="text-sm font-bold text-violet-800 mt-1">{renderInline(lines[0].replace(/^###\s+/, ''))}</h4>
  }
  if (/^##\s+/.test(lines[0])) {
    return <h3 key={key} className="text-base font-bold text-foreground mt-1">{renderInline(lines[0].replace(/^##\s+/, ''))}</h3>
  }
  if (/^#\s+/.test(lines[0])) {
    return <h2 key={key} className="text-lg font-bold text-foreground mt-1">{renderInline(lines[0].replace(/^#\s+/, ''))}</h2>
  }

  // List (all lines start with - or *)
  if (lines.every(l => /^\s*[-*]\s+/.test(l) || l.trim() === '')) {
    const items = lines.filter(l => l.trim()).map(l => l.replace(/^\s*[-*]\s+/, ''))
    return (
      <ul key={key} className="list-disc pl-5 space-y-1">
        {items.map((it, i) => <li key={i}>{renderInline(it)}</li>)}
      </ul>
    )
  }

  // Plain paragraph
  return <p key={key}>{renderInline(block)}</p>
}

function renderInline(text: string): React.ReactNode {
  // Split on **bold** preserving structure
  const parts = text.split(/(\*\*[^*]+\*\*)/g)
  return parts.map((part, i) => {
    if (/^\*\*[^*]+\*\*$/.test(part)) {
      return <strong key={i} className="font-semibold text-foreground">{part.slice(2, -2)}</strong>
    }
    return <span key={i}>{part}</span>
  })
}
