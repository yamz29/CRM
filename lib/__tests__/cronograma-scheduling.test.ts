import { describe, it, expect } from 'vitest'
import { computeFechas } from '../cronograma-scheduling'

// Helper: construye una actividad mínima con defaults razonables.
type Act = Parameters<typeof computeFechas>[0]

function act(overrides: Partial<Act> = {}): Act {
  return {
    id: 1,
    duracion: 5,
    fechaInicio: new Date('2026-01-10'),
    fechaFin: new Date('2026-01-14'), // 5 días incl.
    dependenciaId: null,
    tipoDependencia: 'FS',
    desfaseDias: 0,
    tipo: 'tarea',
    ...overrides,
  }
}

function iso(d: Date) {
  return d.toISOString().slice(0, 10)
}

describe('computeFechas', () => {
  // ─── SIN PREDECESORA ────────────────────────────────────────────
  describe('sin predecesora', () => {
    it('respeta fechaInicio y recalcula fechaFin por duración', () => {
      const a = act({ fechaInicio: new Date('2026-03-01'), duracion: 10 })
      const { fechaInicio, fechaFin } = computeFechas(a, null)
      expect(iso(fechaInicio)).toBe('2026-03-01')
      expect(iso(fechaFin)).toBe('2026-03-10') // 10 días inclusivos
    })

    it('duracion 1 → fin == inicio', () => {
      const a = act({ fechaInicio: new Date('2026-03-01'), duracion: 1 })
      const r = computeFechas(a, null)
      expect(iso(r.fechaInicio)).toBe('2026-03-01')
      expect(iso(r.fechaFin)).toBe('2026-03-01')
    })

    it('duracion 0 se trata como 1 (fin == inicio)', () => {
      const a = act({ fechaInicio: new Date('2026-03-01'), duracion: 0 })
      const r = computeFechas(a, null)
      expect(iso(r.fechaFin)).toBe('2026-03-01')
    })

    it('duracion negativa no produce fechas inválidas', () => {
      const a = act({ fechaInicio: new Date('2026-03-01'), duracion: -5 })
      const r = computeFechas(a, null)
      expect(iso(r.fechaFin)).toBe('2026-03-01')
    })

    it('hito: fin === inicio independientemente de duracion', () => {
      const a = act({ fechaInicio: new Date('2026-03-15'), duracion: 99, tipo: 'hito' })
      const r = computeFechas(a, null)
      expect(iso(r.fechaInicio)).toBe('2026-03-15')
      expect(iso(r.fechaFin)).toBe('2026-03-15')
    })
  })

  // ─── FS (Finish-to-Start) ──────────────────────────────────────
  describe('FS (Finish-to-Start)', () => {
    const pred = act({ fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-14') })

    it('inicio = predecesora.fin + 1 + desfase', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'FS', desfaseDias: 0, duracion: 3 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-15') // fin pred + 1
      expect(iso(r.fechaFin)).toBe('2026-01-17')   // 3 días
    })

    it('desfase positivo (lag): espera N días adicionales', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'FS', desfaseDias: 3, duracion: 2 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-18') // 15 + 3
      expect(iso(r.fechaFin)).toBe('2026-01-19')
    })

    it('desfase negativo (adelanto): solapa con la predecesora', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'FS', desfaseDias: -2, duracion: 2 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-13') // 15 - 2
    })

    it('hito con FS: fin === inicio', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'FS', tipo: 'hito', duracion: 10 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-15')
      expect(iso(r.fechaFin)).toBe('2026-01-15')
    })

    it('tipoDependencia inválido cae en FS (default)', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'XX', duracion: 3 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-15')
    })
  })

  // ─── SS (Start-to-Start) ───────────────────────────────────────
  describe('SS (Start-to-Start)', () => {
    const pred = act({ fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-14') })

    it('inicio = predecesora.inicio + desfase', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'SS', desfaseDias: 0, duracion: 3 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-10')
      expect(iso(r.fechaFin)).toBe('2026-01-12')
    })

    it('con desfase se desplaza el inicio', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'SS', desfaseDias: 5, duracion: 2 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-15')
      expect(iso(r.fechaFin)).toBe('2026-01-16')
    })

    it('hito con SS: fin === inicio', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'SS', tipo: 'hito', duracion: 99 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaFin)).toBe(iso(r.fechaInicio))
    })
  })

  // ─── FF (Finish-to-Finish) ─────────────────────────────────────
  describe('FF (Finish-to-Finish)', () => {
    const pred = act({ fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-14') })

    it('fin = predecesora.fin + desfase; inicio = fin - duracion + 1', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'FF', desfaseDias: 0, duracion: 5 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaFin)).toBe('2026-01-14')
      expect(iso(r.fechaInicio)).toBe('2026-01-10') // 14 - 5 + 1
    })

    it('con desfase positivo desplaza el fin', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'FF', desfaseDias: 3, duracion: 2 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaFin)).toBe('2026-01-17')
      expect(iso(r.fechaInicio)).toBe('2026-01-16')
    })

    it('hito con FF: inicio = fin', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'FF', tipo: 'hito', duracion: 10 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaInicio)).toBe('2026-01-14')
      expect(iso(r.fechaFin)).toBe('2026-01-14')
    })
  })

  // ─── SF (Start-to-Finish) ──────────────────────────────────────
  describe('SF (Start-to-Finish)', () => {
    const pred = act({ fechaInicio: new Date('2026-01-10'), fechaFin: new Date('2026-01-14') })

    it('fin = predecesora.inicio + desfase; inicio = fin - duracion + 1', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'SF', desfaseDias: 0, duracion: 4 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaFin)).toBe('2026-01-10')
      expect(iso(r.fechaInicio)).toBe('2026-01-07') // 10 - 4 + 1
    })

    it('con desfase positivo', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'SF', desfaseDias: 5, duracion: 3 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaFin)).toBe('2026-01-15')
      expect(iso(r.fechaInicio)).toBe('2026-01-13')
    })

    it('hito con SF: inicio = fin', () => {
      const a = act({ dependenciaId: pred.id, tipoDependencia: 'SF', tipo: 'hito', duracion: 10 })
      const r = computeFechas(a, pred)
      expect(iso(r.fechaFin)).toBe('2026-01-10')
      expect(iso(r.fechaInicio)).toBe('2026-01-10')
    })
  })
})
