import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

export const GET = withPermiso('recursos', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  try {
    const recurso = await prisma.recurso.findUnique({ where: { id } })
    if (!recurso) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })
    return NextResponse.json(recurso)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al obtener recurso' }, { status: 500 })
  }
})

export const PUT = withPermiso('recursos', 'editar', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  try {
    const body = await request.json()
    const costoNuevo = parseFloat(body.costoUnitario) || 0

    // Get current price before updating
    const anterior = await prisma.recurso.findUnique({
      where: { id },
      select: { costoUnitario: true, codigo: true, nombre: true, unidad: true },
    })

    const recurso = await prisma.recurso.update({
      where: { id },
      data: {
        codigo: body.codigo || null,
        nombre: body.nombre,
        tipo: body.tipo || 'materiales',
        categoria: body.categoria || null,
        subcategoria: body.subcategoria || null,
        unidad: body.unidad || 'gl',
        costoUnitario: costoNuevo,
        proveedor: body.proveedor || null,
        marca: body.marca || null,
        activo: body.activo !== false,
        observaciones: body.observaciones || null,
        controlarStock: body.controlarStock === true || body.controlarStock === 'true',
        stock: parseFloat(body.stock) || 0,
        stockMinimo: parseFloat(body.stockMinimo) || 0,
        ultimoCosto: parseFloat(body.ultimoCosto) || 0,
      },
    })

    // Record price history only if price actually changed
    if (anterior && costoNuevo !== anterior.costoUnitario) {
      await prisma.recursoPriceHistory.create({
        data: {
          recursoId:      id,
          codigoSnapshot: anterior.codigo,
          nombreSnapshot: anterior.nombre,
          precioAnterior: anterior.costoUnitario,
          precioNuevo:    costoNuevo,
          moneda:         'DOP',
          unidadSnapshot: anterior.unidad,
          origenCambio:   'manual',
        },
      })
    }

    return NextResponse.json(recurso)
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al actualizar recurso' }, { status: 500 })
  }
})

export const DELETE = withPermiso('recursos', 'editar', async (_req: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })
  try {
    await prisma.recurso.delete({ where: { id } })
    return NextResponse.json({ success: true })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error al eliminar recurso' }, { status: 500 })
  }
})
