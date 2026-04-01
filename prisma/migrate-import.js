/**
 * migrate-import.js
 * Importa los datos del backup JSON a PostgreSQL.
 *
 * Ejecutar EN LA VPS después de:
 *   1. Instalar PostgreSQL y crear las bases de datos
 *   2. Cambiar schema.prisma a provider = "postgresql"
 *   3. Correr: DATABASE_URL="postgresql://..." npx prisma db push
 *   4. Correr: DATABASE_URL="postgresql://..." node prisma/migrate-import.js
 */

const { PrismaClient } = require('@prisma/client')
const fs = require('fs')
const path = require('path')

const prisma = new PrismaClient()
const BACKUP_DIR = path.join(__dirname, 'backup')

function load(model) {
  const file = path.join(BACKUP_DIR, `${model}.json`)
  if (!fs.existsSync(file)) return []
  const data = JSON.parse(fs.readFileSync(file, 'utf8'))
  // Convertir strings de fecha a objetos Date
  return data.map(row => {
    const out = { ...row }
    for (const [k, v] of Object.entries(out)) {
      if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(v)) {
        out[k] = new Date(v)
      }
    }
    return out
  })
}

async function insertBatch(model, data, label) {
  if (!data.length) { console.log(`  skip ${label} (vacío)`); return }
  try {
    const result = await prisma[model].createMany({ data, skipDuplicates: true })
    console.log(`  ✓ ${label}: ${result.count}/${data.length}`)
  } catch (err) {
    console.error(`  ✗ ${label}: ${err.message}`)
    // Intentar uno por uno para identificar el problema
    let ok = 0
    for (const row of data) {
      try { await prisma[model].create({ data: row }); ok++ }
      catch (e2) { console.error(`    fila id=${row.id}: ${e2.message}`) }
    }
    console.log(`    recuperados: ${ok}/${data.length}`)
  }
}

// Resetear sequences de PostgreSQL para evitar conflictos en futuros inserts
async function resetSequences() {
  const tables = [
    'Cliente', 'Proyecto', 'GastoProyecto', 'proyecto_capitulos', 'proyecto_partidas',
    'Presupuesto', 'presupuesto_titulos', 'presupuesto_indirecto_lineas',
    'CapituloPresupuesto', 'PartidaPresupuesto', 'AnalisisPartida',
    'Partida', 'material_melamina', 'material_modulo_melamina',
    'ModuloMelaminaV2', 'piezas_modulo', 'recursos_modulo', 'ModuloMelamina',
    'Tarea', 'Recurso', 'recurso_price_history', 'recurso_import_batches',
    'ApuCatalogo', 'ApuRecurso', 'Empresa', 'Vendedor', 'Categoria',
    'Usuario', 'permiso_usuario', 'Configuracion', 'registro_horas', 'UnidadGlobal',
    'kitchen_project', 'kitchen_wall', 'kitchen_module_placement',
    'Oportunidad', 'actividad_crm', 'cronograma', 'actividad_cronograma', 'avance_cronograma',
  ]
  for (const table of tables) {
    try {
      await prisma.$executeRawUnsafe(
        `SELECT setval(pg_get_serial_sequence('"${table}"', 'id'), COALESCE((SELECT MAX(id) FROM "${table}"), 1))`
      )
    } catch (_) {
      // tabla puede tener nombre diferente en postgres, ignorar
    }
  }
  console.log('  ✓ Sequences reseteadas')
}

async function main() {
  if (!fs.existsSync(BACKUP_DIR)) {
    console.error(`ERROR: No existe ${BACKUP_DIR}`)
    console.error('Ejecuta primero migrate-export.js en la instancia SQLite')
    process.exit(1)
  }

  console.log('Importando datos a PostgreSQL...\n')

  // ── Tablas sin dependencias ──────────────────────────────────────────
  await insertBatch('empresa',          load('empresa'),         'Empresa')
  await insertBatch('vendedor',         load('vendedor'),        'Vendedor')
  await insertBatch('categoria',        load('categoria'),       'Categoria')
  await insertBatch('configuracion',    load('configuracion'),   'Configuracion')
  await insertBatch('unidadGlobal',     load('unidadGlobal'),    'UnidadGlobal')
  await insertBatch('usuario',          load('usuario'),         'Usuario')

  // ── Clientes y recursos ──────────────────────────────────────────────
  await insertBatch('cliente',          load('cliente'),         'Cliente')
  await insertBatch('recursoImportBatch', load('recursoImportBatch'), 'RecursoImportBatch')
  await insertBatch('recurso',          load('recurso'),         'Recurso')
  await insertBatch('recursoPriceHistory', load('recursoPriceHistory'), 'RecursoPriceHistory')

  // ── APUs ─────────────────────────────────────────────────────────────
  await insertBatch('apuCatalogo',      load('apuCatalogo'),     'ApuCatalogo')
  await insertBatch('apuRecurso',       load('apuRecurso'),      'ApuRecurso')

  // ── Proyectos ────────────────────────────────────────────────────────
  await insertBatch('proyecto',         load('proyecto'),        'Proyecto')
  await insertBatch('proyectoCapitulo', load('proyectoCapitulo'),'ProyectoCapitulo')
  await insertBatch('proyectoPartida',  load('proyectoPartida'), 'ProyectoPartida')
  await insertBatch('gastoProyecto',    load('gastoProyecto'),   'GastoProyecto')

  // ── Pipeline ─────────────────────────────────────────────────────────
  await insertBatch('oportunidad',      load('oportunidad'),     'Oportunidad')
  await insertBatch('actividadCRM',     load('actividadCRM'),    'ActividadCRM')

  // ── Presupuestos ─────────────────────────────────────────────────────
  await insertBatch('presupuesto',      load('presupuesto'),     'Presupuesto')
  await insertBatch('presupuestoTitulo', load('presupuestoTitulo'), 'PresupuestoTitulo')
  await insertBatch('presupuestoIndirectoLinea', load('presupuestoIndirectoLinea'), 'PresupuestoIndirectoLinea')
  await insertBatch('capituloPresupuesto', load('capituloPresupuesto'), 'CapituloPresupuesto')
  await insertBatch('partidaPresupuesto', load('partidaPresupuesto'), 'PartidaPresupuesto')
  await insertBatch('analisisPartida',  load('analisisPartida'), 'AnalisisPartida')
  await insertBatch('partida',          load('partida'),         'Partida (legacy)')

  // ── Melamina ─────────────────────────────────────────────────────────
  await insertBatch('materialMelamina', load('materialMelamina'),'MaterialMelamina')
  await insertBatch('moduloMelaminaV2', load('moduloMelaminaV2'),'ModuloMelaminaV2')
  await insertBatch('piezaModulo',      load('piezaModulo'),     'PiezaModulo')
  await insertBatch('recursoModulo',    load('recursoModulo'),   'RecursoModulo')
  await insertBatch('materialModuloMelamina', load('materialModuloMelamina'), 'MaterialModuloMelamina')
  await insertBatch('moduloMelamina',   load('moduloMelamina'),  'ModuloMelamina (legacy)')

  // ── Tareas, Horas ────────────────────────────────────────────────────
  await insertBatch('tarea',            load('tarea'),           'Tarea')
  await insertBatch('registroHoras',    load('registroHoras'),   'RegistroHoras')

  // ── Cocinas ──────────────────────────────────────────────────────────
  await insertBatch('kitchenProject',   load('kitchenProject'),  'KitchenProject')
  await insertBatch('kitchenWall',      load('kitchenWall'),     'KitchenWall')
  await insertBatch('kitchenModulePlacement', load('kitchenModulePlacement'), 'KitchenModulePlacement')

  // ── Cronograma ───────────────────────────────────────────────────────
  await insertBatch('cronograma',       load('cronograma'),      'Cronograma')

  // ActividadCronograma tiene self-reference: insertar sin dependencia primero
  const actividades = load('actividadCronograma')
  const actSinDep = actividades.map(a => ({ ...a, dependenciaId: null }))
  await insertBatch('actividadCronograma', actSinDep, 'ActividadCronograma (1/2 sin dependencias)')

  // Luego actualizar dependenciaId donde existía
  const conDep = actividades.filter(a => a.dependenciaId != null)
  for (const a of conDep) {
    try {
      await prisma.actividadCronograma.update({
        where: { id: a.id },
        data: { dependenciaId: a.dependenciaId },
      })
    } catch (err) {
      console.warn(`    dependencia id=${a.id}: ${err.message}`)
    }
  }
  if (conDep.length) console.log(`  ✓ ActividadCronograma (2/2 dependencias): ${conDep.length}`)

  await insertBatch('avanceCronograma', load('avanceCronograma'),'AvanceCronograma')

  // ── Permisos ─────────────────────────────────────────────────────────
  await insertBatch('permisoUsuario',   load('permisoUsuario'),  'PermisoUsuario')

  // ── Resetear sequences ───────────────────────────────────────────────
  console.log('\nReseteando sequences...')
  await resetSequences()

  console.log('\n✓ Migración completada exitosamente')
}

main()
  .catch(err => { console.error('\nERROR:', err.message); process.exit(1) })
  .finally(() => prisma.$disconnect())
