// Tipos y constantes compartidos del módulo de gastos (extraídos de GastosTab, #H26).

export interface Gasto {
  id: number
  fecha: string
  tipoGasto: string
  referencia: string | null
  descripcion: string
  suplidor: string | null
  categoria: string | null
  subcategoria: string | null
  monto: number
  moneda: string
  metodoPago: string
  cuentaOrigen: string | null
  observaciones: string | null
  estado: string
  archivoUrl: string | null
  createdAt: string
  partidaId: number | null
  partida: { id: number; descripcion: string; codigo: string | null } | null
}

export interface PartidaOption {
  id: number
  descripcion: string
  codigo: string | null
  capituloNombre: string | null
  subtotalPresupuestado: number
}

export const TIPO_COLORS: Record<string, string> = {
  'Factura': 'bg-blue-100 text-blue-700',
  'Gasto menor': 'bg-muted text-muted-foreground',
  'Transferencia': 'bg-purple-100 text-purple-700',
  'Caja chica': 'bg-amber-100 text-amber-700',
  'Compra de materiales': 'bg-orange-100 text-orange-700',
  'Mano de obra': 'bg-green-100 text-green-700',
  'Transporte': 'bg-cyan-100 text-cyan-700',
  'Subcontrato': 'bg-indigo-100 text-indigo-700',
  'Servicio': 'bg-teal-100 text-teal-700',
  'Otro': 'bg-muted text-muted-foreground',
}

export const ESTADO_COLORS: Record<string, string> = {
  'Registrado': 'bg-blue-100 text-blue-700',
  'Revisado': 'bg-green-100 text-green-700',
  'Anulado': 'bg-red-100 text-red-500 line-through',
}

export const TIPOS_GASTO = ['Factura', 'Gasto menor', 'Transferencia', 'Caja chica', 'Compra de materiales', 'Mano de obra', 'Transporte', 'Subcontrato', 'Servicio', 'Otro']
export const METODOS_PAGO = ['Efectivo', 'Transferencia', 'Tarjeta', 'Cheque', 'Caja chica', 'Otro']
export const ESTADOS = ['Registrado', 'Revisado', 'Anulado']

export const COL_LABELS: Record<string, string> = {
  fecha:     'Fecha',
  tipo:      'Tipo',
  referencia:'Ref.',
  descripcion:'Descripción',
  suplidor:  'Suplidor',
  categoria: 'Categoría',
  pago:      'Método pago',
  partida:   'Partida presupuestaria',
  monto:     'Monto',
  estado:    'Estado',
  adjunto:   'Adjunto',
}

export const DEFAULT_COLS: Record<string, boolean> = {
  fecha: true, tipo: true, referencia: true, descripcion: true,
  suplidor: true, categoria: true, pago: true, partida: true,
  monto: true, estado: true, adjunto: false,
}

export const ALWAYS_VISIBLE = new Set(['descripcion', 'monto'])
export const LS_KEY = 'gastos_cols_v1'

export function loadCols(): Record<string, boolean> {
  try {
    const s = typeof window !== 'undefined' ? localStorage.getItem(LS_KEY) : null
    return s ? { ...DEFAULT_COLS, ...JSON.parse(s) } : { ...DEFAULT_COLS }
  } catch { return { ...DEFAULT_COLS } }
}
