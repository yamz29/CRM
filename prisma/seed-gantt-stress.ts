/**
 * Seed de stress-test para el Gantt.
 *
 * Crea un cronograma nuevo con 150 actividades encadenadas (FS, desfase 0)
 * para validar el export a PDF con datasets grandes y el render de
 * frappe-gantt bajo carga.
 *
 * Uso: npx tsx prisma/seed-gantt-stress.ts
 *
 * Si hay un proyecto con id=1 lo vincula ahí; si no, queda sin proyecto.
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const CAPITULOS = [
  'Preliminares', 'Demolición', 'Excavación', 'Cimentación',
  'Estructura', 'Mampostería', 'Losa', 'Techo',
  'Instalaciones Eléctricas', 'Instalaciones Sanitarias',
  'Acabados', 'Pintura', 'Carpintería', 'Limpieza',
]

function addDays(d: Date, days: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + days)
  return r
}

async function main() {
  const proyecto = await prisma.proyecto.findFirst({ orderBy: { id: 'asc' } })
  const proyectoId = proyecto?.id ?? null
  console.log(`Vinculado a proyecto: ${proyecto?.nombre ?? '(ninguno)'}`)

  const cron = await prisma.cronograma.create({
    data: {
      nombre: `Stress-test 150 actividades — ${new Date().toISOString().slice(0, 10)}`,
      proyectoId,
      fechaInicio: new Date(),
      estado: 'Planificado',
      usarCalendarioLaboral: true,
      usarFeriados: false,
    },
  })
  console.log(`Cronograma creado: id=${cron.id}`)

  let cursor = new Date()
  let prevId: number | null = null
  let creado: { id: number } = { id: 0 }
  const TOTAL = 150

  for (let i = 0; i < TOTAL; i++) {
    const capitulo = CAPITULOS[Math.floor(i / (TOTAL / CAPITULOS.length))]
    const duracion = Math.floor(Math.random() * 5) + 2 // 2-6 días
    const esHito = i % 25 === 24 // un hito cada 25
    const fechaInicio = new Date(cursor)
    const fechaFin = addDays(fechaInicio, esHito ? 0 : duracion - 1)

    creado = await prisma.actividadCronograma.create({
      data: {
        cronogramaId: cron.id,
        capituloNombre: capitulo,
        nombre: esHito
          ? `Hito: Fin de ${capitulo}`
          : `${capitulo} — tarea ${i + 1}`,
        duracion: esHito ? 0 : duracion,
        fechaInicio,
        fechaFin,
        tipo: esHito ? 'hito' : 'tarea',
        dependenciaId: prevId,
        tipoDependencia: 'FS',
        desfaseDias: 0,
        orden: i,
      },
    })
    prevId = creado.id
    cursor = addDays(fechaFin, 1)
  }

  console.log(`✓ ${TOTAL} actividades creadas en cronograma ${cron.id}`)
  console.log(`  URL: /cronograma/${cron.id}`)
}

main()
  .catch(e => { console.error(e); process.exit(1) })
  .finally(() => prisma.$disconnect())
