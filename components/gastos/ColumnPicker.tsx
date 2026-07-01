'use client'

import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Columns } from 'lucide-react'
import { COL_LABELS, ALWAYS_VISIBLE } from './tipos'

/** Selector de columnas visibles de la tabla de gastos. */
export function ColumnPicker({ cols, onChange }: {
  cols: Record<string, boolean>
  onChange: (c: Record<string, boolean>) => void
}) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  return (
    <div ref={ref} className="relative">
      <Button size="sm" variant="secondary" onClick={() => setOpen(v => !v)}>
        <Columns className="w-3.5 h-3.5" /> Columnas
      </Button>
      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-card border border-border rounded-lg shadow-xl z-40 py-1">
          <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground border-b border-border mb-0.5">
            Columnas visibles
          </div>
          {Object.keys(COL_LABELS).map(key => {
            const always = ALWAYS_VISIBLE.has(key)
            return (
              <label
                key={key}
                className={`flex items-center gap-2 px-3 py-1.5 hover:bg-muted select-none ${always ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
              >
                <input
                  type="checkbox"
                  checked={cols[key] ?? true}
                  disabled={always}
                  onChange={e => onChange({ ...cols, [key]: e.target.checked })}
                  className="w-3.5 h-3.5 accent-blue-600"
                />
                <span className="text-xs text-foreground">{COL_LABELS[key]}</span>
                {always && <span className="text-xs text-muted-foreground/70 ml-auto">fija</span>}
              </label>
            )
          })}
        </div>
      )}
    </div>
  )
}
