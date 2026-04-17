import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  const body = await request.json()
  const { nombre, correo, rol, activo, password, costoHora } = body

  // Validar rol explícitamente. Nunca defaultear a 'Admin'.
  const rolesValidos = ['Admin', 'Usuario']
  const rolFinal = rol !== undefined
    ? (rolesValidos.includes(rol) ? rol : 'Usuario')
    : undefined // si no viene, no tocar

  const updateData: Record<string, unknown> = {
    nombre, correo, activo,
    ...(rolFinal !== undefined ? { rol: rolFinal } : {}),
    costoHora: costoHora !== undefined ? parseFloat(costoHora) : undefined,
  }

  if (password) {
    if (password.length < 6) {
      return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
    }
    updateData.password = await bcrypt.hash(password, 12)
  }

  try {
    const usuario = await prisma.usuario.update({ where: { id }, data: updateData })
    return NextResponse.json({
      id: usuario.id, nombre: usuario.nombre, correo: usuario.correo,
      rol: usuario.rol, activo: usuario.activo, costoHora: usuario.costoHora,
      createdAt: usuario.createdAt, hasPassword: Boolean(usuario.password),
    })
  } catch (error: unknown) {
    const msg = error instanceof Error && error.message.includes('Unique')
      ? 'Ya existe un usuario con ese correo' : 'Error al actualizar'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  await prisma.usuario.delete({ where: { id } })
  return NextResponse.json({ ok: true })
}
