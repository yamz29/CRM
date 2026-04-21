/**
 * Importa la base DGII_RNC de contribuyentes a la tabla rnc_dgii.
 *
 * Fuente oficial DGII:
 *   https://dgii.gov.do/app/WebApps/Consultas/RNC/DGII_RNC.zip
 *
 * Formato (pipe-delimited, Windows-1252 / Latin-1):
 *   RNC | NOMBRE | NOMBRE_COMERCIAL | ACTIVIDAD | _ | _ | _ | _ | FECHA_INICIO | ESTADO | REGIMEN
 *
 * Uso local:
 *   npx tsx scripts/import-dgii-rnc.ts /ruta/a/DGII_RNC.TXT
 *
 * Uso en el VPS:
 *   # 1. Descargar y descomprimir
 *   cd /tmp && wget https://dgii.gov.do/app/WebApps/Consultas/RNC/DGII_RNC.zip
 *   unzip -o DGII_RNC.zip
 *   # 2. Importar (usa DATABASE_URL_PROD del .env.server)
 *   cd /var/www/crm
 *   source .env.server
 *   DATABASE_URL="$DATABASE_URL_PROD" npx tsx scripts/import-dgii-rnc.ts /tmp/TMP/DGII_RNC.TXT
 *   # 3. Limpiar
 *   rm -rf /tmp/TMP /tmp/DGII_RNC.zip
 *
 * El script es idempotente: hace TRUNCATE + bulk insert. Correr de nuevo
 * cuando la DGII publique una versión nueva (mensual típicamente).
 *
 * Tiempo estimado: ~2-4 min en Postgres con SSD para 770k filas.
 */

import { PrismaClient } from '@prisma/client'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { statSync } from 'fs'
import { resolve } from 'path'

const BATCH = 5000

function parseLine(line: string) {
  // Formato: RNC|NOMBRE|NOMBRE_COMERCIAL|ACTIVIDAD|_|_|_|_|FECHA|ESTADO|REGIMEN
  const parts = line.split('|')
  if (parts.length < 11) return null

  const rnc = parts[0]?.trim()
  if (!rnc || !/^\d{9,11}$/.test(rnc)) return null // RNC inválido

  const nombre = parts[1]?.trim()
  if (!nombre) return null

  const nombreComercial = parts[2]?.trim() || null
  const actividad = parts[3]?.trim() || null
  const fechaRaw = parts[8]?.trim() || ''
  const estado = parts[9]?.trim() || null
  const regimen = parts[10]?.replace(/[\r\n]+/g, '').trim() || null

  let fechaInicio: Date | null = null
  if (fechaRaw) {
    // Formato DGII: DD/MM/YYYY
    const m = fechaRaw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
    if (m) {
      fechaInicio = new Date(`${m[3]}-${m[2]}-${m[1]}T00:00:00Z`)
      if (isNaN(fechaInicio.getTime())) fechaInicio = null
    }
  }

  return {
    rnc,
    nombre: nombre.slice(0, 500),
    nombreComercial: nombreComercial ? nombreComercial.slice(0, 500) : null,
    actividad: actividad ? actividad.slice(0, 500) : null,
    estado,
    regimen,
    fechaInicio,
  }
}

async function main() {
  const filePath = process.argv[2]
  if (!filePath) {
    console.error('Uso: npx tsx scripts/import-dgii-rnc.ts <ruta a DGII_RNC.TXT>')
    process.exit(1)
  }

  const abs = resolve(filePath)
  let size: number
  try {
    size = statSync(abs).size
  } catch {
    console.error(`No se pudo leer el archivo: ${abs}`)
    process.exit(1)
  }
  console.log(`Archivo: ${abs}`)
  console.log(`Tamaño: ${(size / 1024 / 1024).toFixed(1)} MB`)

  const prisma = new PrismaClient()

  // Paso 1: truncar tabla (mucho más rápido que upsert por fila)
  console.log('Limpiando tabla rnc_dgii…')
  await prisma.$executeRawUnsafe('TRUNCATE TABLE rnc_dgii')

  // Paso 2: leer archivo en streaming, parsear, insertar en batches
  // Latin-1 preserva bien caracteres españoles del archivo DGII.
  const stream = createReadStream(abs, { encoding: 'latin1' })
  const rl = createInterface({ input: stream, crlfDelay: Infinity })

  let batch: ReturnType<typeof parseLine>[] = []
  let totalInserted = 0
  let skipped = 0
  const t0 = Date.now()

  async function flush() {
    const valid = batch.filter((r): r is NonNullable<typeof r> => r !== null)
    if (valid.length > 0) {
      try {
        const res = await prisma.rncDgii.createMany({
          data: valid,
          skipDuplicates: true, // por seguridad (si el archivo trae duplicados)
        })
        totalInserted += res.count
      } catch (e) {
        console.error(`\nError insertando batch (${valid.length} filas):`, e instanceof Error ? e.message : e)
      }
    }
    batch = []
  }

  for await (const line of rl) {
    const row = parseLine(line)
    if (!row) { skipped++; continue }
    batch.push(row)
    if (batch.length >= BATCH) {
      await flush()
      if (totalInserted % 50000 < BATCH) {
        const elapsed = (Date.now() - t0) / 1000
        const rate = Math.round(totalInserted / elapsed)
        process.stdout.write(`\r  ${totalInserted.toLocaleString()} filas insertadas (${rate.toLocaleString()}/s, ${skipped} saltadas)…`)
      }
    }
  }
  await flush()

  const elapsed = ((Date.now() - t0) / 1000).toFixed(1)
  console.log('')
  console.log(`✓ Import completado`)
  console.log(`  Insertadas: ${totalInserted.toLocaleString()}`)
  console.log(`  Saltadas (inválidas): ${skipped.toLocaleString()}`)
  console.log(`  Tiempo: ${elapsed}s`)

  await prisma.$disconnect()
}

main().catch(async (e) => {
  console.error(e)
  process.exit(1)
})
