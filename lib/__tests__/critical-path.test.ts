import { describe, it, expect } from 'vitest'
import { calcularCriticalPath, type ActividadCpm } from '../critical-path'

function d(iso: string): Date {
  return new Date(iso + 'T00:00:00Z')
}

function act(overrides: Partial<ActividadCpm> & Pick<ActividadCpm, 'id'>): ActividadCpm {
  return {
    duracion: 1,
    fechaInicio: d('2026-04-20'),
    fechaFin: d('2026-04-20'),
    dependenciaId: null,
    tipoDependencia: 'FS',
    desfaseDias: 0,
    tipo: 'tarea',
    ...overrides,
  }
}

describe('calcularCriticalPath', () => {
  it('array vacío retorna array vacío', () => {
    expect(calcularCriticalPath([])).toEqual([])
  })

  it('una sola actividad es crítica', () => {
    const acts = [act({ id: 1, duracion: 5, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-24') })]
    const r = calcularCriticalPath(acts, { usarCalendarioLaboral: true })
    expect(r).toHaveLength(1)
    expect(r[0].esCritica).toBe(true)
    expect(r[0].holguraDias).toBe(0)
  })

  it('cadena lineal: todas críticas', () => {
    // A (5d) → B (3d) → C (2d), FS en cadena
    const acts = [
      act({ id: 1, duracion: 5, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-24') }),
      act({ id: 2, duracion: 3, fechaInicio: d('2026-04-27'), fechaFin: d('2026-04-29'),
            dependenciaId: 1, tipoDependencia: 'FS' }),
      act({ id: 3, duracion: 2, fechaInicio: d('2026-04-30'), fechaFin: d('2026-05-01'),
            dependenciaId: 2, tipoDependencia: 'FS' }),
    ]
    const r = calcularCriticalPath(acts, { usarCalendarioLaboral: true })
    expect(r.every(a => a.esCritica)).toBe(true)
    expect(r.every(a => a.holguraDias === 0)).toBe(true)
  })

  it('ramas paralelas: la rama más corta tiene holgura', () => {
    // A (1d) → B (5d) → D (1d)  ← camino crítico (7d)
    // A (1d) → C (2d) → D       ← holgura 3d
    const acts = [
      act({ id: 1, duracion: 1, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-20') }),  // A
      act({ id: 2, duracion: 5, fechaInicio: d('2026-04-21'), fechaFin: d('2026-04-27'),
            dependenciaId: 1, tipoDependencia: 'FS' }),  // B (rama larga)
      act({ id: 3, duracion: 2, fechaInicio: d('2026-04-21'), fechaFin: d('2026-04-22'),
            dependenciaId: 1, tipoDependencia: 'FS' }),  // C (rama corta)
      act({ id: 4, duracion: 1, fechaInicio: d('2026-04-28'), fechaFin: d('2026-04-28'),
            dependenciaId: 2, tipoDependencia: 'FS' }),  // D depende de B (más tarde)
    ]
    const r = calcularCriticalPath(acts, { usarCalendarioLaboral: true })
    const byId = new Map(r.map(x => [x.id, x]))
    // A es crítica (única predecesora de todo)
    expect(byId.get(1)!.esCritica).toBe(true)
    // B está en la rama crítica
    expect(byId.get(2)!.esCritica).toBe(true)
    // D es crítica (fin del proyecto)
    expect(byId.get(4)!.esCritica).toBe(true)
    // C NO es crítica (la rama corta tiene holgura)
    expect(byId.get(3)!.esCritica).toBe(false)
    expect(byId.get(3)!.holguraDias).toBeGreaterThan(0)
  })

  it('hito al final de cadena es crítico', () => {
    const acts = [
      act({ id: 1, duracion: 5, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-24') }),
      act({ id: 2, duracion: 0, fechaInicio: d('2026-04-27'), fechaFin: d('2026-04-27'),
            dependenciaId: 1, tipoDependencia: 'FS', tipo: 'hito' }),
    ]
    const r = calcularCriticalPath(acts, { usarCalendarioLaboral: true })
    expect(r.find(x => x.id === 2)!.esCritica).toBe(true)
  })

  it('detecta ciclos y lanza error', () => {
    // A depende de B, B depende de A — ciclo
    const acts = [
      act({ id: 1, dependenciaId: 2 }),
      act({ id: 2, dependenciaId: 1 }),
    ]
    expect(() => calcularCriticalPath(acts)).toThrow(/Ciclo/)
  })

  it('actividad sin predecesora con holgura cuando hay otra rama más larga', () => {
    // Inicio 1: A (2d) → C (1d)
    // Inicio 2: B (5d) → C (1d)
    // C (1d) final
    // La rama B es la crítica, A tiene holgura
    const acts = [
      act({ id: 1, duracion: 2, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-21') }),  // A
      act({ id: 2, duracion: 5, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-24') }),  // B
      act({ id: 3, duracion: 1, fechaInicio: d('2026-04-27'), fechaFin: d('2026-04-27'),
            dependenciaId: 2, tipoDependencia: 'FS' }),  // C depende de B (la más larga)
    ]
    const r = calcularCriticalPath(acts, { usarCalendarioLaboral: true })
    const byId = new Map(r.map(x => [x.id, x]))
    expect(byId.get(2)!.esCritica).toBe(true)
    expect(byId.get(3)!.esCritica).toBe(true)
    // A no bloquea nada → no crítica
    expect(byId.get(1)!.esCritica).toBe(false)
  })

  it('sin predecesora y sin sucesoras: es crítica (es un "proyecto de 1 tarea")', () => {
    const acts = [act({ id: 1, duracion: 3, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-22') })]
    const r = calcularCriticalPath(acts, { usarCalendarioLaboral: true })
    expect(r[0].esCritica).toBe(true)
  })

  it('retorna resultados en el mismo orden que el input', () => {
    const acts = [
      act({ id: 3, duracion: 1, fechaInicio: d('2026-04-22'), fechaFin: d('2026-04-22'),
            dependenciaId: 2, tipoDependencia: 'FS' }),
      act({ id: 1, duracion: 1, fechaInicio: d('2026-04-20'), fechaFin: d('2026-04-20') }),
      act({ id: 2, duracion: 1, fechaInicio: d('2026-04-21'), fechaFin: d('2026-04-21'),
            dependenciaId: 1, tipoDependencia: 'FS' }),
    ]
    const r = calcularCriticalPath(acts, { usarCalendarioLaboral: true })
    expect(r.map(x => x.id)).toEqual([3, 1, 2])
  })
})
