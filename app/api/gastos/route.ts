import { prisma } from '@/lib/prisma'
import { NextRequest, NextResponse } from 'next/server'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'

// ── GET /api/gastos ───────────────────────────────────────────────────
export async function GET(req: NextRequest) {
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
}

// ── POST /api/gastos ──────────────────────────────────────────────────
export async function POST(req: Request) {
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
        archivoUrl = await saveFile(file, null)
      }
    } else {
      body = await req.json()
    }
  } catch {
    return NextResponse.json({ error: 'Error al procesar la solicitud' }, { status: 400 })
  }

  const {
    descripcion, fecha, tipoGasto, referencia, suplidor, categoria, subcategoria,
    monto, moneda, metodoPago, cuentaOrigen, observaciones, estado,
    destinoTipo: destinoTipoRaw,
    proyectoId: proyectoIdRaw,
    partidaId: partidaIdRaw,
    recursoId: recursoIdRaw,
    cantidadRecurso: cantidadRecursoRaw,
    movimientoStock,
  } = body as Record<string, string>

  if (!descripcion || !fecha || !monto) {
    return NextResponse.json({ error: 'descripcion, fecha y monto son requeridos' }, { status: 400 })
  }

  const destinoTipo = destinoTipoRaw || 'sin_asignar'
  const proyectoId  = proyectoIdRaw ? parseInt(String(proyectoIdRaw)) || null : null
  const partidaId   = partidaIdRaw  ? parseInt(String(partidaIdRaw))  || null : null
  const recursoId   = recursoIdRaw  ? parseInt(String(recursoIdRaw))  || null : null
  const cantidadRecurso = cantidadRecursoRaw ? parseFloat(String(cantidadRecursoRaw)) || null : null
  const movimiento  = (movimientoStock === 'entrada' || movimientoStock === 'salida') ? movimientoStock : null
  const montoNum    = parseFloat(String(monto))

  try {
    const gasto = await prisma.gastoProyecto.create({
      data: {
        proyectoId,
        destinoTipo,
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
    console.error('[POST /api/gastos]', err)
    return NextResponse.json({ error: 'Error al guardar el gasto' }, { status: 500 })
  }
}

async function saveFile(file: File, _proyectoId: number | null): Promise<string> {
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
