import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { DEFAULT_QC_PROCESO, DEFAULT_QC_FINAL } from '@/lib/produccion'

export async function GET() {
  const ordenes = await prisma.ordenProduccion.findMany({
    include: {
      proyecto: { select: { id: true, nombre: true } },
      items: {
        select: { id: true, nombreModulo: true, cantidad: true },
      },
      _count: { select: { items: true, materiales: true } },
    },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(ordenes)
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { modo } = body // 'importar-espacio' | 'manual'

    // Generate sequential code
    const year = new Date().getFullYear()
    const lastOrder = await prisma.ordenProduccion.findFirst({
      where: { codigo: { startsWith: `OP-${year}-` } },
      orderBy: { codigo: 'desc' },
    })
    const seq = lastOrder ? parseInt(lastOrder.codigo.split('-')[2]) + 1 : 1
    const codigo = `OP-${year}-${String(seq).padStart(4, '0')}`

    if (modo === 'importar-espacio') {
      const { espacioId, moduloIds, nombre, proyectoId, prioridad } = body

      const result = await prisma.$transaction(async (tx) => {
        const espacio = await tx.kitchenProject.findUnique({
          where: { id: parseInt(espacioId) },
          select: { nombre: true },
        })

        // Fetch selected modules with all material data
        const modulos = await tx.moduloMelaminaV2.findMany({
          where: { id: { in: moduloIds.map((id: number) => id) } },
          include: {
            materialesModulo: { include: { material: true } },
            materialTablero: true,
            piezas: true,
          },
        })

        if (modulos.length === 0) {
          throw new Error('No se encontraron módulos seleccionados')
        }

        const orden = await tx.ordenProduccion.create({
          data: {
            codigo,
            nombre: nombre || `Producción - ${espacio?.nombre || 'Espacio'}`,
            proyectoId: proyectoId ? parseInt(proyectoId) : null,
            espacioOrigenId: parseInt(espacioId),
            prioridad: prioridad || 'Media',
            etapaActual: 'Compra de Materiales',
            estado: 'Pendiente',
            checklistQCProceso: JSON.stringify(DEFAULT_QC_PROCESO),
            checklistQCFinal: JSON.stringify(DEFAULT_QC_FINAL),
          },
        })

        // Create items from modules
        const items = await Promise.all(
          modulos.map((mod) =>
            tx.itemProduccion.create({
              data: {
                ordenId: orden.id,
                moduloId: mod.id,
                nombreModulo: mod.nombre,
                tipoModulo: mod.tipoModulo,
                dimensiones: `${mod.ancho}×${mod.alto}×${mod.profundidad} mm`,
                cantidad: mod.cantidad,
              },
            })
          )
        )

        // Aggregate materials
        const materialMap = new Map<
          number,
          {
            materialId: number
            nombre: string
            tipo: string
            unidad: string
            cantidadTotal: number
            costoUnitario: number
            proveedor: string | null
          }
        >()

        for (const mod of modulos) {
          // Tablero material
          if (mod.materialTablero) {
            const key = mod.materialTablero.id
            const existing = materialMap.get(key)
            if (existing) {
              existing.cantidadTotal += mod.cantidad
            } else {
              materialMap.set(key, {
                materialId: key,
                nombre: mod.materialTablero.nombre,
                tipo: mod.materialTablero.tipo,
                unidad: mod.materialTablero.unidad,
                cantidadTotal: mod.cantidad,
                costoUnitario: mod.materialTablero.precio,
                proveedor: mod.materialTablero.proveedor || null,
              })
            }
          }

          // Herrajes / cantos from materialesModulo
          for (const mm of mod.materialesModulo) {
            const key = mm.materialId
            const existing = materialMap.get(key)
            const qty = mm.cantidad * mod.cantidad
            if (existing) {
              existing.cantidadTotal += qty
            } else {
              materialMap.set(key, {
                materialId: key,
                nombre: mm.material.nombre,
                tipo: mm.material.tipo,
                unidad: mm.unidad || mm.material.unidad,
                cantidadTotal: qty,
                costoUnitario: mm.material.precio,
                proveedor: mm.material.proveedor || null,
              })
            }
          }
        }

        // Create purchase list
        if (materialMap.size > 0) {
          await tx.materialOrdenProduccion.createMany({
            data: Array.from(materialMap.values()).map((m) => ({
              ordenId: orden.id,
              materialId: m.materialId,
              nombre: m.nombre,
              tipo: m.tipo,
              unidad: m.unidad,
              cantidadRequerida: m.cantidadTotal,
              costoUnitario: m.costoUnitario,
              costoTotal: m.cantidadTotal * m.costoUnitario,
              proveedor: m.proveedor,
            })),
          })
        }

        return { ...orden, itemCount: items.length, materialCount: materialMap.size }
      })

      return NextResponse.json(result, { status: 201 })
    }

    // Manual mode
    const { nombre, proyectoId, prioridad, items: itemsData } = body

    const orden = await prisma.$transaction(async (tx) => {
      const created = await tx.ordenProduccion.create({
        data: {
          codigo,
          nombre: nombre || `Orden ${codigo}`,
          proyectoId: proyectoId ? parseInt(proyectoId) : null,
          prioridad: prioridad || 'Media',
          etapaActual: 'Compra de Materiales',
          estado: 'Pendiente',
          checklistQCProceso: JSON.stringify(DEFAULT_QC_PROCESO),
          checklistQCFinal: JSON.stringify(DEFAULT_QC_FINAL),
        },
      })

      if (itemsData && itemsData.length > 0) {
        await tx.itemProduccion.createMany({
          data: itemsData.map((item: { nombre: string; tipo?: string; dimensiones?: string; cantidad?: number }) => ({
            ordenId: created.id,
            nombreModulo: item.nombre,
            tipoModulo: item.tipo || null,
            dimensiones: item.dimensiones || null,
            cantidad: item.cantidad || 1,
          })),
        })
      }

      return created
    })

    return NextResponse.json(orden, { status: 201 })
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Error al crear orden'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
