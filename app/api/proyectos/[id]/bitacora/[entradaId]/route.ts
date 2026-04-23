import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string; entradaId: string }> }

export const DELETE = withPermiso('proyectos', 'editar', async (_request: NextRequest, { params }: Ctx) => {
  try {
    const { entradaId: eidStr } = await params
    const entradaId = parseInt(eidStr)
    if (isNaN(entradaId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    // Get photos to delete files
    const entrada = await prisma.bitacoraEntrada.findUnique({
      where: { id: entradaId },
      include: { fotos: true },
    })
    if (!entrada) return NextResponse.json({ error: 'No encontrado' }, { status: 404 })

    // Delete photo files
    for (const foto of entrada.fotos) {
      try {
        await unlink(path.join(process.cwd(), 'public', foto.url))
      } catch { /* file may not exist */ }
    }

    await prisma.bitacoraEntrada.delete({ where: { id: entradaId } })

    return NextResponse.json({ ok: true })
  } catch (error) {
    console.error('Error eliminando entrada bitácora:', error)
    return NextResponse.json({ error: 'Error al eliminar' }, { status: 500 })
  }
})
