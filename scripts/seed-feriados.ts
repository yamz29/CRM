/**
 * Carga feriados oficiales de la República Dominicana en la tabla
 * dia_feriado para los próximos 3 años (año actual, siguiente y el
 * posterior). Idempotente: si un feriado ya existe para esa fecha, lo
 * respeta (no sobrescribe el nombre por si el usuario lo editó).
 *
 * Uso local:
 *   npx tsx scripts/seed-feriados.ts
 *
 * Uso en el VPS:
 *   source .env.server
 *   DATABASE_URL="$DATABASE_URL_PROD" npx tsx scripts/seed-feriados.ts
 */

import { PrismaClient } from '@prisma/client'
import { feriadosDominicanos } from '../lib/calendario-laboral'

const prisma = new PrismaClient()

async function main() {
  const currentYear = new Date().getUTCFullYear()
  const years = [currentYear, currentYear + 1, currentYear + 2]

  let creados = 0
  let existentes = 0

  for (const year of years) {
    const feriados = feriadosDominicanos(year)
    for (const f of feriados) {
      const existe = await prisma.diaFeriado.findUnique({ where: { fecha: f.fecha } })
      if (existe) {
        existentes++
        continue
      }
      await prisma.diaFeriado.create({
        data: { fecha: f.fecha, nombre: f.nombre, recurrente: f.recurrente },
      })
      creados++
      console.log(`  ${f.fecha.toISOString().slice(0, 10)}  ${f.nombre}`)
    }
  }

  console.log('')
  console.log(`✓ Seed completado para años ${years.join(', ')}`)
  console.log(`  Creados:    ${creados}`)
  console.log(`  Existentes: ${existentes}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
