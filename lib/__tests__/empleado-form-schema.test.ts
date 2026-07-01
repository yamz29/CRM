import { describe, it, expect } from 'vitest'
import { validarEmpleado } from '@/lib/empleado-form-schema'

const base = { nombre: 'Juan', fechaIngreso: '2026-01-01', correo: '', salario: '' }

describe('validarEmpleado', () => {
  it('form válido → sin errores', () => {
    expect(validarEmpleado(base)).toEqual({})
  })

  it('exige nombre y fecha de ingreso', () => {
    const e = validarEmpleado({ ...base, nombre: '  ', fechaIngreso: '' })
    expect(e.nombre).toBeTruthy()
    expect(e.fechaIngreso).toBeTruthy()
  })

  it('valida correo solo si viene', () => {
    expect(validarEmpleado({ ...base, correo: '' }).correo).toBeUndefined()
    expect(validarEmpleado({ ...base, correo: 'no-es-correo' }).correo).toBeTruthy()
    expect(validarEmpleado({ ...base, correo: 'a@b.com' }).correo).toBeUndefined()
  })

  it('valida salario numérico solo si viene', () => {
    expect(validarEmpleado({ ...base, salario: '' }).salario).toBeUndefined()
    expect(validarEmpleado({ ...base, salario: 'abc' }).salario).toBeTruthy()
    expect(validarEmpleado({ ...base, salario: '15000.50' }).salario).toBeUndefined()
  })
})
