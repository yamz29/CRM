'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Plus, CheckSquare, FileText, Receipt, ClipboardCheck, BookOpen, ChevronDown } from 'lucide-react'

interface Accion {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
  sub: string
}

/**
 * Botón "+ Crear" contextual del detalle de proyecto (#H24).
 * Cada acción abre el flujo de creación correspondiente con el proyecto
 * ya preseleccionado (tarea/presupuesto por query param; gasto/punchlist/
 * bitácora saltando al tab correspondiente).
 */
export function CrearEnProyecto({ proyectoId }: { proyectoId: number }) {
  const [abierto, setAbierto] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!abierto) return
    function onClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAbierto(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setAbierto(false)
    }
    window.addEventListener('mousedown', onClick)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onClick)
      window.removeEventListener('keydown', onKey)
    }
  }, [abierto])

  const acciones: Accion[] = [
    { href: `/tareas/nueva?proyectoId=${proyectoId}`,          label: 'Nueva tarea',       icon: CheckSquare,     sub: 'Con este proyecto asignado' },
    { href: `/presupuestos/nuevo-v2?proyectoId=${proyectoId}`, label: 'Nuevo presupuesto', icon: FileText,        sub: 'Cotización para este proyecto' },
    { href: `/proyectos/${proyectoId}?tab=gastos`,             label: 'Registrar gasto',   icon: Receipt,         sub: 'Ir a la pestaña de gastos' },
    { href: `/proyectos/${proyectoId}?tab=punchlist`,          label: 'Punchlist',         icon: ClipboardCheck,  sub: 'Agregar ítem de punchlist' },
    { href: `/proyectos/${proyectoId}?tab=bitacora`,           label: 'Bitácora',          icon: BookOpen,        sub: 'Nueva entrada de bitácora' },
  ]

  return (
    <div className="relative" ref={ref}>
      <Button onClick={() => setAbierto(o => !o)} aria-expanded={abierto} aria-haspopup="menu">
        <Plus className="w-4 h-4" /> Crear
        <ChevronDown className="w-3.5 h-3.5" />
      </Button>

      {abierto && (
        <div
          role="menu"
          className="absolute right-0 z-50 mt-2 w-64 rounded-xl border border-border bg-card shadow-xl overflow-hidden"
        >
          {acciones.map(a => (
            <Link
              key={a.href}
              href={a.href}
              role="menuitem"
              onClick={() => setAbierto(false)}
              className="flex items-start gap-3 px-4 py-2.5 hover:bg-muted/40 transition-colors"
            >
              <a.icon className="w-4 h-4 mt-0.5 text-muted-foreground shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-foreground">{a.label}</p>
                <p className="text-xs text-muted-foreground truncate">{a.sub}</p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
