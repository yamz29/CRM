'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { X } from 'lucide-react'

/** Destinos de navegación con `g` + tecla (estilo GitHub/Linear). */
const GO_MAP: Record<string, { href: string; label: string }> = {
  d: { href: '/', label: 'Dashboard' },
  m: { href: '/dashboard/personal', label: 'Mi día' },
  c: { href: '/clientes', label: 'Clientes' },
  p: { href: '/proyectos', label: 'Proyectos' },
  u: { href: '/presupuestos', label: 'Presupuestos' },
  t: { href: '/tareas', label: 'Tareas' },
  g: { href: '/gastos', label: 'Gastos' },
  r: { href: '/recursos', label: 'Recursos' },
  e: { href: '/empleados', label: 'Empleados' },
  o: { href: '/oportunidades', label: 'Pipeline' },
}

function esEditable(el: EventTarget | null): boolean {
  const t = el as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}

/**
 * Atajos de teclado globales (#H44): `g`+tecla navega, `/` abre el buscador,
 * `?` muestra la ayuda de atajos. Se ignoran mientras se escribe en un campo.
 */
export function GlobalShortcuts() {
  const router = useRouter()
  const [esperandoG, setEsperandoG] = useState(false)
  const [ayuda, setAyuda] = useState(false)

  useEffect(() => {
    let resetTimer: ReturnType<typeof setTimeout> | undefined

    function onKey(e: KeyboardEvent) {
      if (e.metaKey || e.ctrlKey || e.altKey) return

      // Escape cierra la ayuda esté donde esté el foco.
      if (e.key === 'Escape' && ayuda) { setAyuda(false); return }
      if (esEditable(e.target)) return

      // Segunda tecla de la secuencia `g` + destino.
      if (esperandoG) {
        setEsperandoG(false)
        const destino = GO_MAP[e.key.toLowerCase()]
        if (destino) { e.preventDefault(); router.push(destino.href) }
        return
      }

      if (e.key === '?') { e.preventDefault(); setAyuda(v => !v); return }
      if (e.key === '/') { e.preventDefault(); window.dispatchEvent(new Event('open-command-palette')); return }
      if (e.key.toLowerCase() === 'g') {
        e.preventDefault()
        setEsperandoG(true)
        resetTimer = setTimeout(() => setEsperandoG(false), 1500)
      }
    }

    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); if (resetTimer) clearTimeout(resetTimer) }
  }, [esperandoG, ayuda, router])

  if (!ayuda) {
    return esperandoG ? (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[90] px-3 py-1.5 rounded-lg bg-foreground text-background text-xs font-medium shadow-lg">
        Ir a… (c, p, t, g, r, e, u, o, m, d)
      </div>
    ) : null
  }

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm" onClick={() => setAyuda(false)}>
      <div className="w-full max-w-md bg-card border border-border rounded-xl shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-bold text-foreground">Atajos de teclado</h2>
          <button onClick={() => setAyuda(false)} className="p-0.5 rounded text-muted-foreground hover:text-foreground hover:bg-muted/40">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-4 space-y-3 text-sm">
          <Fila combo="Ctrl / ⌘ + K" desc="Buscar (paleta de comandos)" />
          <Fila combo="/" desc="Abrir el buscador" />
          <Fila combo="?" desc="Mostrar esta ayuda" />
          <div className="pt-2 border-t border-border">
            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Ir a (g + tecla)</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
              {Object.entries(GO_MAP).map(([k, v]) => (
                <Fila key={k} combo={`g ${k}`} desc={v.label} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function Fila({ combo, desc }: { combo: string; desc: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-muted-foreground">{desc}</span>
      <kbd className="px-1.5 py-0.5 rounded border border-border bg-background font-mono text-[11px] text-foreground whitespace-nowrap">{combo}</kbd>
    </div>
  )
}
