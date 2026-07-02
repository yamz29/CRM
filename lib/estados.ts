import { Badge, type BadgeProps } from '@/components/ui/badge'
import { createElement } from 'react'

type Variant = NonNullable<BadgeProps['variant']>

/**
 * Dominios con estado tipado y su mapa estado→variant de Badge.
 *
 * Fuente de verdad única de los colores de estado. Reemplaza las definiciones
 * inline (`bg-green-100 text-green-700`...) dispersas por los listados.
 * Valores verificados contra prisma/schema.prisma (defaults + comentarios).
 */
export type Dominio = 'proyecto' | 'presupuesto' | 'oc' | 'tarea' | 'ruta' | 'gasto' | 'factura' | 'recibo'

const MAPAS: Record<Dominio, Record<string, Variant>> = {
  // Proyecto.estado — schema:43
  proyecto: {
    'Prospecto': 'default',
    'En Cotización': 'info',
    'Adjudicado': 'warning',
    'En Ejecución': 'success',
    'Pausado': 'orange',
    'Terminado': 'secondary',
    'Cancelado': 'danger',
  },
  // Presupuesto.estado — schema:230
  presupuesto: {
    'Borrador': 'default',
    'Enviado': 'info',
    'Aprobado': 'success',
    'Rechazado': 'danger',
  },
  // OrdenCompra.estado — schema:1393 (borrador|enviada|recibida_parcial|recibida|facturada|cancelada)
  oc: {
    'borrador': 'default',
    'enviada': 'info',
    'recibida_parcial': 'warning',
    'recibida': 'success',
    'facturada': 'secondary',
    'cancelada': 'danger',
  },
  // Tarea.estado — schema:501 / TareasPageClient (Pendiente|En proceso|Completada|Cancelada)
  tarea: {
    'Pendiente': 'default',
    'En proceso': 'info',
    'Completada': 'success',
    'Cancelada': 'danger',
  },
  // RutaCompra.estado — schema:1447 (borrador|en_proceso|completada|cancelada)
  ruta: {
    'borrador': 'default',
    'en_proceso': 'warning',
    'completada': 'success',
    'cancelada': 'danger',
  },
  // GastoProyecto.estado — schema:140 (Registrado|Revisado|Anulado)
  gasto: {
    'Registrado': 'warning',
    'Revisado': 'success',
    'Anulado': 'danger',
  },
  // Factura.estado — schema:1266 (pendiente|parcial|pagada|anulada); 'vencida' es derivado
  factura: {
    'pendiente': 'warning',
    'parcial': 'info',
    'pagada': 'success',
    'anulada': 'danger',
    'vencida': 'danger',
  },
  // Recibo.estado (sin_aplicar|parcial|aplicado|anulado)
  recibo: {
    'sin_aplicar': 'warning',
    'parcial': 'info',
    'aplicado': 'success',
    'anulado': 'danger',
  },
}

/**
 * Etiquetas de display por dominio. Solo se definen donde el valor crudo NO es
 * presentable (estados en minúsculas/snake_case de oc/ruta/factura). Para los
 * dominios cuyo estado ya es legible (proyecto, presupuesto, tarea, gasto) se
 * muestra el estado tal cual.
 */
const ETIQUETAS: Partial<Record<Dominio, Record<string, string>>> = {
  oc: {
    'borrador': 'Borrador',
    'enviada': 'Enviada',
    'recibida_parcial': 'Recibida parcial',
    'recibida': 'Recibida',
    'facturada': 'Facturada',
    'cancelada': 'Cancelada',
  },
  ruta: {
    'borrador': 'Borrador',
    'en_proceso': 'En proceso',
    'completada': 'Completada',
    'cancelada': 'Cancelada',
  },
  factura: {
    'pendiente': 'Pendiente',
    'parcial': 'Parcial',
    'pagada': 'Pagada',
    'anulada': 'Anulada',
    'vencida': 'Vencida',
  },
  recibo: {
    'sin_aplicar': 'Sin aplicar',
    'parcial': 'Parcial',
    'aplicado': 'Aplicado',
    'anulado': 'Anulado',
  },
}

/** Devuelve la variant de Badge para un estado de un dominio dado. Default ante desconocido. */
export function variantDeEstado(dominio: Dominio, estado: string): Variant {
  return MAPAS[dominio]?.[estado] ?? 'default'
}

/** Devuelve la etiqueta de display de un estado. Cae al valor crudo si no hay mapeo. */
export function etiquetaDeEstado(dominio: Dominio, estado: string): string {
  return ETIQUETAS[dominio]?.[estado] ?? estado
}

/** Badge de estado por dominio. Reemplaza badges de estado hardcodeados. */
export function EstadoBadge({ dominio, estado, etiqueta }: { dominio: Dominio; estado: string; etiqueta?: string }) {
  return createElement(
    Badge,
    { variant: variantDeEstado(dominio, estado) },
    etiqueta ?? etiquetaDeEstado(dominio, estado),
  )
}
