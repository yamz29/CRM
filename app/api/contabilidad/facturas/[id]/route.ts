import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir, unlink } from 'fs/promises'
import path from 'path'
import { uploadToDrive } from '@/lib/google-drive'
import { checkPermiso } from '@/lib/permisos'

const UPLOAD_DIR = path.join(process.cwd(), 'public', 'uploads', 'facturas')
const MAX_SIZE = 10 * 1024 * 1024
const ALLOWED_EXT = ['pdf', 'jpg', 'jpeg', 'png', 'webp']

async function saveFileBuffer(buffer: Buffer, originalName: string): Promise<string> {
  const ext = originalName.split('.').pop()?.toLowerCase() || ''
  if (!ALLOWED_EXT.includes(ext)) throw new Error('Formato no permitido')
  await mkdir(UPLOAD_DIR, { recursive: true })
  const filename = `factura-${Date.now()}.${ext}`
  await writeFile(path.join(UPLOAD_DIR, filename), buffer)
  return `/uploads/facturas/${filename}`
}

type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(_req, 'contabilidad', 'ver')
  if (denied) return denied

  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const factura = await prisma.factura.findUnique({
      where: { id },
      include: {
        cliente: { select: { id: true, nombre: true } },
        proyecto: { select: { id: true, nombre: true } },
        pagos: {
          include: { cuentaBancaria: { select: { id: true, nombre: true, banco: true } } },
          orderBy: { fecha: 'desc' },
        },
      },
    })
    if (!factura) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })
    return NextResponse.json(factura)
  } catch (error) {
    console.error('Error fetching factura:', error)
    return NextResponse.json({ error: 'Error al obtener factura' }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const existing = await prisma.factura.findUnique({ where: { id } })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    const contentType = request.headers.get('content-type') || ''
    let data: any
    let archivoUrl: string | undefined
    let driveUrl: string | undefined

    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData()
      const file = formData.get('archivo') as File | null
      if (file && file.size > 0) {
        if (file.size > MAX_SIZE) throw new Error('Archivo supera 10 MB')
        // Delete old file
        if (existing.archivoUrl) {
          try { await unlink(path.join(process.cwd(), 'public', existing.archivoUrl)) } catch {}
        }
        // Read buffer once
        const buffer = Buffer.from(await file.arrayBuffer())
        archivoUrl = await saveFileBuffer(buffer, file.name)
        // Upload to Google Drive (best-effort)
        try {
          driveUrl = (await uploadToDrive(buffer, file.name, file.type)) || undefined
        } catch (err) {
          console.error('Drive upload failed (continuing):', err)
        }
      }
      data = Object.fromEntries(formData.entries())
      delete data.archivo
    } else {
      data = await request.json()
    }

    const { numero, ncf, tipo, fecha, fechaVencimiento, proveedor, rncProveedor, clienteId, destinoTipo, proyectoId, descripcion, subtotal, impuesto, total, estado, observaciones } = data

    const updateData: any = {}
    if (numero !== undefined) updateData.numero = numero.toString().trim()
    if (ncf !== undefined) updateData.ncf = ncf || null
    if (tipo !== undefined) updateData.tipo = tipo
    if (fecha !== undefined) updateData.fecha = new Date(fecha)
    if (fechaVencimiento !== undefined) updateData.fechaVencimiento = fechaVencimiento ? new Date(fechaVencimiento) : null
    if (proveedor !== undefined) updateData.proveedor = proveedor || null
    if (rncProveedor !== undefined) updateData.rncProveedor = rncProveedor || null
    if (clienteId !== undefined) updateData.clienteId = clienteId ? parseInt(String(clienteId)) : null
    if (destinoTipo !== undefined) updateData.destinoTipo = destinoTipo || 'general'
    if (proyectoId !== undefined) updateData.proyectoId = proyectoId ? parseInt(String(proyectoId)) : null
    if (descripcion !== undefined) updateData.descripcion = descripcion || null
    if (subtotal !== undefined) updateData.subtotal = parseFloat(String(subtotal)) || 0
    if (impuesto !== undefined) updateData.impuesto = parseFloat(String(impuesto)) || 0
    if (total !== undefined) updateData.total = parseFloat(String(total)) || 0
    if (estado !== undefined) updateData.estado = estado
    if (observaciones !== undefined) updateData.observaciones = observaciones || null
    if (archivoUrl !== undefined) updateData.archivoUrl = archivoUrl
    if (driveUrl !== undefined) updateData.driveUrl = driveUrl

    const factura = await prisma.factura.update({
      where: { id },
      data: updateData,
      include: { cliente: { select: { id: true, nombre: true } }, proyecto: { select: { id: true, nombre: true } } },
    })

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
  } catch (error) {
    console.error('Error updating factura:', error)
    return NextResponse.json({ error: 'Error al actualizar factura' }, { status: 500 })
  }
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const denied = await checkPermiso(_req, 'contabilidad', 'admin')
  if (denied) return denied

  const id = parseInt((await params).id)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const existing = await prisma.factura.findUnique({
      where: { id },
      include: { _count: { select: { pagos: true } } },
    })
    if (!existing) return NextResponse.json({ error: 'No encontrada' }, { status: 404 })

    // Block deletion if factura has payments
    if (existing._count.pagos > 0) {
      return NextResponse.json(
        { error: 'No se puede eliminar una factura con pagos registrados. Anúlela en su lugar.' },
        { status: 409 }
      )
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
  } catch (error) {
    console.error('Error deleting factura:', error)
    return NextResponse.json({ error: 'Error al eliminar factura' }, { status: 500 })
  }
}
