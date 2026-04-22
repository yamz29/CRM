/**
 * Recalcula la Ruta Crítica (esCritica + holguraDias) de todos los
 * cronogramas existentes.
 *
 * Se corre una sola vez después de deployar las Fases 1-6 para que los
 * cronogramas previos tengan los nuevos campos poblados correctamente.
 *
 * Idempotente: se puede correr múltiples veces.
 *
 * Uso:
 *   npx tsx scripts/recalcular-cpm.ts
 *   DATABASE_URL="$DATABASE_URL_PROD" npx tsx scripts/recalcular-cpm.ts
 */

import { PrismaClient } from '@prisma/client'
import { recalcularCriticalPath } from '../lib/cronograma-scheduling'

const prisma = new PrismaClient()

async function main() {
  const cronogramas = await prisma.cronograma.findMany({
    select: { id: true, nombre: true, _count: { select: { actividades: true } } },
  })

  console.log(`Encontrados ${cronogramas.length} cronogramas.`)
  let procesados = 0
  let errores = 0

  for (const c of cronogramas) {
    if (c._count.actividades === 0) {
      console.log(`  [${c.id}] ${c.nombre} — sin actividades, salto`)
      continue
    }
    try {
      await recalcularCriticalPath(c.id)
      console.log(`  ✓ [${c.id}] ${c.nombre} (${c._count.actividades} actividades)`)
      procesados++
    } catch (e) {
      console.error(`  ✗ [${c.id}] ${c.nombre}:`, e instanceof Error ? e.message : e)
      errores++
    }
  }

  console.log('')
  console.log(`✓ Completado: ${procesados} procesados, ${errores} errores`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
