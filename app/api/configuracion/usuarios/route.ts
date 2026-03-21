import { prisma } from '@/lib/prisma'
import { NextResponse } from 'next/server'
import bcrypt from 'bcryptjs'

export async function GET() {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, correo: true, rol: true, activo: true, createdAt: true,
      password: false }, // never expose hashed password
  })
  // Add hasPassword field
  const all = await prisma.usuario.findMany({ orderBy: { nombre: 'asc' } })
  const withFlag = all.map((u) => ({
    id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol,
    activo: u.activo, createdAt: u.createdAt,
    hasPassword: Boolean(u.password),
  }))
  return NextResponse.json(withFlag)
}

export async function POST(request: Request) {
  try {
    const body = await request.json()
    const { nombre, correo, rol, activo, password } = body

    if (!nombre || !correo) {
      return NextResponse.json({ error: 'Nombre y correo son requeridos' }, { status: 400 })
    }

    let hashedPassword: string | null = null
    if (password) {
      if (password.length < 6) {
        return NextResponse.json({ error: 'La contraseña debe tener al menos 6 caracteres' }, { status: 400 })
      }
      hashedPassword = await bcrypt.hash(password, 12)
    }

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        correo,
        rol: rol || 'Admin',
        activo: activo !== undefined ? activo : true,
        password: hashedPassword,
      },
    })

    return NextResponse.json({
      id: usuario.id, nombre: usuario.nombre, correo: usuario.correo,
      rol: usuario.rol, activo: usuario.activo, createdAt: usuario.createdAt,
      hasPassword: Boolean(usuario.password),
    }, { status: 201 })
  } catch (error: unknown) {
    console.error(error)
    const msg = error instanceof Error && error.message.includes('Unique')
      ? 'Ya existe un usuario con ese correo' : 'Error al crear usuario'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
