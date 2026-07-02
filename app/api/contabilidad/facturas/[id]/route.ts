import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { uploadToDrive } from '@/lib/google-drive'
import { apiHandler, ApiError } from '@/lib/api-handler'
import { FacturaUpdateSchema } from '@/lib/api-schemas'
import { recalcularEstadoFactura } from '@/lib/factura-estado'
import { subirFacturaServidor, isServerSharePointConfigured } from '@/lib/sharepoint-server'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'facturas')
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

async function saveFileBuffer(buffer: Buffer, originalName: string): Promise<string> {
  const ext = originalName.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXT.includes(ext)) throw new ApiError(400, 'Formato de archivo no permitido')
  await mkdir(UPLOAD_DIR, { recursive: true })
  const filename = `factura-${Date.now()}.${ext}`
  await writeFile(path.join(UPLOAD_DIR, filename), buffer)
  return `/uploads/facturas/${filename}`
}

export const GET = apiHandler({ modulo: 'contabilidad', nivel: 'ver' }, async (_req, ctx) => {
  const factura = await prisma.factura.findUnique({
    where: { id: ctx.id },
    include: {
      cliente: { select: { id: true, nombre: true } },
      proyecto: { select: { id: true, nombre: true } },
      pagos: {
        include: { cuentaBancaria: { select: { id: true, nombre: true, banco: true } } },
        orderBy: { fecha: 'desc' },
      },
      aplicaciones: {
        include: {
          recibo: {
            select: {
              id: true, numero: true, fecha: true, metodoPago: true,
              referencia: true, observaciones: true,
              cuentaBancaria: { select: { id: true, nombre: true, banco: true } },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
  if (!factura) throw new ApiError(404, 'No encontrada')
  return NextResponse.json(factura)
})

export const PUT = apiHandler({ modulo: 'contabilidad', nivel: 'editar' }, async (request, ctx) => {
  const id = ctx.id
  const existing = await prisma.factura.findUnique({ where: { id } })
  if (!existing) throw new ApiError(404, 'No encontrada')

  const contentType = request.headers.get('content-type') || ''
  let raw: Record<string, unknown>
  let archivoUrl: string | undefined
  let driveUrl: string | undefined
  // Buffer del nuevo archivo conservado para la subida server-side a SharePoint.
  let fileBuffer: Buffer | null = null
  let fileOriginalName = ''
  let fileContentType = ''

  if (contentType.includes('multipart/form-data')) {
    const formData = await request.formData()
    const file = formData.get('archivo') as File | null
    if (file && file.size > 0) {
      if (file.size > MAX_SIZE) throw new ApiError(400, 'Archivo supera 10 MB')
      // Delete old file
      if (existing.archivoUrl) {
        try { await unlink(path.join(process.cwd(), 'public', existing.archivoUrl)) } catch {}
      }
      // Read buffer once
      const buffer = Buffer.from(await file.arrayBuffer())
      archivoUrl = await saveFileBuffer(buffer, file.name)
      fileBuffer = buffer
      fileOriginalName = file.name
      fileContentType = file.type
      // Upload to Google Drive (best-effort)
      try {
        driveUrl = (await uploadToDrive(buffer, file.name, file.type)) || undefined
      } catch (err) {
        console.error('Drive upload failed (continuing):', err)
      }
    }
    raw = Object.fromEntries(formData.entries())
    delete raw.archivo
  } else {
    raw = await request.json()
  }

  // Validación central (parcial: campo ausente = no tocar). El ZodError lo
  // traduce apiHandler a 400 con detalles.
  const body = FacturaUpdateSchema.parse(raw)

  const updateData: any = {}
  if (body.numero !== undefined) updateData.numero = body.numero
  if (body.ncf !== undefined) updateData.ncf = body.ncf
  if (body.tipo !== undefined) updateData.tipo = body.tipo
  if (body.fecha !== undefined && body.fecha !== null) updateData.fecha = body.fecha
  if (body.fechaVencimiento !== undefined) updateData.fechaVencimiento = body.fechaVencimiento
  if (body.proveedor !== undefined) updateData.proveedor = body.proveedor
  if (body.rncProveedor !== undefined) updateData.rncProveedor = body.rncProveedor
  if (body.clienteId !== undefined) updateData.clienteId = body.clienteId
  if (body.destinoTipo !== undefined) updateData.destinoTipo = body.destinoTipo || 'general'
  if (body.proyectoId !== undefined) updateData.proyectoId = body.proyectoId
  if (body.descripcion !== undefined) updateData.descripcion = body.descripcion
  if (body.subtotal !== undefined) updateData.subtotal = body.subtotal
  if (body.tasaItbis !== undefined) updateData.tasaItbis = body.tasaItbis
  if (body.impuesto !== undefined) updateData.impuesto = body.impuesto
  if (body.propinaLegal !== undefined) updateData.propinaLegal = body.propinaLegal
  if (body.otrosImpuestos !== undefined) updateData.otrosImpuestos = body.otrosImpuestos
  if (body.total !== undefined) updateData.total = body.total
  // Solo aceptamos cambios de estado a 'anulada' desde el body. Los demás
  // estados (pendiente/parcial/pagada) se derivan de los pagos y se
  // recalculan al final del handler. Evita drift entre estado y montoPagado.
  if (body.estado === 'anulada') updateData.estado = 'anulada'
  if (body.observaciones !== undefined) updateData.observaciones = body.observaciones
  if (archivoUrl !== undefined) updateData.archivoUrl = archivoUrl
  if (driveUrl !== undefined) updateData.driveUrl = driveUrl
  if (body.sharepointUrl !== undefined) updateData.sharepointUrl = body.sharepointUrl

  // Subida server-side a SharePoint del archivo nuevo (best-effort, gated).
  // Si tiene éxito, manda sobre cualquier sharepointUrl que viniera del body.
  if (fileBuffer && isServerSharePointConfigured()) {
    const spUrl = await subirFacturaServidor({
      fileBuffer,
      originalName: fileOriginalName,
      proveedor: (body.proveedor ?? existing.proveedor) || null,
      numero: (body.numero ?? existing.numero) || null,
      fecha: body.fecha ?? existing.fecha,
      facturaId: id,
      contentType: fileContentType,
    })
    if (spUrl) updateData.sharepointUrl = spUrl
  }

  const factura = await prisma.factura.update({
    where: { id },
    data: updateData,
    include: { cliente: { select: { id: true, nombre: true } }, proyecto: { select: { id: true, nombre: true } } },
  })

  // Re-sincronizar montoPagado y estado contra la suma real de pagos.
  // Crítico cuando cambia `total` — sin esto, una factura con pagos al 100%
  // del total viejo queda en estado='parcial' al subir el total. No-op si
  // la factura quedó como 'anulada'.
  await recalcularEstadoFactura(id)

  // Sync linked gasto when factura changes
  if (factura.tipo === 'egreso') {
    const gastoExistente = await prisma.gastoProyecto.findUnique({ where: { facturaId: id } })

    if (factura.estado === 'anulada' && gastoExistente) {
      // Anulada → delete the gasto
      await prisma.gastoProyecto.delete({ where: { facturaId: id } })
    } else if (factura.proyectoId && gastoExistente) {
      // Update existing gasto
      await prisma.gastoProyecto.update({
        where: { facturaId: id },
        data: {
          proyectoId: factura.proyectoId,
          fecha: factura.fecha,
          descripcion: factura.descripcion || `Factura #${factura.numero}`,
          suplidor: factura.proveedor,
          monto: factura.total,
          referencia: `FAC-${factura.numero}`,
        },
      })
    } else if (factura.proyectoId && !gastoExistente) {
      // New project assigned → create gasto
      await prisma.gastoProyecto.create({
        data: {
          proyectoId: factura.proyectoId,
          destinoTipo: factura.destinoTipo || 'proyecto',
          fecha: factura.fecha,
          tipoGasto: 'Factura',
          referencia: `FAC-${factura.numero}`,
          descripcion: factura.descripcion || `Factura #${factura.numero}`,
          suplidor: factura.proveedor,
          monto: factura.total,
          metodoPago: 'Factura',
          facturaId: id,
        },
      })
    } else if (!factura.proyectoId && gastoExistente) {
      // Project removed → delete gasto
      await prisma.gastoProyecto.delete({ where: { facturaId: id } })
    }
  }

  return NextResponse.json(factura)
})

export const DELETE = apiHandler({ modulo: 'contabilidad', nivel: 'admin' }, async (_req, ctx) => {
  const id = ctx.id
  const existing = await prisma.factura.findUnique({
    where: { id },
    include: { _count: { select: { pagos: true } } },
  })
  if (!existing) throw new ApiError(404, 'No encontrada')

  // Block deletion if factura has payments
  if (existing._count.pagos > 0) {
    throw new ApiError(409, 'No se puede eliminar una factura con pagos registrados. Anúlela en su lugar.')
  }

  // Clean up associated bank movements (orphan prevention)
  await prisma.movimientoBancario.updateMany({
    where: { facturaId: id },
    data: { conciliado: false, facturaId: null },
  })

  // Delete linked gasto
  await prisma.gastoProyecto.deleteMany({ where: { facturaId: id } })

  // Delete file if exists
  if (existing.archivoUrl) {
    try { await unlink(path.join(process.cwd(), 'public', existing.archivoUrl)) } catch {}
  }

  await prisma.factura.delete({ where: { id } })
  return NextResponse.json({ success: true })
})
