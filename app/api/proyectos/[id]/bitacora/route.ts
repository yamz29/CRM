import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = { params: Promise<{ id: string }> }

// ── GET /api/proyectos/[id]/bitacora ─────────────────────────────────
export const GET = withPermiso('proyectos', 'ver', async (request: NextRequest, { params }: Ctx) => {
  const { id: idStr } = await params
  const proyectoId = parseInt(idStr)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const entradas = await prisma.bitacoraEntrada.findMany({
    where: { proyectoId },
    include: {
      fotos: { orderBy: { createdAt: 'asc' } },
      usuario: { select: { id: true, nombre: true } },
    },
    orderBy: { fecha: 'desc' },
  })

  return NextResponse.json(entradas)
})

// ── POST /api/proyectos/[id]/bitacora ────────────────────────────────
export const POST = withPermiso('proyectos', 'editar', async (request: NextRequest, { params }: Ctx) => {
  try {
    const { id: idStr } = await params
    const proyectoId = parseInt(idStr)
    if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

    const formData = await request.formData()

    const fecha = formData.get('fecha') as string
    const tipo = (formData.get('tipo') as string) || 'Avance'
    const descripcion = formData.get('descripcion') as string
    const clima = formData.get('clima') as string | null
    const personalEnObra = formData.get('personalEnObra') as string | null
    const avancePct = formData.get('avancePct') as string | null
    const usuarioId = formData.get('usuarioId') as string | null

    if (!fecha || !descripcion?.trim()) {
      return NextResponse.json({ error: 'Fecha y descripción son requeridos' }, { status: 400 })
    }

    // Upload photos
    const fotos: { url: string; caption: string }[] = []
    const dir = path.join(process.cwd(), 'public', 'uploads', 'bitacora', String(proyectoId))
    let dirCreated = false

    for (const [key, value] of formData.entries()) {
      if (key.startsWith('foto_') && value instanceof File && value.size > 0) {
        if (!dirCreated) { await mkdir(dir, { recursive: true }); dirCreated = true }
        const ext = value.name.split('.').pop() || 'jpg'
        const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
        await writeFile(path.join(dir, filename), Buffer.from(await value.arrayBuffer()))
        const caption = (formData.get(key.replace('foto_', 'caption_')) as string) || ''
        fotos.push({ url: `/uploads/bitacora/${proyectoId}/${filename}`, caption })
      }
    }

    // Create entry + photos in transaction
    const entrada = await prisma.$transaction(async (tx) => {
      const entry = await tx.bitacoraEntrada.create({
        data: {
          proyectoId,
          usuarioId: usuarioId ? parseInt(usuarioId) : null,
          fecha: new Date(fecha),
          tipo,
          descripcion: descripcion.trim(),
          clima: clima || null,
          personalEnObra: personalEnObra ? parseInt(personalEnObra) : null,
          avancePct: avancePct ? parseInt(avancePct) : null,
          fotos: fotos.length > 0 ? {
            createMany: { data: fotos }
          } : undefined,
        },
        include: { fotos: true, usuario: { select: { id: true, nombre: true } } },
      })

      // Update avanceFisico on project if provided
      if (avancePct) {
        await tx.proyecto.update({
          where: { id: proyectoId },
          data: { avanceFisico: parseInt(avancePct) },
        })
      }

      return entry
    })

    return NextResponse.json(entrada, { status: 201 })
  } catch (error) {
    console.error('Error creando entrada bitácora:', error)
    return NextResponse.json({ error: 'Error al crear entrada' }, { status: 500 })
  }
})
