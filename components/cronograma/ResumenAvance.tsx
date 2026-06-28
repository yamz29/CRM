'use client'

import { useState } from 'react'
import { formatDate } from '@/lib/utils'
import { CalendarCheck, TrendingUp, Clock, Pencil } from 'lucide-react'
import { EditarCronogramaModal, type CronogramaEditable } from './EditarCronogramaModal'
import type { ResumenAvance as ResumenData } from '@/lib/cronograma-resumen'

interface Props {
  cronograma: CronogramaEditable
  resumen: ResumenData
  proyectos: { id: number; nombre: string }[]
  presupuestos: { id: number; numero: string }[]
  readOnly?: boolean
}

function plural(n: number, sing: string, plur: string) {
  return `${n} ${Math.abs(n) === 1 ? sing : plur}`
}

export function ResumenAvance({ cronograma, resumen, proyectos, presupuestos, readOnly = false }: Props) {
  const [editando, setEditando] = useState(false)
  const {
    finProyectado, avanceReal, avanceEsperado, deltaAvance,
    diasDesviacion, diasTranscurridos, diasRestantes,
  } = resumen

  const sinActividades = finProyectado === null

  // Plan vs proyección
  let desviacion: { label: string; cls: string } | null = null
  if (diasDesviacion !== null) {
    if (diasDesviacion > 0) desviacion = { label: `${plural(diasDesviacion, 'día', 'días')} atrasado`, cls: 'text-red-600 dark:text-red-400' }
    else if (diasDesviacion < 0) desviacion = { label: `${plural(Math.abs(diasDesviacion), 'día', 'días')} adelantado`, cls: 'text-green-600 dark:text-green-400' }
    else desviacion = { label: 'En fecha', cls: 'text-green-600 dark:text-green-400' }
  }

  // Delta avance
  let delta: { label: string; cls: string }
  if (avanceReal >= 100) delta = { label: 'Completado', cls: 'text-teal-600 dark:text-teal-400' }
  else if (deltaAvance > 0) delta = { label: `${deltaAvance}% por encima del plan`, cls: 'text-green-600 dark:text-green-400' }
  else if (deltaAvance < 0) delta = { label: `${Math.abs(deltaAvance)}% por debajo del plan`, cls: 'text-red-600 dark:text-red-400' }
  else delta = { label: 'Al día', cls: 'text-green-600 dark:text-green-400' }

  // Tiempo
  let tiempo = '—'
  if (!sinActividades) {
    tiempo = diasRestantes < 0
      ? `Vencido hace ${plural(Math.abs(diasRestantes), 'día', 'días')}`
      : `${plural(diasRestantes, 'día', 'días')} restantes`
  }

  return (
    <div className="border border-border rounded-xl bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-semibold text-foreground">Resumen de avance</h2>
        {!readOnly && (
          <button onClick={() => setEditando(true)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-primary transition-colors">
            <Pencil className="w-3.5 h-3.5" /> Editar cronograma
          </button>
        )}
      </div>

      {sinActividades ? (
        <p className="text-sm text-muted-foreground">
          Sin actividades aún. Agrega actividades para ver la proyección de fin y el avance real.
        </p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {/* Plan vs proyección */}
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <CalendarCheck className="w-3.5 h-3.5" /> Fin proyectado
            </p>
            <p className="text-base font-semibold text-foreground">{formatDate(finProyectado)}</p>
            {cronograma.fechaFinEstimado ? (
              <p className="text-xs text-muted-foreground">
                Meta: {formatDate(cronograma.fechaFinEstimado)}
                {desviacion && <> · <span className={`font-medium ${desviacion.cls}`}>{desviacion.label}</span></>}
              </p>
            ) : (
              !readOnly && (
                <button onClick={() => setEditando(true)} className="text-xs text-primary hover:underline">
                  Definir meta
                </button>
              )
            )}
          </div>

          {/* Avance esperado vs real */}
          <div className="space-y-1.5">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <TrendingUp className="w-3.5 h-3.5" /> Avance real vs esperado
            </p>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="text-2xs text-muted-foreground w-12 shrink-0">Real</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-blue-500" style={{ width: `${Math.min(100, avanceReal)}%` }} />
                </div>
                <span className="text-xs font-semibold text-foreground w-9 text-right">{avanceReal}%</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-2xs text-muted-foreground w-12 shrink-0">Esperado</span>
                <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                  <div className="h-full bg-slate-400 dark:bg-slate-500" style={{ width: `${Math.min(100, avanceEsperado)}%` }} />
                </div>
                <span className="text-xs text-muted-foreground w-9 text-right">{avanceEsperado}%</span>
              </div>
            </div>
            <p className={`text-xs font-medium ${delta.cls}`}>{delta.label}</p>
          </div>

          {/* Tiempo */}
          <div className="space-y-1">
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="w-3.5 h-3.5" /> Tiempo
            </p>
            <p className="text-base font-semibold text-foreground">{tiempo}</p>
            <p className="text-xs text-muted-foreground">{plural(diasTranscurridos, 'día transcurrido', 'días transcurridos')}</p>
          </div>
        </div>
      )}

      {editando && (
        <EditarCronogramaModal
          cronograma={cronograma}
          proyectos={proyectos}
          presupuestos={presupuestos}
          onClose={() => setEditando(false)}
        />
      )}
    </div>
  )
}
