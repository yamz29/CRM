import { describe, it, expect } from 'vitest'
import {
  esDiaLaboral,
  addWorkingDays,
  diffWorkingDays,
  feriadosDominicanos,
} from '../calendario-laboral'

// Helper: fecha UTC
function d(iso: string): Date {
  return new Date(iso + 'T00:00:00Z')
}

describe('esDiaLaboral', () => {
  it('miércoles es día laboral', () => {
    expect(esDiaLaboral(d('2026-04-22'))).toBe(true) // miércoles
  })

  it('sábado no es día laboral', () => {
    expect(esDiaLaboral(d('2026-04-25'))).toBe(false) // sábado
  })

  it('domingo no es día laboral', () => {
    expect(esDiaLaboral(d('2026-04-26'))).toBe(false) // domingo
  })

  it('si usarCalendarioLaboral=false, todos son días laborales', () => {
    expect(esDiaLaboral(d('2026-04-25'), { usarCalendarioLaboral: false })).toBe(true)
  })

  it('feriado no es día laboral', () => {
    const feriados = [d('2026-05-01')]
    expect(esDiaLaboral(d('2026-05-01'), { feriados })).toBe(false) // 1-may Trabajo
  })

  it('día laboral no en lista de feriados sigue siendo laboral', () => {
    const feriados = [d('2026-05-01')]
    expect(esDiaLaboral(d('2026-05-04'), { feriados })).toBe(true) // lunes normal
  })
})

describe('addWorkingDays', () => {
  it('suma 1 día laboral desde miércoles → jueves', () => {
    const r = addWorkingDays(d('2026-04-22'), 1)
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-23')
  })

  it('suma 3 días laborales desde viernes salta fin de semana → miércoles', () => {
    const r = addWorkingDays(d('2026-04-24'), 3) // viernes
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-29') // miércoles
  })

  it('suma 5 días laborales = 1 semana completa', () => {
    const r = addWorkingDays(d('2026-04-20'), 5) // lunes
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-27') // lunes siguiente
  })

  it('suma negativa resta días laborales', () => {
    const r = addWorkingDays(d('2026-04-29'), -3) // miércoles
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-24') // viernes anterior
  })

  it('suma 0 desde día laboral retorna el mismo día', () => {
    const r = addWorkingDays(d('2026-04-22'), 0)
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-22')
  })

  it('suma 0 desde sábado avanza al lunes', () => {
    const r = addWorkingDays(d('2026-04-25'), 0) // sábado
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-27') // lunes
  })

  it('salta feriado cuando se pasa la lista', () => {
    const feriados = [d('2026-04-27')] // lunes 27 como feriado ficticio
    const r = addWorkingDays(d('2026-04-24'), 1, { feriados }) // viernes + 1
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-28') // martes, saltó feriado
  })

  it('usarCalendarioLaboral=false es suma directa', () => {
    const r = addWorkingDays(d('2026-04-24'), 3, { usarCalendarioLaboral: false })
    expect(r.toISOString().slice(0, 10)).toBe('2026-04-27') // 24 + 3 días calendario
  })
})

describe('diffWorkingDays', () => {
  it('lunes a viernes de la misma semana = 5 días laborales', () => {
    expect(diffWorkingDays(d('2026-04-20'), d('2026-04-24'))).toBe(5)
  })

  it('lunes a lunes siguiente = 6 días laborales', () => {
    expect(diffWorkingDays(d('2026-04-20'), d('2026-04-27'))).toBe(6)
  })

  it('sólo fin de semana = 0 días laborales', () => {
    expect(diffWorkingDays(d('2026-04-25'), d('2026-04-26'))).toBe(0)
  })

  it('rango invertido = 0', () => {
    expect(diffWorkingDays(d('2026-04-24'), d('2026-04-20'))).toBe(0)
  })

  it('salta feriados en el rango', () => {
    // Semana 27/04 - 01/05 con feriado el 1-may
    const feriados = [d('2026-05-01')]
    expect(diffWorkingDays(d('2026-04-27'), d('2026-05-01'), { feriados })).toBe(4)
  })
})

describe('feriadosDominicanos', () => {
  it('retorna 12 feriados (10 fijos + 2 variables)', () => {
    const lista = feriadosDominicanos(2026)
    expect(lista).toHaveLength(12)
  })

  it('incluye Año Nuevo el 1 de enero', () => {
    const lista = feriadosDominicanos(2026)
    const anoNuevo = lista.find(f => f.nombre === 'Año Nuevo')
    expect(anoNuevo?.fecha.toISOString().slice(0, 10)).toBe('2026-01-01')
  })

  it('incluye Independencia el 27 de febrero', () => {
    const lista = feriadosDominicanos(2026)
    const indep = lista.find(f => f.nombre === 'Día de la Independencia')
    expect(indep?.fecha.toISOString().slice(0, 10)).toBe('2026-02-27')
  })

  it('Viernes Santo 2026 es 3 de abril', () => {
    const lista = feriadosDominicanos(2026)
    const vs = lista.find(f => f.nombre === 'Viernes Santo')
    expect(vs?.fecha.toISOString().slice(0, 10)).toBe('2026-04-03')
  })

  it('Viernes Santo 2024 es 29 de marzo (verificación algoritmo Pascua)', () => {
    const lista = feriadosDominicanos(2024)
    const vs = lista.find(f => f.nombre === 'Viernes Santo')
    expect(vs?.fecha.toISOString().slice(0, 10)).toBe('2024-03-29')
  })

  it('Navidad el 25 de diciembre', () => {
    const lista = feriadosDominicanos(2026)
    const nav = lista.find(f => f.nombre === 'Navidad')
    expect(nav?.fecha.toISOString().slice(0, 10)).toBe('2026-12-25')
  })

  it('los fijos tienen recurrente=true, los variables false', () => {
    const lista = feriadosDominicanos(2026)
    expect(lista.find(f => f.nombre === 'Año Nuevo')?.recurrente).toBe(true)
    expect(lista.find(f => f.nombre === 'Viernes Santo')?.recurrente).toBe(false)
    expect(lista.find(f => f.nombre === 'Corpus Christi')?.recurrente).toBe(false)
  })
})
