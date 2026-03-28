import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { runNesting, type NestPieceIn } from '@/lib/nesting'

type Params = { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params
    const projectId = parseInt(id)
    if (isNaN(projectId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const body = await request.json() as {
      clienteId?: number
      proyectoId?: number
      nombre: string
    }

    const { clienteId, proyectoId, nombre } = body

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

    // Build flat list of pieces and material lookup
    const allPieces: NestPieceIn[] = []
    const materialLookup: Record<string, { boardW: number; boardH: number; precio: number }> = {}

    for (const placement of placements) {
      const modulo = placement.modulo
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

    const nestGroups = runNesting(allPieces, materialLookup, 2440, 1830, 4, true)

    // Build presupuesto data
    const year = new Date().getFullYear()
    const existing = await prisma.presupuesto.findMany({
      where: { numero: { startsWith: `COT-${year}-` } },
      select: { numero: true },
    })
    const usedSeqs = existing
      .map((p) => parseInt(p.numero.split('-')[2] ?? '0'))
      .filter((n) => !isNaN(n))
    const maxSeq = usedSeqs.length > 0 ? Math.max(...usedSeqs) : 0
    const numero = `COT-${year}-${String(maxSeq + 1).padStart(3, '0')}`

    // Calculate subtotal from nesting groups
    let subtotalBase = 0
    const partidas: { descripcion: string; cantidad: number; precioUnitario: number; subtotal: number }[] = []

    for (const g of nestGroups) {
      const lookup = materialLookup[g.tablero]
      const precio = lookup?.precio ?? 0
      const numPlanchas = g.sheets.length
      const lineSubtotal = numPlanchas * precio
      subtotalBase += lineSubtotal
      partidas.push({
        descripcion: `Tablero ${g.tablero} - ${numPlanchas} plancha${numPlanchas !== 1 ? 's' : ''}`,
        cantidad: numPlanchas,
        precioUnitario: precio,
        subtotal: lineSubtotal,
      })
    }

    // Need a valid clienteId — if not provided, try to get any default
    let resolvedClienteId = clienteId
    if (!resolvedClienteId) {
      const firstCliente = await prisma.cliente.findFirst({ select: { id: true } })
      if (!firstCliente) {
        return NextResponse.json({ error: 'Se requiere un clienteId válido' }, { status: 400 })
      }
      resolvedClienteId = firstCliente.id
    }

    const presupuesto = await prisma.$transaction(async (tx) => {
      const created = await tx.presupuesto.create({
        data: {
          numero,
          clienteId: resolvedClienteId!,
          proyectoId: proyectoId ?? null,
          estado: 'Borrador',
          notas: nombre ? `Cocina: ${nombre}` : null,
          subtotal: subtotalBase,
          total: subtotalBase,
        },
      })

      const capitulo = await tx.capituloPresupuesto.create({
        data: {
          presupuestoId: created.id,
          nombre: 'Materiales de cocina',
          orden: 0,
        },
      })

      for (let pi = 0; pi < partidas.length; pi++) {
        const p = partidas[pi]
        await tx.partidaPresupuesto.create({
          data: {
            capituloId: capitulo.id,
            descripcion: p.descripcion,
            unidad: 'ud',
            cantidad: p.cantidad,
            precioUnitario: p.precioUnitario,
            subtotal: p.subtotal,
            orden: pi,
          },
        })
      }

      return created
    })

    return NextResponse.json({ presupuestoId: presupuesto.id, numero: presupuesto.numero }, { status: 201 })
  } catch (error) {
    console.error('Error generating presupuesto for kitchen:', error)
    return NextResponse.json({ error: 'Error al generar presupuesto' }, { status: 500 })
  }
}
