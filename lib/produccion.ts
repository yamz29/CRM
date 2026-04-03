// ── Constantes del módulo de Producción ──────────────────────────────

export const ETAPAS_PRODUCCION = [
  { key: 'Compra de Materiales', label: 'Compra Materiales', color: 'purple'  },
  { key: 'Recepcion',           label: 'Recepción',         color: 'indigo'  },
  { key: 'Corte',               label: 'Corte',             color: 'blue'    },
  { key: 'Canteo',              label: 'Canteo',            color: 'cyan'    },
  { key: 'Mecanizacion',        label: 'Mecanización',      color: 'amber'   },
  { key: 'QC Proceso',          label: 'QC Proceso',        color: 'orange'  },
  { key: 'Ensamble',            label: 'Ensamble',          color: 'emerald' },
  { key: 'QC Final',            label: 'QC Final',          color: 'green'   },
] as const

export type EtapaProduccion = typeof ETAPAS_PRODUCCION[number]['key']

export const ETAPA_ORDER: Record<string, number> = Object.fromEntries(
  ETAPAS_PRODUCCION.map((e, i) => [e.key, i])
)

export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const
export const ESTADOS_ORDEN = ['Pendiente', 'En Proceso', 'Completada', 'Cancelada'] as const

// Colores por etapa para badges y columnas kanban
export const ETAPA_COLORS: Record<string, { bg: string; text: string; border: string; dot: string }> = {
  'Compra de Materiales': { bg: 'bg-purple-50 dark:bg-purple-500/10',   text: 'text-purple-700 dark:text-purple-400',   border: 'border-purple-200 dark:border-purple-500/30',   dot: 'bg-purple-500'  },
  'Recepcion':           { bg: 'bg-indigo-50 dark:bg-indigo-500/10',   text: 'text-indigo-700 dark:text-indigo-400',   border: 'border-indigo-200 dark:border-indigo-500/30',   dot: 'bg-indigo-500'  },
  'Corte':               { bg: 'bg-blue-50 dark:bg-blue-500/10',       text: 'text-blue-700 dark:text-blue-400',       border: 'border-blue-200 dark:border-blue-500/30',       dot: 'bg-blue-500'    },
  'Canteo':              { bg: 'bg-cyan-50 dark:bg-cyan-500/10',       text: 'text-cyan-700 dark:text-cyan-400',       border: 'border-cyan-200 dark:border-cyan-500/30',       dot: 'bg-cyan-500'    },
  'Mecanizacion':        { bg: 'bg-amber-50 dark:bg-amber-500/10',     text: 'text-amber-700 dark:text-amber-400',     border: 'border-amber-200 dark:border-amber-500/30',     dot: 'bg-amber-500'   },
  'QC Proceso':          { bg: 'bg-orange-50 dark:bg-orange-500/10',   text: 'text-orange-700 dark:text-orange-400',   border: 'border-orange-200 dark:border-orange-500/30',   dot: 'bg-orange-500'  },
  'Ensamble':            { bg: 'bg-emerald-50 dark:bg-emerald-500/10', text: 'text-emerald-700 dark:text-emerald-400', border: 'border-emerald-200 dark:border-emerald-500/30', dot: 'bg-emerald-500' },
  'QC Final':            { bg: 'bg-green-50 dark:bg-green-500/10',     text: 'text-green-700 dark:text-green-400',     border: 'border-green-200 dark:border-green-500/30',     dot: 'bg-green-500'   },
}

export const PRIORIDAD_COLORS: Record<string, string> = {
  'Alta':  'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
  'Media': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-500/10 dark:text-yellow-400',
  'Baja':  'bg-slate-100 text-slate-600 dark:bg-slate-500/10 dark:text-slate-400',
}

export const ESTADO_COLORS: Record<string, string> = {
  'Pendiente':  'bg-slate-100 text-slate-700 dark:bg-slate-500/10 dark:text-slate-400',
  'En Proceso': 'bg-blue-100 text-blue-700 dark:bg-blue-500/10 dark:text-blue-400',
  'Completada': 'bg-green-100 text-green-700 dark:bg-green-500/10 dark:text-green-400',
  'Cancelada':  'bg-red-100 text-red-700 dark:bg-red-500/10 dark:text-red-400',
}

// QC Checklists por defecto
export const DEFAULT_QC_PROCESO = [
  { item: 'Piezas cortadas a medida correcta', checked: false },
  { item: 'Canteado aplicado correctamente', checked: false },
  { item: 'Mecanizaciones (bisagras, rieles) completas', checked: false },
  { item: 'Sin defectos visuales en superficie', checked: false },
  { item: 'Materiales coinciden con especificación', checked: false },
]

export const DEFAULT_QC_FINAL = [
  { item: 'Ensamble firme y escuadrado', checked: false },
  { item: 'Herrajes funcionales (puertas abren/cierran)', checked: false },
  { item: 'Acabado limpio sin marcas', checked: false },
  { item: 'Dimensiones finales correctas', checked: false },
  { item: 'Módulo listo para instalación', checked: false },
]

export type QCItem = { item: string; checked: boolean; checkedBy?: number; checkedAt?: string }
