import { describe, it, expect } from 'vitest'
import { avanceEsperadoActividad, calcularResumen, type ActividadResumen } from '../cronograma-resumen'

function actividad(overrides: Partial<ActividadResumen> = {}): ActividadResumen {
  return {
    fechaInicio: new Date('2026-01-10'),
    fechaFin: new Date('2026-01-20'),
    pctAvance: 0,
    tipo: 'tarea',
    ...overrides,
  }
}

describe('avanceEsperadoActividad', () => {
  it('devuelve 0 antes del inicio', () => {
    expect(avanceEsperadoActividad(actividad(), new Date('2026-01-05'))).toBe(0)
  })

  it('devuelve 100 después del fin', () => {
    expect(avanceEsperadoActividad(actividad(), new Date('2026-01-25'))).toBe(100)
  })

  it('interpola linealmente a mitad de la ventana', () => {
    // inicio 10, fin 20 → 10 días de ventana; el día 15 = 50%
    expect(avanceEsperadoActividad(actividad(), new Date('2026-01-15'))).toBeCloseTo(50, 5)
  })

  it('un hito (inicio===fin) es 100 si ya llegó la fecha, si no 0', () => {
    const hito = actividad({ fechaInicio: new Date('2026-01-15'), fechaFin: new Date('2026-01-15'), tipo: 'hito' })
    expect(avanceEsperadoActividad(hito, new Date('2026-01-14'))).toBe(0)
    expect(avanceEsperadoActividad(hito, new Date('2026-01-15'))).toBe(100)
  })
})

describe('calcularResumen', () => {
  it('sin actividades devuelve finProyectado null y avances en 0', () => {
    const r = calcularResumen([], new Date('2026-01-10'), null, new Date('2026-01-12'))
    expect(r.finProyectado).toBeNull()
    expect(r.avanceReal).toBe(0)
    expect(r.avanceEsperado).toBe(0)
    expect(r.diasDesviacion).toBeNull()
  })

  it('fin proyectado = la fecha de fin más tardía', () => {
    const acts = [
      actividad({ fechaFin: new Date('2026-01-20') }),
      actividad({ fechaFin: new Date('2026-02-05') }),
    ]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.finProyectado?.toISOString().slice(0, 10)).toBe('2026-02-05')
  })

  it('avance real = promedio simple de pctAvance', () => {
    const acts = [actividad({ pctAvance: 100 }), actividad({ pctAvance: 0 })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.avanceReal).toBe(50)
  })

  it('delta avance = real - esperado', () => {
    // actividad 10→20; al día 15 esperado=50. Avance real 30 → delta -20.
    const acts = [actividad({ pctAvance: 30 })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.avanceEsperado).toBe(50)
    expect(r.deltaAvance).toBe(-20)
  })

  it('desviación en días = fin proyectado - meta (positivo = atrasado)', () => {
    const acts = [actividad({ fechaFin: new Date('2026-01-24') })]
    const r = calcularResumen(acts, new Date('2026-01-10'), new Date('2026-01-20'), new Date('2026-01-15'))
    expect(r.diasDesviacion).toBe(4)
  })

  it('días transcurridos y restantes', () => {
    const acts = [actividad({ fechaFin: new Date('2026-01-20') })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.diasTranscurridos).toBe(5)
    expect(r.diasRestantes).toBe(5)
  })

  it('días restantes negativo cuando el fin proyectado ya pasó', () => {
    const acts = [actividad({ fechaFin: new Date('2026-01-12') })]
    const r = calcularResumen(acts, new Date('2026-01-10'), null, new Date('2026-01-15'))
    expect(r.diasRestantes).toBe(-3)
  })
})
