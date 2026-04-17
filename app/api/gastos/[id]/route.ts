import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'

type Params = { params: Promise<{ id: string }> }

// ── PUT /api/gastos/[id] ──────────────────────────────────────────────
export const PUT = withPermiso('gastos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
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
      const existing = await prisma.gastoProyecto.findUnique({ where: { id }, select: { archivoUrl: true } })
      if (existing?.archivoUrl) {
        try { await unlink(path.join(process.cwd(), 'public', existing.archivoUrl)) } catch { /* ok */ }
      }
      archivoUrl = await saveFile(file)
    }
  } else {
    body = await req.json()
  }

  const {
    descripcion, fecha, tipoGasto, referencia, suplidor, categoria, subcategoria,
    monto, moneda, metodoPago, cuentaOrigen, observaciones, estado,
    destinoTipo,
    proyectoId: proyectoIdRaw,
    partidaId: partidaIdRaw,
    recursoId: recursoIdRaw,
    cantidadRecurso: cantidadRecursoRaw,
    movimientoStock,
  } = body

  const proyectoId = proyectoIdRaw !== undefined
    ? (proyectoIdRaw === '' || proyectoIdRaw === 'null' ? null : parseInt(String(proyectoIdRaw)) || null)
    : undefined

  const partidaId = partidaIdRaw !== undefined
    ? (partidaIdRaw === '' || partidaIdRaw === 'null' ? null : parseInt(String(partidaIdRaw)) || null)
    : undefined

  const recursoId = recursoIdRaw !== undefined
    ? (recursoIdRaw === '' || recursoIdRaw === 'null' ? null : parseInt(String(recursoIdRaw)) || null)
    : undefined

  const cantidadRecurso = cantidadRecursoRaw !== undefined
    ? (cantidadRecursoRaw === '' ? null : parseFloat(String(cantidadRecursoRaw)) || null)
    : undefined

  const movimiento = movimientoStock !== undefined
    ? ((movimientoStock === 'entrada' || movimientoStock === 'salida') ? movimientoStock : null)
    : undefined

  try {
    const anterior = await prisma.gastoProyecto.findUnique({
      where: { id },
      select: { recursoId: true, cantidadRecurso: true, movimientoStock: true, monto: true },
    })

    const gasto = await prisma.gastoProyecto.update({
      where: { id },
      data: {
        ...(destinoTipo  !== undefined && { destinoTipo }),
        ...(proyectoId   !== undefined && { proyectoId }),
        ...(fecha        && { fecha: new Date(fecha) }),
        ...(tipoGasto    && { tipoGasto }),
        ...(referencia   !== undefined && { referencia: referencia || null }),
        ...(descripcion  && { descripcion }),
        ...(suplidor     !== undefined && { suplidor: suplidor || null }),
        ...(categoria    !== undefined && { categoria: categoria || null }),
        ...(subcategoria !== undefined && { subcategoria: subcategoria || null }),
        ...(monto        && { monto: parseFloat(monto) }),
        ...(moneda       && { moneda }),
        ...(metodoPago   && { metodoPago }),
        ...(cuentaOrigen !== undefined && { cuentaOrigen: cuentaOrigen || null }),
        ...(observaciones !== undefined && { observaciones: observaciones || null }),
        ...(estado       && { estado }),
        ...(archivoUrl   !== undefined && { archivoUrl }),
        ...(partidaId    !== undefined && { partidaId }),
        ...(recursoId    !== undefined && { recursoId }),
        ...(cantidadRecurso !== undefined && { cantidadRecurso }),
        ...(movimiento   !== undefined && { movimientoStock: movimiento }),
      },
    })

    // Revert old stock
    if (anterior?.recursoId && anterior.cantidadRecurso && anterior.movimientoStock) {
      const reverseDelta = anterior.movimientoStock === 'entrada' ? -anterior.cantidadRecurso : anterior.cantidadRecurso
      await prisma.recurso.update({ where: { id: anterior.recursoId }, data: { stock: { increment: reverseDelta } } })
    }

    // Apply new stock
    const newRecursoId  = recursoId  !== undefined ? recursoId  : anterior?.recursoId
    const newCantidad   = cantidadRecurso !== undefined ? cantidadRecurso : anterior?.cantidadRecurso
    const newMovimiento = movimiento !== undefined ? movimiento : anterior?.movimientoStock
    const newMonto      = monto ? parseFloat(monto) : (anterior?.monto ?? 0)

    if (newRecursoId && newCantidad && newMovimiento) {
      const delta = newMovimiento === 'entrada' ? newCantidad : -newCantidad
      const updateData: Record<string, unknown> = { stock: { increment: delta } }
      if (newMovimiento === 'entrada' && newCantidad > 0) {
        updateData.ultimoCosto = newMonto / newCantidad
      }
      await prisma.recurso.update({ where: { id: newRecursoId }, data: updateData })
    }

    return NextResponse.json(gasto)
  } catch (err) {
    console.error('[PUT /api/gastos/[id]]', err)
    return NextResponse.json({ error: 'Error al actualizar' }, { status: 500 })
  }
})

// ── DELETE /api/gastos/[id] ───────────────────────────────────────────
export const DELETE = withPermiso('gastos', 'editar', async (_req: NextRequest, { params }: Params) => {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const gasto = await prisma.gastoProyecto.findUnique({
    where: { id },
    select: { archivoUrl: true, recursoId: true, cantidadRecurso: true, movimientoStock: true },
  })

  if (gasto?.archivoUrl) {
    try { await unlink(path.join(process.cwd(), 'public', gasto.archivoUrl)) } catch { /* ok */ }
  }

  await prisma.gastoProyecto.delete({ where: { id } })

  if (gasto?.recursoId && gasto.cantidadRecurso && gasto.movimientoStock) {
    const reverseDelta = gasto.movimientoStock === 'entrada' ? -gasto.cantidadRecurso : gasto.cantidadRecurso
    try {
      await prisma.recurso.update({ where: { id: gasto.recursoId }, data: { stock: { increment: reverseDelta } } })
    } catch { /* recurso puede haber sido eliminado */ }
  }

  return NextResponse.json({ ok: true })
})

async function saveFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) throw new Error('Formato no permitido')
  const dir = path.join(process.cwd(), 'public', 'uploads', 'gastos', 'general')
  await mkdir(dir, { recursive: true })
  const filename = `gasto-${Date.now()}.${ext}`
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return `/uploads/gastos/general/${filename}`
}
