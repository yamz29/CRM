import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'

type Params = { params: Promise<{ id: string }> }

// POST /api/proyectos/[id]/poblar-presupuesto
// Body: { presupuestoId: number, reemplazar?: boolean }
export async function POST(req: Request, { params }: Params) {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  let body: { presupuestoId: number; reemplazar?: boolean }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 })
  }

  const { presupuestoId, reemplazar = false } = body
  if (!presupuestoId) return NextResponse.json({ error: 'presupuestoId requerido' }, { status: 400 })

  // Verify proyecto exists
  const proyecto = await prisma.proyecto.findUnique({ where: { id: proyectoId } })
  if (!proyecto) return NextResponse.json({ error: 'Proyecto no encontrado' }, { status: 404 })

  // Load presupuesto with chapters, partidas and indirect cost lines
  const presupuesto = await prisma.presupuesto.findUnique({
    where: { id: presupuestoId },
    include: {
      capitulos: {
        orderBy: { orden: 'asc' },
        include: { partidas: { orderBy: { orden: 'asc' } } },
      },
      indirectos: { orderBy: { orden: 'asc' } },
    },
  })
  if (!presupuesto) return NextResponse.json({ error: 'Presupuesto no encontrado' }, { status: 404 })

  try {
    await prisma.$transaction(async (tx) => {
      // Map gastoId → old partida { codigo, descripcion } before clearing assignments
      let gastoMapping: { gastoId: number; codigo: string | null; descripcion: string }[] = []
      if (reemplazar) {
        const gastosConPartida = await tx.gastoProyecto.findMany({
          where: { proyectoId, partidaId: { not: null } },
          select: { id: true, partida: { select: { codigo: true, descripcion: true } } },
        })
        gastoMapping = gastosConPartida
          .filter(g => g.partida != null)
          .map(g => ({
            gastoId: g.id,
            codigo: g.partida!.codigo,
            descripcion: g.partida!.descripcion,
          }))

        // Nullify links before deleting partidas
        await tx.gastoProyecto.updateMany({
          where: { proyectoId },
          data: { partidaId: null },
        })
        await tx.proyectoPartida.deleteMany({ where: { proyectoId } })
        await tx.proyectoCapitulo.deleteMany({ where: { proyectoId } })
      }

      // Copy each capitulo and its partidas, collecting new partida records for re-matching
      const newPartidas: { id: number; codigo: string | null; descripcion: string }[] = []

      for (const cap of presupuesto.capitulos) {
        const nuevoCap = await tx.proyectoCapitulo.create({
          data: { proyectoId, nombre: cap.nombre, orden: cap.orden },
        })
        for (const part of cap.partidas) {
          const created = await tx.proyectoPartida.create({
            data: {
              proyectoId,
              capituloId: nuevoCap.id,
              capituloNombre: cap.nombre,
              presupuestoOrigenId: presupuestoId,
              codigo: part.codigo,
              descripcion: part.descripcion,
              unidad: part.unidad,
              cantidad: part.cantidad,
              precioUnitario: part.precioUnitario,
              subtotalPresupuestado: part.subtotal,
              orden: part.orden,
              observaciones: part.observaciones,
            },
          })
          newPartidas.push({ id: created.id, codigo: created.codigo, descripcion: created.descripcion })
        }
      }

      // Copy active indirect cost lines as a special chapter
      const lineasActivas = presupuesto.indirectos.filter(l => l.activo)
      if (lineasActivas.length > 0) {
        const subtotalBase = presupuesto.capitulos.reduce(
          (s, cap) => s + cap.partidas.reduce((ss, p) => ss + p.subtotal, 0), 0
        )
        const capIndirecto = await tx.proyectoCapitulo.create({
          data: {
            proyectoId,
            nombre: 'Gastos Indirectos',
            orden: presupuesto.capitulos.length,
          },
        })
        for (let i = 0; i < lineasActivas.length; i++) {
          const l = lineasActivas[i]
          await tx.proyectoPartida.create({
            data: {
              proyectoId,
              capituloId: capIndirecto.id,
              capituloNombre: 'Gastos Indirectos',
              presupuestoOrigenId: presupuestoId,
              descripcion: `${l.nombre} (${l.porcentaje}%)`,
              unidad: '%',
              cantidad: l.porcentaje,
              precioUnitario: subtotalBase / 100,
              subtotalPresupuestado: subtotalBase * l.porcentaje / 100,
              orden: i,
            },
          })
        }
      }

      // Re-assign gastos to new partidas using saved mapping
      if (reemplazar && gastoMapping.length > 0) {
        for (const { gastoId, codigo, descripcion } of gastoMapping) {
          // Try exact codigo match first, then partial descripcion match
          const match = newPartidas.find(p =>
            (codigo && p.codigo && p.codigo === codigo) ||
            p.descripcion.toLowerCase().includes(descripcion.toLowerCase()) ||
            descripcion.toLowerCase().includes(p.descripcion.toLowerCase())
          )
          if (match) {
            await tx.gastoProyecto.update({
              where: { id: gastoId },
              data: { partidaId: match.id },
            })
          }
        }
      }

      // Update proyecto with base budget reference and estimated budget
      await tx.proyecto.update({
        where: { id: proyectoId },
        data: {
          presupuestoBaseId: presupuestoId,
          presupuestoEstimado: presupuesto.total,
        },
      })

      // Link the presupuesto to this project if it isn't already linked
      if (presupuesto.proyectoId == null) {
        await tx.presupuesto.update({
          where: { id: presupuestoId },
          data: { proyectoId },
        })
      }
    })

    // Return summary
    const capitulos = await prisma.proyectoCapitulo.count({ where: { proyectoId } })
    const partidas = await prisma.proyectoPartida.count({ where: { proyectoId } })

    return NextResponse.json({
      ok: true,
      mensaje: `Se importaron ${capitulos} capítulos y ${partidas} partidas desde el presupuesto ${presupuesto.numero}`,
      capitulos,
      partidas,
    })
  } catch (err) {
    console.error('[poblar-presupuesto]', err)
    return NextResponse.json({ error: 'Error al importar el presupuesto' }, { status: 500 })
  }
}

// DELETE /api/proyectos/[id]/poblar-presupuesto — limpia toda la estructura
export async function DELETE(_req: Request, { params }: Params) {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.gastoProyecto.updateMany({
      where: { proyectoId },
      data: { partidaId: null },
    })
    await prisma.proyectoPartida.deleteMany({ where: { proyectoId } })
    await prisma.proyectoCapitulo.deleteMany({ where: { proyectoId } })
    await prisma.proyecto.update({
      where: { id: proyectoId },
      data: { presupuestoBaseId: null },
    })
    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('[delete poblar-presupuesto]', err)
    return NextResponse.json({ error: 'Error al limpiar la estructura' }, { status: 500 })
  }
}
