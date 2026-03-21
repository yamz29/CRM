import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  const correo = 'admin@gonzalvagroup.com'
  const existing = await prisma.usuario.findUnique({ where: { correo } })

  if (existing) {
    console.log('El usuario admin ya existe:', correo)
    return
  }

  const password = await bcrypt.hash('admin123', 12)
  const usuario = await prisma.usuario.create({
    data: {
      nombre: 'Administrador',
      correo,
      password,
      rol: 'Admin',
      activo: true,
    },
  })

  console.log('Usuario admin creado:', usuario.correo)
  console.log('Contraseña inicial: admin123')
  console.log('IMPORTANTE: Cambia la contraseña después del primer ingreso.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
