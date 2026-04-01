/**
 * migrate-export.js
 * Exporta todos los datos de SQLite a archivos JSON en prisma/backup/
 *
 * Ejecutar EN LA VPS antes de cambiar a PostgreSQL:
 *   DATABASE_URL="file:/var/www/crm/prisma/data/prod.db" node prisma/migrate-export.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const BACKUP_DIR = path.join(__dirname, 'backup')

async function main() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true })

  const models = [
    'empresa', 'vendedor', 'categoria', 'configuracion', 'unidadGlobal',
    'usuario',
    'cliente',
    'recurso', 'recursoPriceHistory', 'recursoImportBatch',
    'apuCatalogo', 'apuRecurso',
    'proyecto',
    'proyectoCapitulo', 'proyectoPartida',
    'gastoProyecto',
    'oportunidad', 'actividadCRM',
    'presupuesto',
    'presupuestoTitulo', 'presupuestoIndirectoLinea',
    'capituloPresupuesto', 'partidaPresupuesto', 'analisisPartida',
    'partida',
    'materialMelamina',
    'moduloMelaminaV2', 'piezaModulo', 'recursoModulo', 'materialModuloMelamina',
    'moduloMelamina',
    'tarea',
    'registroHoras',
    'kitchenProject', 'kitchenWall', 'kitchenModulePlacement',
    'cronograma', 'actividadCronograma', 'avanceCronograma',
    'permisoUsuario',
  ]

  let total = 0
  for (const model of models) {
    try {
      const data = await prisma[model].findMany()
      const file = path.join(BACKUP_DIR, `${model}.json`)
      fs.writeFileSync(file, JSON.stringify(data, null, 2))
      console.log(`✓ ${model}: ${data.length} registros`)
      total += data.length
    } catch (err) {
      console.warn(`⚠  ${model}: ${err.message}`)
      fs.writeFileSync(path.join(BACKUP_DIR, `${model}.json`), '[]')
    }
  }

  console.log(`\n✓ Exportación completa — ${total} registros totales`)
  console.log(`  Archivos en: ${BACKUP_DIR}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
