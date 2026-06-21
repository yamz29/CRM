import { describe, it, expect } from 'vitest'
import {
  calcularPoolReal, montoPorcentaje, totalPorcentaje, validarReparto,
  sumarOverheadDistribuido, esGastoOverhead, type GastoOverheadRow,
  normalizarPesos, PESOS_SUGERENCIA_DEFAULT, type PesosSugerencia,
} from '../overhead'

const gasto = (over: Partial<GastoOverheadRow>): GastoOverheadRow => ({
  monto: 1000, moneda: 'RD$', estado: 'Registrado', destinoTipo: 'oficina', ...over,
})

describe('esGastoOverhead', () => {
  it('reconoce oficina/taller/general como overhead', () => {
    expect(esGastoOverhead('oficina')).toBe(true)
    expect(esGastoOverhead('taller')).toBe(true)
    expect(esGastoOverhead('general')).toBe(true)
  })
  it('excluye proyecto, sin_asignar y nulos', () => {
    expect(esGastoOverhead('proyecto')).toBe(false)
    expect(esGastoOverhead('sin_asignar')).toBe(false)
    expect(esGastoOverhead(null)).toBe(false)
    expect(esGastoOverhead(undefined)).toBe(false)
  })
})

describe('calcularPoolReal', () => {
  it('suma solo overhead RD$ no anulado', () => {
    const gastos = [
      gasto({ monto: 1000, destinoTipo: 'oficina' }),
      gasto({ monto: 500, destinoTipo: 'taller' }),
      gasto({ monto: 2000, destinoTipo: 'proyecto' }),   // excluido: no overhead
      gasto({ monto: 300, destinoTipo: 'general', estado: 'Anulado' }), // excluido: anulado
      gasto({ monto: 999, destinoTipo: 'general', moneda: 'USD' }),     // excluido: otra moneda
      gasto({ monto: 200, destinoTipo: 'sin_asignar' }), // excluido: sin_asignar no se reparte
    ]
    expect(calcularPoolReal(gastos)).toBe(1500)
  })
  it('devuelve 0 sin gastos', () => {
    expect(calcularPoolReal([])).toBe(0)
  })
})

describe('montoPorcentaje', () => {
  it('calcula pool × % / 100', () => {
    expect(montoPorcentaje(10000, 25)).toBe(2500)
    expect(montoPorcentaje(10000, 0)).toBe(0)
  })
})

describe('totalPorcentaje / validarReparto', () => {
  it('suma porcentajes', () => {
    expect(totalPorcentaje([{ proyectoId: 1, porcentaje: 30 }, { proyectoId: 2, porcentaje: 20 }])).toBe(50)
  })
  it('acepta reparto que suma <= 100', () => {
    expect(validarReparto([{ proyectoId: 1, porcentaje: 60 }, { proyectoId: 2, porcentaje: 40 }])).toBeNull()
  })
  it('tolera ±0.01 sobre 100', () => {
    expect(validarReparto([{ proyectoId: 1, porcentaje: 100.005 }])).toBeNull()
  })
  it('rechaza suma > 100', () => {
    expect(validarReparto([{ proyectoId: 1, porcentaje: 60 }, { proyectoId: 2, porcentaje: 50 }])).not.toBeNull()
  })
  it('rechaza porcentajes negativos', () => {
    expect(validarReparto([{ proyectoId: 1, porcentaje: -5 }])).not.toBeNull()
  })
})

describe('sumarOverheadDistribuido', () => {
  it('suma montoAsignado de todas las filas', () => {
    expect(sumarOverheadDistribuido([{ montoAsignado: 1500 }, { montoAsignado: 2500 }])).toBe(4000)
  })
  it('devuelve 0 sin filas', () => {
    expect(sumarOverheadDistribuido([])).toBe(0)
  })
})

describe('normalizarPesos', () => {
  it('los defaults suman 1', () => {
    const p = PESOS_SUGERENCIA_DEFAULT
    const suma = p.costoMes + p.horas + p.costoAcum + p.presupuesto + p.avance
    expect(suma).toBeCloseTo(1, 6)
  })
  it('re-normaliza a 1 cuando no suman 1', () => {
    const pesos: PesosSugerencia = { costoMes: 2, horas: 2, costoAcum: 0, presupuesto: 0, avance: 0 }
    const vivas = { costoMes: true, horas: true, costoAcum: true, presupuesto: true, avance: true }
    const r = normalizarPesos(pesos, vivas)
    expect(r.costoMes).toBeCloseTo(0.5, 6)
    expect(r.horas).toBeCloseTo(0.5, 6)
  })
  it('redistribuye el peso de señales muertas entre las vivas', () => {
    const vivas = { costoMes: true, horas: true, costoAcum: true, presupuesto: true, avance: false }
    const r = normalizarPesos(PESOS_SUGERENCIA_DEFAULT, vivas)
    expect(r.avance).toBe(0)
    const suma = r.costoMes + r.horas + r.costoAcum + r.presupuesto + r.avance
    expect(suma).toBeCloseTo(1, 6)
  })
  it('si todas están muertas devuelve todo en 0', () => {
    const vivas = { costoMes: false, horas: false, costoAcum: false, presupuesto: false, avance: false }
    const r = normalizarPesos(PESOS_SUGERENCIA_DEFAULT, vivas)
    expect(r.costoMes + r.horas + r.costoAcum + r.presupuesto + r.avance).toBe(0)
  })
})
