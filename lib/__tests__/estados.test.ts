import { describe, it, expect } from 'vitest'
import { variantDeEstado } from '@/lib/estados'

describe('variantDeEstado', () => {
  it('mapea estados de proyecto conocidos', () => {
    expect(variantDeEstado('proyecto', 'En Ejecución')).toBe('success')
    expect(variantDeEstado('proyecto', 'Pausado')).toBe('orange')
    expect(variantDeEstado('proyecto', 'Cancelado')).toBe('danger')
  })

  it('mapea estados de presupuesto', () => {
    expect(variantDeEstado('presupuesto', 'Aprobado')).toBe('success')
    expect(variantDeEstado('presupuesto', 'Rechazado')).toBe('danger')
  })

  it('mapea estados de orden de compra y ruta (minúsculas)', () => {
    expect(variantDeEstado('oc', 'recibida')).toBe('success')
    expect(variantDeEstado('oc', 'cancelada')).toBe('danger')
    expect(variantDeEstado('ruta', 'completada')).toBe('success')
  })

  it('mapea estados de tarea, gasto y factura', () => {
    expect(variantDeEstado('tarea', 'En proceso')).toBe('info')
    expect(variantDeEstado('gasto', 'Revisado')).toBe('success')
    expect(variantDeEstado('factura', 'pagada')).toBe('success')
  })

  it('cae a default ante estado desconocido', () => {
    expect(variantDeEstado('proyecto', 'Marciano')).toBe('default')
  })
})
