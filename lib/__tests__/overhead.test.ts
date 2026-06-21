import { describe, it, expect } from 'vitest'
import {
  calcularPoolReal, montoPorcentaje, totalPorcentaje, validarReparto,
  sumarOverheadDistribuido, esGastoOverhead, type GastoOverheadRow,
  normalizarPesos, PESOS_SUGERENCIA_DEFAULT, type PesosSugerencia,
  sugerirReparto, type SenalesProyecto,
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

const senal = (over: Partial<SenalesProyecto> & { proyectoId: number }): SenalesProyecto => ({
  costoMes: 0, costoAcum: 0, horas: 0, presupuesto: 0, avance: 0, diasActivos: 30, ...over,
})

describe('sugerirReparto', () => {
  it('reparte 50/50 con señales iguales y suma 100', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50 }),
      senal({ proyectoId: 2, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50 }),
    ], 30)
    expect(r.map(x => x.porcentaje)).toEqual([50, 50])
    const total = r.reduce((s, x) => s + x.porcentaje, 0)
    expect(total).toBeLessThanOrEqual(100.0001)
  })

  it('desglose de cada proyecto suma su porcentaje', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 3000, horas: 5, costoAcum: 2000, presupuesto: 1000, avance: 80 }),
      senal({ proyectoId: 2, costoMes: 1000, horas: 20, costoAcum: 5000, presupuesto: 4000, avance: 20 }),
    ], 30)
    for (const x of r) {
      const d = x.desglose
      const sumaD = d.costoMes + d.horas + d.costoAcum + d.presupuesto + d.avance
      expect(sumaD).toBeCloseTo(x.porcentaje, 4)
    }
  })

  it('redistribuye peso cuando una señal está muerta (sin horas el mes)', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 2000, costoAcum: 2000, presupuesto: 2000, avance: 50, horas: 0 }),
      senal({ proyectoId: 2, costoMes: 1000, costoAcum: 1000, presupuesto: 1000, avance: 50, horas: 0 }),
    ], 30)
    expect(r[0].porcentaje).toBeGreaterThan(r[1].porcentaje)
    expect(r[0].desglose.horas).toBe(0)
    expect(r[1].desglose.horas).toBe(0)
  })

  it('todas las señales 0 → reparto igual prorrateado por días', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, diasActivos: 30 }),
      senal({ proyectoId: 2, diasActivos: 15 }),
    ], 30)
    expect(r[0].porcentaje).toBeGreaterThan(r[1].porcentaje)
    expect(r[0].porcentaje + r[1].porcentaje).toBeCloseTo(100, 4)
  })

  it('prorratea por duración: medio mes recibe la mitad', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50, diasActivos: 30 }),
      senal({ proyectoId: 2, costoMes: 1000, horas: 10, costoAcum: 1000, presupuesto: 1000, avance: 50, diasActivos: 15 }),
    ], 30)
    expect(r[0].porcentaje).toBeCloseTo(66.67, 1)
    expect(r[1].porcentaje).toBeCloseTo(33.33, 1)
  })

  it('lista vacía → []', () => {
    expect(sugerirReparto([], 30)).toEqual([])
  })

  it('suma nunca supera 100 (redondeo)', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, costoMes: 333 }),
      senal({ proyectoId: 2, costoMes: 333 }),
      senal({ proyectoId: 3, costoMes: 334 }),
    ], 30)
    const total = r.reduce((s, x) => s + x.porcentaje, 0)
    expect(total).toBeLessThanOrEqual(100.01)
  })

  it('el desglose sigue sumando el porcentaje tras el ajuste de residuo', () => {
    const r = sugerirReparto([
      senal({ proyectoId: 1, diasActivos: 0 }),
      senal({ proyectoId: 2, diasActivos: 0 }),
      senal({ proyectoId: 3, diasActivos: 0 }),
    ], 30)
    for (const x of r) {
      const d = x.desglose
      const sumaD = Math.round((d.costoMes + d.horas + d.costoAcum + d.presupuesto + d.avance) * 100) / 100
      expect(sumaD).toBe(x.porcentaje)
    }
  })
})
