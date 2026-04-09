import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// PUT /api/proveedores/[id]
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  try {
    const body = await request.json()
    const data: Record<string, unknown> = {}

    if (body.nombre !== undefined) {
      const nombre = body.nombre?.toString().trim()
      if (!nombre) return NextResponse.json({ error: 'El nombre es obligatorio' }, { status: 400 })
      data.nombre = nombre
    }
    if (body.rnc !== undefined) {
      const rnc = body.rnc?.toString().trim() || null
      if (rnc) {
        const existe = await prisma.proveedor.findFirst({ where: { rnc, id: { not: id } } })
        if (existe) {
          return NextResponse.json({ error: `Ya existe un proveedor con RNC ${rnc}: ${existe.nombre}` }, { status: 409 })
        }
      }
      data.rnc = rnc
    }
    if (body.telefono !== undefined) data.telefono = body.telefono?.toString().trim() || null
    if (body.contacto !== undefined) data.contacto = body.contacto?.toString().trim() || null
    if (body.correo !== undefined) data.correo = body.correo?.toString().trim() || null
    if (body.direccion !== undefined) data.direccion = body.direccion?.toString().trim() || null
    if (body.condicionesPago !== undefined) data.condicionesPago = body.condicionesPago?.toString().trim() || null
    if (body.notas !== undefined) data.notas = body.notas?.toString().trim() || null
    if (body.activo !== undefined) data.activo = Boolean(body.activo)

    const proveedor = await prisma.proveedor.update({ where: { id }, data })
    return NextResponse.json(proveedor)
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error al actualizar'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// DELETE /api/proveedores/[id] — soft delete (desactivar)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const denied = await checkPermiso(request, 'contabilidad', 'admin')
  if (denied) return denied

  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) return NextResponse.json({ error: 'ID inválido' }, { status: 400 })

  // Soft delete — marcar inactivo en lugar de borrar
  await prisma.proveedor.update({ where: { id }, data: { activo: false } })
  return NextResponse.json({ ok: true })
}
