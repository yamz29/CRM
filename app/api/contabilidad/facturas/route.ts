import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import path from 'path'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { FacturaCreateSchema } from '@/lib/api-schemas'
import { generarNumeroProforma } from '@/lib/numero-factura'
import { subirFacturaServidor, isServerSharePointConfigured } from '@/lib/sharepoint-server'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'facturas')
const MAX_SIZE = 10 * 1024 * 1024 // 10 MB
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

async function saveFileBuffer(buffer: Buffer, originalName: string): Promise<string> {
  const ext = originalName.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXT.includes(ext)) throw new ApiError(400, 'Formato de archivo no permitido')

  await mkdir(UPLOAD_DIR, { recursive: true })
  const filename = `factura-${Date.now()}.${ext}`
  await writeFile(path.join(UPLOAD_DIR, filename), buffer)
  return `/uploads/facturas/${filename}`
}

export const GET = apiHandler({ modulo: 'contabilidad', nivel: 'ver' }, async (request) => {
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
})

export const POST = apiHandler({ modulo: 'contabilidad', nivel: 'editar' }, async (request) => {
  const contentType = request.headers.get('content-type') || ''
  let raw: Record<string, unknown>
  let archivoUrl: string | null = null
  // Buffer del archivo conservado para la subida server-side a SharePoint.
  let fileBuffer: Buffer | null = null
  let fileOriginalName = ''
  let fileContentType = ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('archivo') as File | null
    if (file && file.size > 0) {
      if (file.size > MAX_SIZE) throw new ApiError(400, 'Archivo supera 10 MB')
      const buffer = Buffer.from(await file.arrayBuffer())
      archivoUrl = await saveFileBuffer(buffer, file.name)
      fileBuffer = buffer
      fileOriginalName = file.name
      fileContentType = file.type
    }
    raw = Object.fromEntries(formData.entries())
    delete raw.archivo
  } else {
    raw = await request.json()
  }

  // Validación central: el ZodError lo traduce apiHandler a 400 con detalles.
  const body = FacturaCreateSchema.parse(raw)

  // Las facturas de INGRESO (cobros) nacen siempre como proforma: número
  // PRO-YYYY-NNNN autogenerado y sin NCF. El NCF se agrega después con
  // "Convertir a fiscal". Unifica con las proformas emitidas desde el
  // presupuesto. El EGRESO conserva su número manual y NCF del proveedor.
  const esIngreso = body.tipo === 'ingreso'
  const numeroFinal = esIngreso ? await generarNumeroProforma() : body.numero!

  const fechaFactura = body.fecha ?? new Date()

  // Subida server-side a SharePoint (best-effort, solo si está configurado).
  // Si tiene éxito, la factura nace ya con sharepointUrl y el cliente NO
  // reintenta la subida desde el navegador.
  let sharepointUrl: string | null = null
  if (fileBuffer && isServerSharePointConfigured()) {
    sharepointUrl = await subirFacturaServidor({
      fileBuffer,
      originalName: fileOriginalName,
      proveedor: body.proveedor ?? null,
      numero: numeroFinal,
      fecha: fechaFactura,
      contentType: fileContentType,
    })
  }

  const factura = await prisma.factura.create({
    data: {
      numero: numeroFinal,
      ncf: esIngreso ? null : (body.ncf ?? null),
      esProforma: esIngreso,
      tipo: body.tipo,
      fecha: fechaFactura,
      fechaVencimiento: body.fechaVencimiento ?? null,
      proveedorId: body.proveedorId ?? null,
      proveedor: body.proveedor ?? null,
      rncProveedor: body.rncProveedor ?? null,
      clienteId: body.clienteId ?? null,
      destinoTipo: body.destinoTipo,
      proyectoId: body.proyectoId ?? null,
      descripcion: body.descripcion ?? null,
      subtotal: body.subtotal,
      tasaItbis: body.tasaItbis,
      impuesto: body.impuesto,
      propinaLegal: body.propinaLegal,
      otrosImpuestos: body.otrosImpuestos,
      total: body.total,
      observaciones: body.observaciones ?? null,
      archivoUrl,
      sharepointUrl,
    },
    include: { cliente: { select: { id: true, nombre: true } }, proyecto: { select: { id: true, nombre: true } } },
  })

  // Auto-create gasto for egreso invoices linked to a project
  if (body.tipo === 'egreso' && body.proyectoId) {
    await prisma.gastoProyecto.create({
      data: {
        proyectoId: body.proyectoId,
        destinoTipo: body.destinoTipo || 'proyecto',
        fecha: fechaFactura,
        tipoGasto: 'Factura',
        referencia: `FAC-${factura.numero}`,
        descripcion: body.descripcion ?? `Factura #${factura.numero}`,
        suplidor: body.proveedor ?? null,
        monto: body.total,
        metodoPago: 'Factura',
        observaciones: body.ncf ? `NCF: ${body.ncf}` : null,
        archivoUrl,
        facturaId: factura.id,
      },
    })
  }

  return NextResponse.json(factura, { status: 201 })
})
