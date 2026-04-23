import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ id: string }> }

// PUT /api/quicktexts/[id] — actualizar
export const PUT = withPermiso('dashboard', 'editar', async (req: NextRequest, { params }: Ctx) => {
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
})

// DELETE /api/quicktexts/[id]
export const DELETE = withPermiso('dashboard', 'editar', async (_req: NextRequest, { params }: Ctx) => {
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
})
