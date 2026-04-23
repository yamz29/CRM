import { prisma } from '@/lib/prisma'
import { NextResponse, type NextRequest } from 'next/server'
import bcrypt from 'bcryptjs'
import { withPermiso } from '@/lib/with-permiso'

export const GET = withPermiso('configuracion', 'ver', async (_req: NextRequest) => {
  const usuarios = await prisma.usuario.findMany({
    orderBy: { nombre: 'asc' },
    select: { id: true, nombre: true, correo: true, rol: true, activo: true, createdAt: true,
      password: false }, // never expose hashed password
  })
  // Add hasPassword field
  const all = await prisma.usuario.findMany({ orderBy: { nombre: 'asc' } })
  const withFlag = all.map((u) => ({
    id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol,
    activo: u.activo, costoHora: u.costoHora, createdAt: u.createdAt,
    hasPassword: Boolean(u.password),
  }))
  return NextResponse.json(withFlag)
})

export const POST = withPermiso('configuracion', 'editar', async (request: NextRequest) => {
  try {
    const body = await request.json()
    const { nombre, correo, rol, activo, password, costoHora } = body

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

    // Validar rol explícitamente. Nunca defaultear a 'Admin' aunque venga vacío.
    const rolesValidos = ['Admin', 'Usuario']
    const rolFinal = rolesValidos.includes(rol) ? rol : 'Usuario'

    const usuario = await prisma.usuario.create({
      data: {
        nombre,
        correo,
        rol: rolFinal,
        activo: activo !== undefined ? activo : true,
        costoHora: costoHora ? parseFloat(costoHora) : 0,
        password: hashedPassword,
      },
    })

    return NextResponse.json({
      id: usuario.id, nombre: usuario.nombre, correo: usuario.correo,
      rol: usuario.rol, activo: usuario.activo, costoHora: usuario.costoHora,
      createdAt: usuario.createdAt, hasPassword: Boolean(usuario.password),
    }, { status: 201 })
  } catch (error: unknown) {
    console.error(error)
    const msg = error instanceof Error && error.message.includes('Unique')
      ? 'Ya existe un usuario con ese correo' : 'Error al crear usuario'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})
