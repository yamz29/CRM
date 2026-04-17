/**
 * Migración única para la Tarea 1.1 del plan de seguridad.
 *
 * Contexto: antes, un usuario sin fila en PermisoUsuario obtenía nivel
 * 'editar' por defecto (puerta trasera). Ahora el default es 'ninguno'.
 *
 * Para preservar el comportamiento actual para usuarios existentes, este
 * script inserta una fila PermisoUsuario(nivel='editar') por cada
 * (usuario, módulo) donde NO exista ya una fila.
 *
 * Idempotente: puede ejecutarse múltiples veces sin efectos secundarios
 * (usa createMany con skipDuplicates).
 *
 * Ejecutar UNA VEZ en producción después del deploy, antes de reiniciar PM2:
 *   DATABASE_URL="$DATABASE_URL_PROD" npx tsx scripts/migrate-permisos-default.ts
 *
 * También asegura que el admin principal (ygonzalez@gonzalva.com.do)
 * tenga rol = 'Admin' (por seguridad ante el cambio del default).
 */

import { PrismaClient } from '@prisma/client'
import { MODULOS } from '../lib/permisos'

const ADMIN_PRINCIPAL_CORREO = 'ygonzalez@gonzalva.com.do'

const prisma = new PrismaClient()

async function main() {
  console.log('🔒 Migración de permisos — preservando acceso para usuarios existentes')
  console.log('')

  // 1. Garantizar que el admin principal tenga rol 'Admin'
  const admin = await prisma.usuario.findUnique({
    where: { correo: ADMIN_PRINCIPAL_CORREO },
  })
  if (admin) {
    if (admin.rol !== 'Admin') {
      await prisma.usuario.update({
        where: { id: admin.id },
        data: { rol: 'Admin' },
      })
      console.log(`✓ Rol 'Admin' restaurado para ${ADMIN_PRINCIPAL_CORREO}`)
    } else {
      console.log(`✓ ${ADMIN_PRINCIPAL_CORREO} ya tiene rol Admin`)
    }
  } else {
    console.warn(`⚠️  Usuario ${ADMIN_PRINCIPAL_CORREO} no existe en la DB`)
  }

  // 2. Listar todos los usuarios activos
  const usuarios = await prisma.usuario.findMany({
    where: { activo: true },
    select: { id: true, correo: true, rol: true },
  })
  console.log(`\nEncontrados ${usuarios.length} usuarios activos`)

  // 3. Por cada usuario NO-admin, insertar permiso 'editar' para módulos
  //    sin registro previo. Los admins no necesitan permisos explícitos.
  const modulos = MODULOS.map(m => m.key)
  let totalInsertados = 0
  let totalPreservados = 0

  for (const user of usuarios) {
    if (user.rol === 'Admin') {
      console.log(`  • ${user.correo} → Admin (se salta, tiene acceso total)`)
      continue
    }

    // Permisos existentes
    const existentes = await prisma.permisoUsuario.findMany({
      where: { usuarioId: user.id },
      select: { modulo: true },
    })
    const existentesSet = new Set(existentes.map(e => e.modulo))

    // Módulos que aún no tienen fila para este usuario
    const modulosFaltantes = modulos.filter(m => !existentesSet.has(m))

    if (modulosFaltantes.length === 0) {
      console.log(`  • ${user.correo} → ya tiene permisos explícitos en todos los módulos (ok)`)
      totalPreservados += modulos.length
      continue
    }

    await prisma.permisoUsuario.createMany({
      data: modulosFaltantes.map(modulo => ({
        usuarioId: user.id,
        modulo,
        nivel: 'editar',  // preservar comportamiento actual
      })),
      skipDuplicates: true,
    })

    console.log(`  • ${user.correo} → +${modulosFaltantes.length} permisos 'editar' (preservando acceso)`)
    totalInsertados += modulosFaltantes.length
    totalPreservados += existentes.length
  }

  console.log('')
  console.log(`✓ Permisos insertados: ${totalInsertados}`)
  console.log(`✓ Permisos existentes preservados: ${totalPreservados}`)
  console.log('')
  console.log('A partir de ahora, usuarios NUEVOS empiezan sin acceso (default: ninguno)')
  console.log('Debes asignar permisos explícitamente desde /configuracion')
}

main()
  .catch(e => {
    console.error('Error en migración:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
