import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runNesting, type NestPieceIn } from '@/lib/nesting'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string }> }

interface PiezaCorte {
  etiqueta: string
  nombre: string
  largo: number
  ancho: number
  cantidad: number
  modulo: string
  tapacanto: string[]
}

export const POST = withPermiso('cocinas', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const placements = await prisma.kitchenModulePlacement.findMany({
      where: { kitchenProjectId: projectId },
      include: {
        modulo: {
          include: { piezas: true, materialTablero: true },
        },
      },
    })

    if (placements.length === 0) return NextResponse.json([])

    const allPieces: NestPieceIn[] = []
    const materialLookup: Record<string, { boardW: number; boardH: number; precio: number }> = {}

    // Aggregate pieces for cut list: key = material|etiqueta|nombre|largo|ancho|modulo
    const cortesMap: Map<string, PiezaCorte> = new Map()

    for (const placement of placements) {
      const modulo = placement.modulo
      if (modulo.tipoModulo === 'Electrodoméstico') continue

      const boardW = modulo.anchoPlanchaCm
      const boardH = modulo.largoPlanchaCm
      const precio = modulo.materialTablero?.precio ?? 0
      const tableroNombre = modulo.materialTablero?.nombre ?? modulo.material

      if (!materialLookup[tableroNombre]) {
        materialLookup[tableroNombre] = { boardW, boardH, precio }
      }

      for (const pieza of modulo.piezas) {
        const matKey = pieza.material || tableroNombre
        if (!materialLookup[matKey]) {
          materialLookup[matKey] = { boardW, boardH, precio }
        }

        // Aggregate for cut list
        const corteKey = `${matKey}|${pieza.etiqueta}|${pieza.nombre}|${pieza.largo}|${pieza.ancho}|${modulo.nombre}`
        const existing = cortesMap.get(corteKey)
        if (existing) {
          existing.cantidad += pieza.cantidad
        } else {
          let tapacanto: string[] = []
          try { tapacanto = JSON.parse(pieza.tapacanto as unknown as string) } catch { tapacanto = [] }
          cortesMap.set(corteKey, {
            etiqueta: pieza.etiqueta,
            nombre: pieza.nombre,
            largo: pieza.largo,
            ancho: pieza.ancho,
            cantidad: pieza.cantidad,
            modulo: modulo.nombre,
            tapacanto,
          })
        }

        // Expand for nesting
        for (let i = 0; i < pieza.cantidad; i++) {
          allPieces.push({
            key: `p${placement.id}-${pieza.id}-${i}`,
            etiqueta: pieza.etiqueta,
            nombre: pieza.nombre,
            w: pieza.largo,
            h: pieza.ancho,
            material: matKey,
          })
        }
      }
    }

    const defaultBoardW = 2440
    const defaultBoardH = 1830
    const nestGroups = runNesting(allPieces, materialLookup, defaultBoardW, defaultBoardH, 4, true)

    // Group cortes by material
    const cortesByMaterial: Record<string, PiezaCorte[]> = {}
    for (const [key, corte] of cortesMap.entries()) {
      const matKey = key.split('|')[0]
      if (!cortesByMaterial[matKey]) cortesByMaterial[matKey] = []
      cortesByMaterial[matKey].push(corte)
    }
    for (const mat of Object.keys(cortesByMaterial)) {
      cortesByMaterial[mat].sort((a, b) =>
        a.etiqueta.localeCompare(b.etiqueta) || a.nombre.localeCompare(b.nombre)
      )
    }

    const result = nestGroups.map((g) => {
      const lookup = materialLookup[g.tablero]
      const numPlanchas = g.sheets.length
      return {
        tablero: g.tablero,
        boardW: g.boardW,
        boardH: g.boardH,
        numPlanchas,
        aprovechamiento: Math.round(g.aprovechamiento * 10) / 10,
        piezaTotal: g.totalPiezaAreaMm2,
        sheetTotal: g.totalSheetAreaMm2,
        costoEstimado: numPlanchas * (lookup?.precio ?? 0),
        piezas: cortesByMaterial[g.tablero] ?? [],
        sheets: g.sheets,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error calculating kitchen nesting:', error)
    return NextResponse.json({ error: 'Error al calcular' }, { status: 500 })
  }
})
