'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { createPortal } from 'react-dom'
import type { Gasto, PartidaOption } from './tipos'

/** Celda para asignar la partida presupuestaria de un gasto (popover). */
export function PartidaCell({ gasto, partidas, proyectoId, onUpdated }: {
  gasto: Gasto
  partidas: PartidaOption[]
  proyectoId: number
  onUpdated: () => void
}) {
  const [open, setOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number } | null>(null)
  const btnRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Actualizar posición del menú cuando se abre o hay scroll
  useEffect(() => {
    if (!open || !btnRef.current) return
    function updatePos() {
      const rect = btnRef.current!.getBoundingClientRect()
      const menuWidth = 288 // w-72 = 18rem = 288px
      // Si el menú se sale por la derecha, alinearlo a la derecha del botón
      const viewportWidth = window.innerWidth
      let left = rect.left
      if (left + menuWidth > viewportWidth - 8) {
        left = Math.max(8, viewportWidth - menuWidth - 8)
      }
      setCoords({ top: rect.bottom + 4, left, width: menuWidth })
    }
    updatePos()
    window.addEventListener('scroll', updatePos, true)
    window.addEventListener('resize', updatePos)
    return () => {
      window.removeEventListener('scroll', updatePos, true)
      window.removeEventListener('resize', updatePos)
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      const target = e.target as Node
      if (btnRef.current?.contains(target)) return
      if (menuRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function assign(partidaId: number | null) {
    setSaving(true)
    setOpen(false)
    try {
      await fetch(`/api/proyectos/${proyectoId}/gastos/${gasto.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ partidaId }),
      })
      setSaved(true)
      onUpdated()
      setTimeout(() => setSaved(false), 1500)
    } finally {
      setSaving(false)
    }
  }

  const filteredPartidas = useMemo(() => {
    const q = search.toLowerCase()
    if (!q) return partidas
    return partidas.filter(p =>
      p.descripcion.toLowerCase().includes(q) ||
      p.codigo?.toLowerCase().includes(q) ||
      p.capituloNombre?.toLowerCase().includes(q)
    )
  }, [partidas, search])

  const label = gasto.partida
    ? `${gasto.partida.codigo ? `[${gasto.partida.codigo}] ` : ''}${gasto.partida.descripcion}`
    : null

  if (partidas.length === 0) {
    return <span className="text-xs text-muted-foreground/70 italic">Sin presupuesto</span>
  }

  return (
    <>
      <button
        ref={btnRef}
        onClick={() => { setOpen(v => !v); setSearch('') }}
        disabled={saving}
        title={label ?? 'Sin asignar — clic para asignar'}
        className={`text-xs px-2 py-1 rounded border transition-colors text-left w-full max-w-[180px] block truncate ${
          saved    ? 'border-green-300 bg-green-50 text-green-700' :
          saving   ? 'border-border bg-muted/40 text-muted-foreground cursor-wait' :
          label    ? 'border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100' :
                     'border-dashed border-border text-muted-foreground hover:border-blue-300 hover:text-blue-500'
        }`}
      >
        {saving ? 'Guardando…' : saved ? '✓ Guardado' : label ?? '+ Asignar partida'}
      </button>

      {mounted && open && coords && createPortal(
        <div
          ref={menuRef}
          className="fixed bg-card border border-border rounded-lg shadow-xl z-[9999]"
          style={{ top: coords.top, left: coords.left, width: coords.width }}
        >
          <div className="p-2 border-b border-border">
            <input
              autoFocus
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Buscar partida…"
              className="w-full text-xs border border-border rounded px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-blue-400 bg-input text-foreground"
            />
          </div>
          <div className="max-h-56 overflow-y-auto py-1">
            {gasto.partida && (
              <button
                onClick={() => assign(null)}
                className="w-full text-left px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 border-b border-border"
              >
                ✕ Quitar asignación
              </button>
            )}
            {filteredPartidas.length === 0 ? (
              <div className="px-3 py-2.5 text-xs text-muted-foreground text-center">Sin resultados</div>
            ) : (
              filteredPartidas.map(p => (
                <button
                  key={p.id}
                  onClick={() => assign(p.id)}
                  className={`w-full text-left px-3 py-1.5 hover:bg-blue-50 dark:hover:bg-blue-900/20 transition-colors ${
                    gasto.partidaId === p.id ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-700 dark:text-blue-300' : 'text-foreground'
                  }`}
                >
                  <div className="text-xs font-medium truncate">
                    {p.codigo && <span className="text-muted-foreground mr-1">[{p.codigo}]</span>}
                    {p.descripcion}
                  </div>
                  {p.capituloNombre && (
                    <div className="text-xs text-muted-foreground truncate">{p.capituloNombre}</div>
                  )}
                </button>
              ))
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  )
}
