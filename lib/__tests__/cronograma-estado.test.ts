import { describe, it, expect } from 'vitest'
import { derivarEstadoActividad, derivarEstados } from '@/lib/cronograma-estado'

const hoy = new Date('2026-07-01')
const ayer = '2026-06-25'
const manana = '2026-07-10'

describe('derivarEstadoActividad', () => {
  it('100% o más → Completado (aunque la fecha haya pasado)', () => {
    expect(derivarEstadoActividad(100, ayer, hoy)).toBe('Completado')
    expect(derivarEstadoActividad(120, manana, hoy)).toBe('Completado')
  })

  it('avance parcial: futuro → En Ejecución, vencido → Atrasado', () => {
    expect(derivarEstadoActividad(40, manana, hoy)).toBe('En Ejecución')
    expect(derivarEstadoActividad(40, ayer, hoy)).toBe('Atrasado')
  })

  it('sin avance: futuro → Pendiente, vencido → Atrasado', () => {
    expect(derivarEstadoActividad(0, manana, hoy)).toBe('Pendiente')
    expect(derivarEstadoActividad(0, ayer, hoy)).toBe('Atrasado')
  })
})

describe('derivarEstados', () => {
  it('aplica el estado a cada actividad sin mutar el original', () => {
    const acts = [{ pctAvance: 100, fechaFin: ayer }, { pctAvance: 0, fechaFin: ayer }]
    const res = derivarEstados(acts, hoy)
    expect(res.map(a => a.estado)).toEqual(['Completado', 'Atrasado'])
    expect(acts[0]).not.toHaveProperty('estado')
  })
})
