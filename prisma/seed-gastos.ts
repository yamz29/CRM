import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  // Find first project that exists
  const proyecto = await prisma.proyecto.findFirst({ orderBy: { id: 'asc' } })
  if (!proyecto) {
    console.log('No hay proyectos. Crea un proyecto primero.')
    return
  }

  console.log(`Insertando gastos de prueba en proyecto: "${proyecto.nombre}" (id=${proyecto.id})`)

  await prisma.gastoProyecto.createMany({
    data: [
      {
        proyectoId: proyecto.id,
        fecha: new Date('2026-03-01'),
        tipoGasto: 'Compra de materiales',
        referencia: 'FAC-2026-001',
        descripcion: 'Compra de cemento Portland — 50 sacos',
        suplidor: 'Ferretería El Toro',
        categoria: 'Materiales',
        subcategoria: 'Cemento',
        monto: 12500.00,
        moneda: 'RD$',
        metodoPago: 'Transferencia',
        cuentaOrigen: 'Cuenta Principal BHD',
        observaciones: 'Precio incluye descuento por volumen',
        estado: 'Revisado',
      },
      {
        proyectoId: proyecto.id,
        fecha: new Date('2026-03-05'),
        tipoGasto: 'Transporte',
        referencia: 'REC-0042',
        descripcion: 'Pago de transporte — flete de materiales desde almacén central',
        suplidor: 'Transporte Rápido SRL',
        categoria: 'Logística',
        subcategoria: 'Flete',
        monto: 3500.00,
        moneda: 'RD$',
        metodoPago: 'Efectivo',
        observaciones: null,
        estado: 'Registrado',
      },
      {
        proyectoId: proyecto.id,
        fecha: new Date('2026-03-08'),
        tipoGasto: 'Factura',
        referencia: 'FAC-2026-018',
        descripcion: 'Factura de melamina Egger 18mm — 30 láminas',
        suplidor: 'Melaminas del Caribe',
        categoria: 'Materiales',
        subcategoria: 'Melamina',
        monto: 45000.00,
        moneda: 'RD$',
        metodoPago: 'Cheque',
        cuentaOrigen: 'Cuenta Obras BHD',
        observaciones: 'Color blanco roto y wengué',
        estado: 'Revisado',
      },
      {
        proyectoId: proyecto.id,
        fecha: new Date('2026-03-12'),
        tipoGasto: 'Transferencia',
        referencia: 'TRF-2026-003',
        descripcion: 'Transferencia a instalador — pago semana 2',
        suplidor: 'Carlos Mendoza (Instalador)',
        categoria: 'Mano de Obra',
        subcategoria: 'Instalación',
        monto: 28000.00,
        moneda: 'RD$',
        metodoPago: 'Transferencia',
        cuentaOrigen: 'Cuenta Principal BHD',
        observaciones: 'Incluye bono de puntualidad',
        estado: 'Revisado',
      },
      {
        proyectoId: proyecto.id,
        fecha: new Date('2026-03-15'),
        tipoGasto: 'Gasto menor',
        referencia: null,
        descripcion: 'Gasto menor de ferretería — tornillos, tacos y sellador',
        suplidor: 'Ferretería La Esquina',
        categoria: 'Materiales',
        subcategoria: 'Misceláneos',
        monto: 1850.00,
        moneda: 'RD$',
        metodoPago: 'Efectivo',
        cuentaOrigen: 'Caja Chica Obra',
        observaciones: null,
        estado: 'Registrado',
      },
    ],
  })

  const total = await prisma.gastoProyecto.aggregate({
    where: { proyectoId: proyecto.id },
    _sum: { monto: true },
    _count: true,
  })

  console.log(`✓ ${total._count} gastos insertados. Total: RD$ ${total._sum.monto?.toLocaleString('en-US')}`)
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
