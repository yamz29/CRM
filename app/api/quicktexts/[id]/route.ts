import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

type Params = { params: Promise<{ id: string }> }

// PUT /api/quicktexts/[id] — actualizar
export async function PUT(req: NextRequest, { params }: Params) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const { nombre, categoria, contenido, orden } = await req.json()
    const data: Record<string, unknown> = {}
    if (nombre !== undefined) data.nombre = String(nombre).trim()
    if (categoria !== undefined) data.categoria = categoria?.trim() || null
    if (contenido !== undefined) data.contenido = String(contenido).trim()
    if (typeof orden === 'number') data.orden = orden

    const item = await prisma.presupuestoQuickText.update({ where: { id }, data })
    return NextResponse.json(item)
  } catch (e) {
    console.error('Error updating quicktext:', e)
    return NextResponse.json({ error: 'Error al actualizar plantilla' }, { status: 500 })
  }
}

// DELETE /api/quicktexts/[id]
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    await prisma.presupuestoQuickText.delete({ where: { id } })
    return NextResponse.json({ ok: true })
  } catch (e) {
    console.error('Error deleting quicktext:', e)
    return NextResponse.json({ error: 'Error al eliminar plantilla' }, { status: 500 })
  }
}
