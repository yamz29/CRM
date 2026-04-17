import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'
import { GastoCreateSchema } from '@/lib/api-schemas'

// ── GET /api/gastos ───────────────────────────────────────────────────
export const GET = withPermiso('gastos', 'ver', async (req: NextRequest) => {
  const { searchParams } = new URL(req.url)
  const destinoTipo = searchParams.get('destinoTipo')
  const proyectoId  = searchParams.get('proyectoId')
  const estado      = searchParams.get('estado')
  const q           = searchParams.get('q')
  const desde       = searchParams.get('desde')
  const hasta       = searchParams.get('hasta')

  const gastos = await prisma.gastoProyecto.findMany({
    where: {
      ...(destinoTipo ? { destinoTipo } : {}),
      ...(proyectoId  ? { proyectoId: parseInt(proyectoId) } : {}),
      ...(estado      ? { estado } : {}),
      ...(q ? {
        OR: [
          { descripcion: { contains: q } },
          { suplidor:    { contains: q } },
          { referencia:  { contains: q } },
          { categoria:   { contains: q } },
        ],
      } : {}),
      ...(desde ? { fecha: { gte: new Date(desde) } } : {}),
      ...(hasta ? { fecha: { lte: new Date(hasta + 'T23:59:59') } } : {}),
    },
    include: {
      partida:  { select: { id: true, descripcion: true, codigo: true } },
      proyecto: { select: { id: true, nombre: true } },
    },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
  })

  const total = gastos.reduce((s, g) => s + g.monto, 0)
  const porDestino: Record<string, number> = {}
  for (const g of gastos) {
    porDestino[g.destinoTipo] = (porDestino[g.destinoTipo] ?? 0) + g.monto
  }

  return NextResponse.json({ gastos, total, porDestino })
})

// ── POST /api/gastos ──────────────────────────────────────────────────
export const POST = withPermiso('gastos', 'editar', async (req: NextRequest) => {
  const contentType = req.headers.get('content-type') ?? ''
  let bodyRaw: Record<string, unknown>
  let archivoUrl: string | null = null

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      bodyRaw = Object.fromEntries(
        [...formData.entries()].filter(([, v]) => typeof v === 'string')
      ) as Record<string, string>
      const file = formData.get('archivo') as File | null
      if (file && file.size > 0) {
        archivoUrl = await saveFile(file)
      }
    } else {
      bodyRaw = await req.json()
    }
  } catch {
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 400 })
  }

  // Validar con Zod (maneja coerción de números y enums)
  const parsed = GastoCreateSchema.safeParse(bodyRaw)
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: 'Datos inválidos',
        details: parsed.error.issues.map(i => ({
          path: i.path.join('.'),
          message: i.message,
        })),
      },
      { status: 400 },
    )
  }
  const data = parsed.data

  try {
    const gasto = await prisma.gastoProyecto.create({
      data: {
        proyectoId: data.proyectoId ?? null,
        destinoTipo: data.destinoTipo,
        fecha: data.fecha,
        tipoGasto: data.tipoGasto,
        referencia: data.referencia ?? null,
        descripcion: data.descripcion,
        suplidor: data.suplidor ?? null,
        categoria: data.categoria ?? null,
        subcategoria: data.subcategoria ?? null,
        monto: data.monto,
        moneda: data.moneda,
        metodoPago: data.metodoPago,
        cuentaOrigen: data.cuentaOrigen ?? null,
        observaciones: data.observaciones ?? null,
        estado: data.estado,
        archivoUrl,
        partidaId: data.partidaId ?? null,
        recursoId: data.recursoId ?? null,
        cantidadRecurso: data.cantidadRecurso ?? null,
        movimientoStock: data.movimientoStock ?? null,
      },
    })

    // Actualizar stock del recurso si corresponde
    if (data.recursoId && data.cantidadRecurso && data.movimientoStock) {
      const delta = data.movimientoStock === 'entrada'
        ? data.cantidadRecurso
        : -data.cantidadRecurso
      const updateData: Record<string, unknown> = { stock: { increment: delta } }
      if (data.movimientoStock === 'entrada' && data.cantidadRecurso > 0) {
        updateData.ultimoCosto = data.monto / data.cantidadRecurso
      }
      await prisma.recurso.update({ where: { id: data.recursoId }, data: updateData })
    }

    return NextResponse.json(gasto, { status: 201 })
  } catch (err) {
    console.error('[POST /api/gastos]', err)
    return NextResponse.json({ error: 'Error al guardar el gasto' }, { status: 500 })
  }
})

async function saveFile(file: File): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) throw new Error('Formato de archivo no permitido')
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera los 10 MB')
  const dir = path.join(process.cwd(), 'public', 'uploads', 'gastos', 'general')
  await mkdir(dir, { recursive: true })
  const filename = `gasto-${Date.now()}.${ext}`
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return `/uploads/gastos/general/${filename}`
}
