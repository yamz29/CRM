import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { EstadoBadge } from '@/lib/estados'
import { FolderPlus, FileText, FilePlus, Banknote, CheckCircle2 } from 'lucide-react'

export type TipoEvento = 'proyecto' | 'presupuesto' | 'adicional' | 'cobro' | 'cierre'

export interface EventoTimeline {
  fecha: string | Date
  tipo: TipoEvento
  titulo: string
  detalle?: string
  monto?: number
  /** dominio+estado para pintar un EstadoBadge, si aplica */
  estadoDominio?: 'presupuesto' | 'factura'
  estado?: string
  href?: string
}

const ICONO: Record<TipoEvento, React.ComponentType<{ className?: string }>> = {
  proyecto: FolderPlus,
  presupuesto: FileText,
  adicional: FilePlus,
  cobro: Banknote,
  cierre: CheckCircle2,
}

const COLOR: Record<TipoEvento, string> = {
  proyecto: 'text-slate-500 bg-slate-100 dark:bg-slate-800',
  presupuesto: 'text-blue-600 bg-blue-100 dark:bg-blue-900/30',
  adicional: 'text-amber-600 bg-amber-100 dark:bg-amber-900/30',
  cobro: 'text-green-600 bg-green-100 dark:bg-green-900/30',
  cierre: 'text-purple-600 bg-purple-100 dark:bg-purple-900/30',
}

/**
 * Línea de tiempo comercial del proyecto (#C05): historia cronológica
 * construida a partir de los timestamps reales de cada hito (creación,
 * presupuestos, adicionales, cobros, cierre). Más reciente arriba.
 */
export function TimelineProyecto({ eventos }: { eventos: EventoTimeline[] }) {
  if (eventos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground px-5 py-6">Sin hitos registrados todavía.</p>
    )
  }

  return (
    <ol className="relative px-5 py-4">
      {eventos.map((e, i) => {
        const Icon = ICONO[e.tipo]
        const contenido = (
          <div className="flex-1 min-w-0 pb-5">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-sm font-medium text-foreground">{e.titulo}</span>
              {e.estado && e.estadoDominio && <EstadoBadge dominio={e.estadoDominio} estado={e.estado} />}
              {e.monto != null && (
                <span className="text-sm font-semibold text-foreground tabular-nums">{formatCurrency(e.monto)}</span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {formatDate(e.fecha)}{e.detalle ? ` · ${e.detalle}` : ''}
            </p>
          </div>
        )
        return (
          <li key={i} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`flex items-center justify-center w-8 h-8 rounded-full shrink-0 ${COLOR[e.tipo]}`}>
                <Icon className="w-4 h-4" />
              </span>
              {i < eventos.length - 1 && <span className="w-px flex-1 bg-border my-1" />}
            </div>
            {e.href ? (
              <Link href={e.href} className="flex-1 min-w-0 hover:opacity-80 transition-opacity">{contenido}</Link>
            ) : (
              contenido
            )}
          </li>
        )
      })}
    </ol>
  )
}
