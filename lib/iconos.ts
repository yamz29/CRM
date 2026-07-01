import {
  Users, FolderOpen, FileText, FileSpreadsheet, Package, Receipt,
  CheckSquare, Clock, UserCog, Wallet, ShoppingCart, Truck, Landmark,
  Box, GanttChart, MapPin, TrendingUp, Banknote, ChefHat, Factory,
} from 'lucide-react'

/**
 * Icono canónico por concepto del dominio (#H40). Fuente única para que el
 * mismo concepto use SIEMPRE el mismo icono (ej. "proyecto" = FolderOpen en
 * todos lados, no Building2 en unos sitios y FolderOpen en otros).
 *
 * Adopción incremental: los componentes nuevos importan de acá; los usos
 * dispersos existentes se migran cuando se tocan esos archivos.
 */
export const ICONO = {
  cliente: Users,
  proyecto: FolderOpen,
  presupuesto: FileText,
  apu: FileSpreadsheet,
  recurso: Package,
  gasto: Receipt,
  tarea: CheckSquare,
  hora: Clock,
  empleado: UserCog,
  nomina: Wallet,
  compra: ShoppingCart,
  proveedor: Truck,
  contabilidad: Landmark,
  factura: Receipt,
  cobro: Banknote,
  modulo: Box,
  cronograma: GanttChart,
  parada: MapPin,
  oportunidad: TrendingUp,
  cocina: ChefHat,
  produccion: Factory,
} as const

export type ConceptoIcono = keyof typeof ICONO
