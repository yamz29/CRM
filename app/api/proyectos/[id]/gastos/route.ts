import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'
import { validarProyectoNoCerrado } from '@/lib/proyecto-cerrado'

type Params = { params: Promise<{ id: string }> }

// ── GET /api/proyectos/[id]/gastos ────────────────────────────────────
export const GET = withPermiso('gastos', 'ver', async (_req: NextRequest, { params }: Params) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const gastos = await prisma.gastoProyecto.findMany({
    where: { proyectoId },
    orderBy: [{ fecha: 'desc' }, { createdAt: 'desc' }],
    include: { partida: { select: { id: true, descripcion: true, codigo: true } } },
  })

  const total = gastos.reduce((s, g) => s + g.monto, 0)
  return NextResponse.json({ gastos, total })
})

// ── POST /api/proyectos/[id]/gastos ───────────────────────────────────
export const POST = withPermiso('gastos', 'editar', async (req: NextRequest, { params }: Params) => {
  const { id } = await params
  const proyectoId = parseInt(id)
  if (isNaN(proyectoId)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  const cerrado = await validarProyectoNoCerrado(proyectoId)
  if (cerrado) return cerrado

  const contentType = req.headers.get('content-type') ?? ''
  let body: Record<string, unknown>
  let archivoUrl: string | undefined

  try {
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      body = Object.fromEntries(
        [...formData.entries()].filter(([, v]) => typeof v === 'string')
      ) as Record<string, string>

      const file = formData.get('archivo') as File | null
      if (file && file.size > 0) {
        try {
          archivoUrl = await saveFile(file, proyectoId)
        } catch (fileErr) {
          return NextResponse.json(
            { error: fileErr instanceof Error ? fileErr.message : 'Error al subir archivo' },
            { status: 400 }
          )
        }
      }
    } else {
      body = await req.json()
    }
  } catch {
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 400 })
  }

  const { descripcion, fecha, tipoGasto, referencia, suplidor, categoria, subcategoria,
    monto, moneda, metodoPago, cuentaOrigen, observaciones, estado,
    partidaId: partidaIdRaw, recursoId: recursoIdRaw,
    cantidadRecurso: cantidadRecursoRaw, movimientoStock } = body as Record<string, string>

  if (!descripcion || !fecha || !monto) {
    return NextResponse.json({ error: 'descripcion, fecha y monto son requeridos' }, { status: 400 })
  }

  const partidaId = partidaIdRaw ? parseInt(String(partidaIdRaw)) || null : null
  const recursoId = recursoIdRaw ? parseInt(String(recursoIdRaw)) || null : null
  const cantidadRecurso = cantidadRecursoRaw ? parseFloat(String(cantidadRecursoRaw)) || null : null
  const movimiento = (movimientoStock === 'entrada' || movimientoStock === 'salida') ? movimientoStock : null
  const montoNum = parseFloat(String(monto))

  try {
    const gasto = await prisma.gastoProyecto.create({
      data: {
        proyectoId,
        destinoTipo: 'proyecto',
        fecha: new Date(fecha),
        tipoGasto: tipoGasto || 'Gasto menor',
        referencia: referencia || null,
        descripcion,
        suplidor: suplidor || null,
        categoria: categoria || null,
        subcategoria: subcategoria || null,
        monto: montoNum,
        moneda: moneda || 'RD$',
        metodoPago: metodoPago || 'Efectivo',
        cuentaOrigen: cuentaOrigen || null,
        observaciones: observaciones || null,
        estado: estado || 'Registrado',
        archivoUrl: archivoUrl ?? null,
        partidaId,
        recursoId,
        cantidadRecurso,
        movimientoStock: movimiento,
      },
    })

    // Actualizar stock del recurso si aplica
    if (recursoId && cantidadRecurso && movimiento) {
      const delta = movimiento === 'entrada' ? cantidadRecurso : -cantidadRecurso
      const updateData: Record<string, unknown> = { stock: { increment: delta } }
      if (movimiento === 'entrada' && cantidadRecurso > 0) {
        updateData.ultimoCosto = montoNum / cantidadRecurso
      }
      await prisma.recurso.update({ where: { id: recursoId }, data: updateData })
    }

    return NextResponse.json(gasto, { status: 201 })
  } catch (err) {
    console.error('[POST /gastos]', err)
    return NextResponse.json({ error: 'Error al guardar el gasto' }, { status: 500 })
  }
})

// ── Helpers ───────────────────────────────────────────────────────────
async function saveFile(file: File, proyectoId: number): Promise<string> {
  const ext = file.name.split('.').pop()?.toLowerCase() ?? 'bin'
  const allowed = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'gif']
  if (!allowed.includes(ext)) throw new Error('Formato de archivo no permitido')
  if (file.size > 10 * 1024 * 1024) throw new Error('El archivo supera los 10 MB')

  const dir = path.join(process.cwd(), 'public', 'uploads', 'gastos', String(proyectoId))
  await mkdir(dir, { recursive: true })
  const filename = `gasto-${Date.now()}.${ext}`
  await writeFile(path.join(dir, filename), Buffer.from(await file.arrayBuffer()))
  return `/uploads/gastos/${proyectoId}/${filename}`
}
