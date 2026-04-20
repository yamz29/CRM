/**
 * Backfill de códigos de proyecto.
 *
 * Asigna un código consecutivo (R-0001, C-0001, etc.) a los proyectos existentes
 * que aún no tienen uno. Ordena por createdAt ascendente dentro de cada tipo,
 * para que el proyecto más viejo de cada tipo reciba el número 0001.
 *
 * Idempotente: solo asigna a proyectos donde codigo IS NULL. Se puede correr
 * múltiples veces sin efectos secundarios.
 *
 * Ejecutar una vez en el servidor (después de `prisma db push` que crea la
 * columna):
 *   DATABASE_URL="$DATABASE_URL_PROD" npx tsx scripts/backfill-codigos-proyectos.ts
 *
 * En dev local:
 *   npx tsx scripts/backfill-codigos-proyectos.ts
 */

import { PrismaClient } from '@prisma/client'
import { prefijoDeTipo, numeroDeCodigo } from '../lib/codigo-proyecto'

const prisma = new PrismaClient()

async function main() {
  const proyectos = await prisma.proyecto.findMany({
    orderBy: { createdAt: 'asc' },
    select: { id: true, tipoProyecto: true, codigo: true, nombre: true },
  })

  // Construir contador por prefijo usando los códigos ya asignados.
  const contadorPorPrefijo = new Map<string, number>()
  for (const p of proyectos) {
    if (p.codigo) {
      const m = p.codigo.match(/^([A-Z]+)-/)
      if (m) {
        const prefijo = m[1]
        const num = numeroDeCodigo(p.codigo)
        contadorPorPrefijo.set(prefijo, Math.max(contadorPorPrefijo.get(prefijo) ?? 0, num))
      }
    }
  }

  let asignados = 0
  let saltados = 0

  for (const p of proyectos) {
    if (p.codigo) { saltados++; continue }
    const prefijo = prefijoDeTipo(p.tipoProyecto)
    const siguiente = (contadorPorPrefijo.get(prefijo) ?? 0) + 1
    contadorPorPrefijo.set(prefijo, siguiente)
    const codigo = `${prefijo}-${String(siguiente).padStart(4, '0')}`

    await prisma.proyecto.update({
      where: { id: p.id },
      data: { codigo },
    })
    console.log(`  ${codigo}  ←  ${p.nombre} (${p.tipoProyecto})`)
    asignados++
  }

  console.log('')
  console.log(`✓ Backfill completado.`)
  console.log(`  Asignados: ${asignados}`)
  console.log(`  Ya tenían código: ${saltados}`)
  console.log(`  Total procesados: ${proyectos.length}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e)
    await prisma.$disconnect()
    process.exit(1)
  })
