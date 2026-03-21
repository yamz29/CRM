import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'

type Params = { params: Promise<{ id: string; gastoId: string }> }

// ── PUT /api/proyectos/[id]/gastos/[gastoId] ──────────────────────────
export async function PUT(req: Request, { params }: Params) {
  const { gastoId } = await params
  const id = parseInt(gastoId)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const contentType = req.headers.get('content-type') ?? ''
  let body: Record<string, string>
  let archivoUrl: string | undefined

  if (contentType.includes('multipart/form-data')) {
    const formData = await req.formData()
    body = Object.fromEntries(
      [...formData.entries()].filter(([, v]) => typeof v === 'string')
    ) as Record<string, string>

    const file = formData.get('archivo') as File | null
    if (file && file.size > 0) {
      const existing = await prisma.gastoProyecto.findUnique({ where: { id }, select: { archivoUrl: true, proyectoId: true } })
      if (existing?.archivoUrl) {
        try {
          await unlink(path.join(process.cwd(), 'public', existing.archivoUrl))
        } catch { /* file may not exist */ }
      }
      const proyectoId = existing?.proyectoId ?? 0
      archivoUrl = await saveFile(file, proyectoId)
    }
  } else {
    body = await req.json()
  }

  const { descripcion, fecha, tipoGasto, referencia, suplidor, categoria, subcategoria,
    monto, moneda, metodoPago, cuentaOrigen, observaciones, estado, partidaId: partidaIdRaw } = body

  const partidaId = partidaIdRaw !== undefined
    ? (partidaIdRaw === '' || partidaIdRaw === 'null' ? null : parseInt(String(partidaIdRaw)) || null)
    : undefined

  try {
    const gasto = await prisma.gastoProyecto.update({
      where: { id },
      data: {
        ...(fecha && { fecha: new Date(fecha) }),
        ...(tipoGasto && { tipoGasto }),
        ...(referencia !== undefined && { referencia: referencia || null }),
        ...(descripcion && { descripcion }),
        ...(suplidor !== undefined && { suplidor: suplidor || null }),
        ...(categoria !== undefined && { categoria: categoria || null }),
        ...(subcategoria !== undefined && { subcategoria: subcategoria || null }),
        ...(monto && { monto: parseFloat(monto) }),
        ...(moneda && { moneda }),
        ...(metodoPago && { metodoPago }),
        ...(cuentaOrigen !== undefined && { cuentaOrigen: cuentaOrigen || null }),
        ...(observaciones !== undefined && { observaciones: observaciones || null }),
        ...(estado && { estado }),
        ...(archivoUrl !== undefined && { archivoUrl }),
        ...(partidaId !== undefined && { partidaId }),
      },
    })
    return NextResponse.json(gasto)
  } catch {
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
}

// ── DELETE /api/proyectos/[id]/gastos/[gastoId] ───────────────────────
export async function DELETE(_req: Request, { params }: Params) {
  const { gastoId } = await params
  const id = parseInt(gastoId)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const gasto = await prisma.gastoProyecto.findUnique({ where: { id }, select: { archivoUrl: true } })
  if (gasto?.archivoUrl) {
    try {
      await unlink(path.join(process.cwd(), 'public', gasto.archivoUrl))
    } catch { /* file may not exist */ }
  }

  await prisma.gastoProyecto.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}

// ── Helper ────────────────────────────────────────────────────────────
async function saveFile(file: File, proyectoId: number): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) throw new Error('Formato no permitido')
  const dir = path.join(process.cwd(), 'public', 'uploads', 'gastos', String(proyectoId))
  await mkdir(dir, { recursive: true })
  const filename = `gasto-${Date.now()}.${ext}`
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return `/uploads/gastos/${proyectoId}/${filename}`
}
