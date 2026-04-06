import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { uploadToDrive } from '@/lib/google-drive'
import { checkPermiso } from '@/lib/permisos'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'facturas')
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

async function saveFileBuffer(buffer: Buffer, originalName: string): Promise<string> {
  const ext = originalName.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXT.includes(ext)) throw new Error('Formato no permitido')

  await mkdir(UPLOAD_DIR, { recursive: true })
  const filename = `factura-${Date.now()}.${ext}`
  await writeFile(path.join(UPLOAD_DIR, filename), buffer)
  return `/uploads/facturas/${filename}`
}

export async function GET(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'ver')
  if (denied) return denied

  const sp = request.nextUrl.searchParams
  const tipo = sp.get('tipo')
  const estado = sp.get('estado')
  const q = sp.get('q')
  const desde = sp.get('desde')
  const hasta = sp.get('hasta')
  const clienteId = sp.get('clienteId')

  const conciliables = sp.get('conciliables')

  const where: any = {}
  if (tipo) where.tipo = tipo
  if (conciliables) {
    where.estado = { in: ['pendiente', 'parcial'] }
  } else if (estado) {
    where.estado = estado
  }
  if (clienteId) where.clienteId = parseInt(clienteId)
  if (desde || hasta) {
    where.fecha = {}
    if (desde) where.fecha.gte = new Date(desde)
    if (hasta) where.fecha.lte = new Date(hasta + 'T23:59:59')
  }
  if (q) {
    where.OR = [
      { numero: { contains: q, mode: 'insensitive' } },
      { ncf: { contains: q, mode: 'insensitive' } },
      { proveedor: { contains: q, mode: 'insensitive' } },
      { descripcion: { contains: q, mode: 'insensitive' } },
      { cliente: { nombre: { contains: q, mode: 'insensitive' } } },
      { rncProveedor: { contains: q, mode: 'insensitive' } },
    ]
  }

  try {
    const [facturas, totales] = await Promise.all([
      prisma.factura.findMany({
        where,
        include: {
          cliente: { select: { id: true, nombre: true } },
          proyecto: { select: { id: true, nombre: true } },
          _count: { select: { pagos: true } },
        },
        orderBy: { fecha: 'desc' },
      }),
      prisma.factura.groupBy({
        by: ['tipo'],
        where: { estado: { not: 'anulada' } },
        _sum: { total: true, montoPagado: true },
      }),
    ])

    const resumen = {
      totalIngresos: 0,
      totalEgresos: 0,
      cobrado: 0,
      pagado: 0,
    }
    for (const t of totales) {
      if (t.tipo === 'ingreso') {
        resumen.totalIngresos = t._sum.total || 0
        resumen.cobrado = t._sum.montoPagado || 0
      } else {
        resumen.totalEgresos = t._sum.total || 0
        resumen.pagado = t._sum.montoPagado || 0
      }
    }

    return NextResponse.json({ facturas, resumen })
  } catch (error) {
    console.error('Error fetching facturas:', error)
    return NextResponse.json({ error: 'Error al obtener facturas' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const contentType = request.headers.get('content-type') || ''
    let data: any
    let archivoUrl: string | null = null

    let driveUrl: string | null = null

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('archivo') as File | null
      if (file && file.size > 0) {
        if (file.size > MAX_SIZE) throw new Error('Archivo supera 10 MB')
        // Read buffer once, use for both local save and Drive upload
        const buffer = Buffer.from(await file.arrayBuffer())
        archivoUrl = await saveFileBuffer(buffer, file.name)
        // Upload to Google Drive (best-effort)
        try {
          console.log('Uploading to Drive:', file.name, file.type, buffer.length, 'bytes')
          driveUrl = await uploadToDrive(buffer, file.name, file.type)
          console.log('Drive result:', driveUrl)
        } catch (err) {
          console.error('Drive upload failed (continuing):', err)
        }
      }
      data = Object.fromEntries(formData.entries())
      delete data.archivo
    } else {
      data = await request.json()
    }

    const { numero, ncf, tipo, fecha, fechaVencimiento, proveedor, rncProveedor, clienteId, destinoTipo, proyectoId, descripcion, subtotal, impuesto, total, observaciones } = data

    if (!numero?.toString().trim()) {
      return NextResponse.json({ error: 'El número de factura es requerido' }, { status: 400 })
    }
    if (!tipo || !['ingreso', 'egreso'].includes(tipo)) {
      return NextResponse.json({ error: 'Tipo debe ser ingreso o egreso' }, { status: 400 })
    }

    const factura = await prisma.factura.create({
      data: {
        numero: numero.toString().trim(),
        ncf: ncf || null,
        tipo,
        fecha: new Date(fecha || Date.now()),
        fechaVencimiento: fechaVencimiento ? new Date(fechaVencimiento) : null,
        proveedor: proveedor || null,
        rncProveedor: rncProveedor || null,
        clienteId: clienteId ? parseInt(String(clienteId)) : null,
        destinoTipo: destinoTipo || 'general',
        proyectoId: proyectoId ? parseInt(String(proyectoId)) : null,
        descripcion: descripcion || null,
        subtotal: parseFloat(String(subtotal)) || 0,
        impuesto: parseFloat(String(impuesto)) || 0,
        total: parseFloat(String(total)) || 0,
        observaciones: observaciones || null,
        archivoUrl,
        driveUrl,
      },
      include: { cliente: { select: { id: true, nombre: true } }, proyecto: { select: { id: true, nombre: true } } },
    })

    return NextResponse.json(factura, { status: 201 })
  } catch (error) {
    console.error('Error creating factura:', error)
    return NextResponse.json({ error: 'Error al crear factura' }, { status: 500 })
  }
}
