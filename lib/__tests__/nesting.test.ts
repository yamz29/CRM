import { describe, it, expect } from 'vitest'
import { runNesting, NEST_COLORS, type NestPieceIn } from '../nesting'

// Helpers
const pieza = (overrides: Partial<NestPieceIn> & Pick<NestPieceIn, 'key' | 'w' | 'h'>): NestPieceIn => ({
  etiqueta: overrides.key,
  nombre: overrides.key,
  ...overrides,
})

const MATERIAL_DEFAULT = 'MDF'
const LOOKUP = {
  MDF: { boardW: 2440, boardH: 1220, precio: 100 },
}

describe('runNesting', () => {
  it('agrupa piezas por material en grupos separados', () => {
    const piezas: NestPieceIn[] = [
      pieza({ key: 'a', w: 500, h: 400, material: 'MDF' }),
      pieza({ key: 'b', w: 500, h: 400, material: 'Melamina Blanca' }),
      pieza({ key: 'c', w: 500, h: 400, material: 'MDF' }),
    ]
    const result = runNesting(piezas, LOOKUP, 2440, 1220)
    expect(result).toHaveLength(2)
    const mdf = result.find(g => g.tablero === 'MDF')!
    const mel = result.find(g => g.tablero === 'Melamina Blanca')!
    expect(mdf.sheets[0].piezas).toHaveLength(2)
    expect(mel.sheets[0].piezas).toHaveLength(1)
  })

  it('usa "Sin tablero" cuando la pieza no tiene material', () => {
    const piezas: NestPieceIn[] = [pieza({ key: 'a', w: 500, h: 400 })]
    const result = runNesting(piezas, LOOKUP, 2440, 1220)
    expect(result[0].tablero).toBe('Sin tablero')
  })

  it('usa dimensiones por defecto cuando el material no está en lookup', () => {
    const piezas: NestPieceIn[] = [pieza({ key: 'a', w: 500, h: 400, material: 'Desconocido' })]
    const result = runNesting(piezas, LOOKUP, 3000, 1500)
    expect(result[0].boardW).toBe(3000)
    expect(result[0].boardH).toBe(1500)
  })

  it('rota piezas con h > w cuando allowRotation=true', () => {
    const piezas: NestPieceIn[] = [pieza({ key: 'alto', w: 400, h: 1000, material: MATERIAL_DEFAULT })]
    const result = runNesting(piezas, LOOKUP, 2440, 1220, 4, true)
    const placed = result[0].sheets[0].piezas[0]
    expect(placed.rotada).toBe(true)
    expect(placed.w).toBe(1000) // rotó: w y h intercambiados
    expect(placed.h).toBe(400)
  })

  it('no rota piezas cuando allowRotation=false', () => {
    const piezas: NestPieceIn[] = [pieza({ key: 'alto', w: 400, h: 1000, material: MATERIAL_DEFAULT })]
    const result = runNesting(piezas, LOOKUP, 2440, 1220, 4, false)
    const placed = result[0].sheets[0].piezas[0]
    expect(placed.rotada).toBe(false)
    expect(placed.w).toBe(400)
    expect(placed.h).toBe(1000)
  })

  it('descarta piezas más grandes que el tablero (en ambas orientaciones)', () => {
    const piezas: NestPieceIn[] = [
      pieza({ key: 'enorme', w: 3000, h: 3000, material: MATERIAL_DEFAULT }),
      pieza({ key: 'ok', w: 500, h: 400, material: MATERIAL_DEFAULT }),
    ]
    const result = runNesting(piezas, LOOKUP, 2440, 1220)
    expect(result[0].sheets[0].piezas.map(p => p.key)).toEqual(['ok'])
  })

  it('rota una pieza demasiado grande en orientación normal pero que cabe girada', () => {
    // Pieza 1300×2000: w=1300 > boardH=1220; pero rotada 2000×1300 cabe en 2440×1220 (al rotar se vuelve 2000×1300; sigue sin caber en 2440×1220 por h=1300). Caso distinto: 1000×2000 → rotada 2000×1000 cabe.
    const piezas: NestPieceIn[] = [pieza({ key: 'larga', w: 1000, h: 2000, material: MATERIAL_DEFAULT })]
    const result = runNesting(piezas, LOOKUP, 2440, 1220)
    const placed = result[0].sheets[0].piezas[0]
    expect(placed.rotada).toBe(true)
    expect(placed.w).toBe(2000)
    expect(placed.h).toBe(1000)
  })

  it('asigna colores cíclicamente desde NEST_COLORS', () => {
    const piezas: NestPieceIn[] = Array.from({ length: NEST_COLORS.length + 2 }).map((_, i) =>
      pieza({ key: `p${i}`, w: 100, h: 100, material: MATERIAL_DEFAULT })
    )
    const result = runNesting(piezas, LOOKUP, 2440, 1220)
    const placed = result[0].sheets.flatMap(s => s.piezas)
    expect(placed[0].colorIdx).toBe(0)
    expect(placed[NEST_COLORS.length].colorIdx).toBe(0) // vuelve al 0
    expect(placed[NEST_COLORS.length + 1].colorIdx).toBe(1)
  })

  it('respeta el kerf (separación entre piezas)', () => {
    const piezas: NestPieceIn[] = [
      pieza({ key: 'a', w: 1000, h: 100, material: MATERIAL_DEFAULT }),
      pieza({ key: 'b', w: 1000, h: 100, material: MATERIAL_DEFAULT }),
    ]
    const result = runNesting(piezas, LOOKUP, 2440, 1220, 10)
    const placed = result[0].sheets[0].piezas
    // Ambas caben en el mismo shelf. Segunda en x = 1000 + kerf(10).
    expect(placed[0].x).toBe(0)
    expect(placed[1].x).toBe(1010)
  })

  it('crea un nuevo shelf cuando la pieza siguiente no cabe horizontalmente', () => {
    // Pieza de 2000×100 + otra de 500×100 en tablero 2440×1220: caben en el mismo shelf (2000+4+500 = 2504 > 2440 → nuevo shelf). Verifica que la segunda pieza quede en shelf distinto.
    const piezas: NestPieceIn[] = [
      pieza({ key: 'larga', w: 2000, h: 100, material: MATERIAL_DEFAULT }),
      pieza({ key: 'corta', w: 500, h: 100, material: MATERIAL_DEFAULT }),
    ]
    const result = runNesting(piezas, LOOKUP, 2440, 1220, 4)
    const placed = result[0].sheets[0].piezas
    expect(placed[0].y).toBe(0)
    expect(placed[1].y).toBeGreaterThan(0) // segundo shelf → y > 0
  })

  it('crea un nuevo sheet cuando la pieza no cabe verticalmente', () => {
    // 3 piezas de 2440×500: cada una ocupa un shelf, solo 2 caben por sheet en 1220 (500+4+500+4+500 = 1508 > 1220 → tercera va a sheet nuevo)
    const piezas: NestPieceIn[] = [
      pieza({ key: 'a', w: 2440, h: 500, material: MATERIAL_DEFAULT }),
      pieza({ key: 'b', w: 2440, h: 500, material: MATERIAL_DEFAULT }),
      pieza({ key: 'c', w: 2440, h: 500, material: MATERIAL_DEFAULT }),
    ]
    const result = runNesting(piezas, LOOKUP, 2440, 1220, 4)
    expect(result[0].sheets.length).toBe(2)
    expect(result[0].sheets[0].piezas).toHaveLength(2)
    expect(result[0].sheets[1].piezas).toHaveLength(1)
  })

  it('calcula aprovechamiento correctamente', () => {
    // Una pieza 1000×1000 en tablero 2440×1220
    // piezaArea = 1_000_000, sheetArea = 2440 * 1220 = 2_976_800
    // aprovechamiento = 1_000_000 / 2_976_800 * 100 ≈ 33.59
    const piezas: NestPieceIn[] = [pieza({ key: 'a', w: 1000, h: 1000, material: MATERIAL_DEFAULT })]
    const result = runNesting(piezas, LOOKUP, 2440, 1220)
    expect(result[0].aprovechamiento).toBeCloseTo(33.59, 1)
    expect(result[0].totalPiezaAreaMm2).toBe(1_000_000)
    expect(result[0].totalSheetAreaMm2).toBe(2_976_800)
  })

  it('aprovechamiento = 0 cuando no hay sheets (todas las piezas descartadas)', () => {
    const piezas: NestPieceIn[] = [pieza({ key: 'enorme', w: 5000, h: 5000, material: MATERIAL_DEFAULT })]
    const result = runNesting(piezas, LOOKUP, 2440, 1220, 4, false)
    expect(result[0].aprovechamiento).toBe(0)
    expect(result[0].sheets).toHaveLength(0)
  })

  it('ordena piezas por altura descendente antes de empaquetar', () => {
    // Si no ordenara, la primera pieza iría primero. Como ordena por h desc, la alta va primero.
    const piezas: NestPieceIn[] = [
      pieza({ key: 'baja', w: 100, h: 50, material: MATERIAL_DEFAULT }),
      pieza({ key: 'alta', w: 100, h: 500, material: MATERIAL_DEFAULT }),
    ]
    const result = runNesting(piezas, LOOKUP, 2440, 1220)
    expect(result[0].sheets[0].piezas[0].key).toBe('alta')
  })

  it('lista vacía de piezas → array vacío de grupos', () => {
    const result = runNesting([], LOOKUP, 2440, 1220)
    expect(result).toHaveLength(0)
  })
})
