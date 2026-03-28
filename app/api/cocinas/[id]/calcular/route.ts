import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runNesting, type NestPieceIn } from '@/lib/nesting'

type Params = { params: Promise<{ id: string }> }

export async function POST(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Fetch all placements with modules and pieces
    const placements = await prisma.kitchenModulePlacement.findMany({
      where: { kitchenProjectId: projectId },
      include: {
        modulo: {
          include: {
            piezas: true,
            materialTablero: true,
          },
        },
      },
    })

    if (placements.length === 0) {
      return NextResponse.json([])
    }

    // Build flat list of NestPieceIn, expanding by piece quantity
    const allPieces: NestPieceIn[] = []

    // Build material lookup from modules
    const materialLookup: Record<string, { boardW: number; boardH: number; precio: number }> = {}

    for (const placement of placements) {
      const modulo = placement.modulo
      // Skip appliances — they have no material pieces
      if (modulo.tipoModulo === 'Electrodoméstico') continue
      const boardW = modulo.anchoPlanchaCm  // stored as mm despite field name
      const boardH = modulo.largoPlanchaCm  // stored as mm despite field name
      const precio = modulo.materialTablero?.precio ?? 0
      const tableroNombre = modulo.materialTablero?.nombre ?? modulo.material

      if (!materialLookup[tableroNombre]) {
        materialLookup[tableroNombre] = { boardW, boardH, precio }
      }

      for (const pieza of modulo.piezas) {
        const matKey = pieza.material || tableroNombre
        // Ensure lookup for piece material
        if (!materialLookup[matKey]) {
          materialLookup[matKey] = { boardW, boardH, precio }
        }

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

    const result = nestGroups.map((g) => {
      const lookup = materialLookup[g.tablero]
      const precio = lookup?.precio ?? 0
      const numPlanchas = g.sheets.length
      const costoEstimado = numPlanchas * precio

      return {
        tablero: g.tablero,
        boardW: g.boardW,
        boardH: g.boardH,
        numPlanchas,
        aprovechamiento: Math.round(g.aprovechamiento * 10) / 10,
        piezaTotal: g.totalPiezaAreaMm2,
        sheetTotal: g.totalSheetAreaMm2,
        costoEstimado,
      }
    })

    return NextResponse.json(result)
  } catch (error) {
    console.error('Error calculating kitchen nesting:', error)
    return NextResponse.json({ error: 'Error al calcular' }, { status: 500 })
  }
}
