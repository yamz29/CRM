/**
 * Seed: datos de prueba para el módulo de Control Presupuestario
 * Ejecutar: npx ts-node --compiler-options '{"module":"CommonJS"}' prisma/seed-control-pres.ts
 */
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find first project or bail
  const proyecto = await prisma.proyecto.findFirst({ orderBy: { createdAt: 'desc' } })
  if (!proyecto) { console.log('No hay proyectos. Crea uno primero.'); return }

  // Find a presupuesto with chapters for this project or any
  let presupuesto = await prisma.presupuesto.findFirst({
    where: { proyectoId: proyecto.id },
    include: { capitulos: { include: { partidas: true } } },
  })

  if (!presupuesto || presupuesto.capitulos.length === 0) {
    presupuesto = await prisma.presupuesto.findFirst({
      include: { capitulos: { include: { partidas: true } } },
      where: { capitulos: { some: { partidas: { some: {} } } } },
    })
  }

  if (!presupuesto || presupuesto.capitulos.length === 0) {
    console.log('No se encontró presupuesto con capítulos. Crea uno con capítulos y partidas primero.')
    return
  }

  console.log(`Usando presupuesto ${presupuesto.numero} y proyecto ${proyecto.nombre} (id=${proyecto.id})`)

  // Clear existing capitulos for this project
  await prisma.proyectoCapitulo.deleteMany({ where: { proyectoId: proyecto.id } })

  // Copy chapters and partidas
  for (const cap of presupuesto.capitulos) {
    const nuevoCap = await prisma.proyectoCapitulo.create({
      data: {
        proyectoId: proyecto.id,
        nombre: cap.nombre,
        orden: cap.orden,
      },
    })
    for (const p of cap.partidas) {
      await prisma.proyectoPartida.create({
        data: {
          proyectoId: proyecto.id,
          capituloId: nuevoCap.id,
          capituloNombre: cap.nombre,
          presupuestoOrigenId: presupuesto!.id,
          codigo: p.codigo,
          descripcion: p.descripcion,
          unidad: p.unidad,
          cantidad: p.cantidad,
          precioUnitario: p.precioUnitario,
          subtotalPresupuestado: p.subtotal,
          orden: p.orden,
        },
      })
    }
  }

  await prisma.proyecto.update({
    where: { id: proyecto.id },
    data: { presupuestoBaseId: presupuesto.id, presupuestoEstimado: presupuesto.total },
  })

  // Get first partidas for linking gastos
  const partidas = await prisma.proyectoPartida.findMany({ where: { proyectoId: proyecto.id }, take: 5 })

  // Create sample gastos linked to partidas
  const hoy = new Date()
  const sampleGastos = [
    { desc: 'Compra de cemento Portland 50 sacos', monto: 12500, tipo: 'Compra de materiales', suplidor: 'Ferretería El Centro', cat: 'Materiales', subcat: 'Cemento', partidaIdx: 0 },
    { desc: 'Pago de transporte de materiales', monto: 3200, tipo: 'Transporte', suplidor: 'Transporte Rápido SRL', cat: 'Logística', subcat: 'Flete', partidaIdx: 1 },
    { desc: 'Factura melamina Egger 18mm', monto: 45000, tipo: 'Factura', suplidor: 'Melamina Dominicana', cat: 'Materiales', subcat: 'Melamina', partidaIdx: 2 },
    { desc: 'Transferencia a instalador de cocina', monto: 18000, tipo: 'Transferencia', suplidor: 'Juan Pérez Instalaciones', cat: 'Mano de obra', subcat: 'Instalación', partidaIdx: 3 },
    { desc: 'Gasto menor ferretería - tornillos y silicón', monto: 1850, tipo: 'Gasto menor', suplidor: 'Ferremax', cat: 'Materiales', subcat: 'Herrajes', partidaIdx: 4 },
    { desc: 'Subcontrato pintura interior', monto: 22000, tipo: 'Subcontrato', suplidor: 'Pinturas Express', cat: 'Acabados', subcat: 'Pintura', partidaIdx: 0 },
    { desc: 'Caja chica - varios gastos menores semana', monto: 4500, tipo: 'Caja chica', suplidor: null, cat: 'Generales', subcat: null, partidaIdx: null },
  ]

  for (const g of sampleGastos) {
    const fecha = new Date(hoy)
    fecha.setDate(hoy.getDate() - Math.floor(Math.random() * 30))
    const partidaId = g.partidaIdx !== null && partidas[g.partidaIdx] ? partidas[g.partidaIdx].id : null
    await prisma.gastoProyecto.create({
      data: {
        proyectoId: proyecto.id,
        fecha,
        tipoGasto: g.tipo,
        descripcion: g.desc,
        suplidor: g.suplidor,
        categoria: g.cat,
        subcategoria: g.subcat,
        monto: g.monto,
        moneda: 'RD$',
        metodoPago: ['Efectivo', 'Transferencia', 'Cheque'][Math.floor(Math.random() * 3)],
        estado: 'Registrado',
        partidaId,
      },
    })
  }

  const caps = await prisma.proyectoCapitulo.count({ where: { proyectoId: proyecto.id } })
  const parts = await prisma.proyectoPartida.count({ where: { proyectoId: proyecto.id } })
  const gastos = await prisma.gastoProyecto.count({ where: { proyectoId: proyecto.id } })
  console.log(`✓ Proyecto "${proyecto.nombre}" poblado: ${caps} capítulos, ${parts} partidas, ${gastos} gastos`)
}

main().catch(console.error).finally(() => prisma.$disconnect())
