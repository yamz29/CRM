import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed V2...')

  // Get existing clientes and proyectos
  const clientes = await prisma.cliente.findMany({ orderBy: { id: 'asc' } })
  const proyectos = await prisma.proyecto.findMany({ orderBy: { id: 'asc' } })

  if (clientes.length === 0) {
    console.error('No hay clientes en la base de datos. Ejecuta primero: npm run db:seed')
    process.exit(1)
  }

  const cliente1 = clientes[0]
  const cliente2 = clientes[1] || clientes[0]
  const cliente3 = clientes[2] || clientes[0]
  const cliente5 = clientes[4] || clientes[0]

  const proyecto1 = proyectos[0] || null
  const proyecto2 = proyectos[1] || null
  const proyecto3 = proyectos[2] || null

  // Clean existing V2 data
  await prisma.analisisPartida.deleteMany()
  await prisma.partidaPresupuesto.deleteMany()
  await prisma.capituloPresupuesto.deleteMany()
  await prisma.moduloMelaminaV2.deleteMany()
  await prisma.tarea.deleteMany()

  console.log('Creando presupuesto V2 con capítulos...')

  // Create V2 presupuesto
  const presupuestoV2 = await prisma.presupuesto.create({
    data: {
      numero: 'COT-2026-010',
      clienteId: cliente1.id,
      proyectoId: proyecto1?.id || null,
      estado: 'Enviado',
      notas: 'Presupuesto detallado con análisis de precios. Incluye todos los trabajos de remodelación.',
      total: 24750000,
      subtotal: 24750000,
      capitulos: {
        create: [
          {
            codigo: '01',
            nombre: 'Preliminares',
            orden: 0,
            partidas: {
              create: [
                {
                  codigo: '01.01',
                  descripcion: 'Instalación de faenas y bodega',
                  unidad: 'gl',
                  cantidad: 1,
                  precioUnitario: 850000,
                  subtotal: 850000,
                  orden: 0,
                },
                {
                  codigo: '01.02',
                  descripcion: 'Limpieza y habilitación del terreno',
                  unidad: 'gl',
                  cantidad: 1,
                  precioUnitario: 350000,
                  subtotal: 350000,
                  orden: 1,
                },
              ],
            },
          },
          {
            codigo: '02',
            nombre: 'Demoliciones',
            orden: 1,
            partidas: {
              create: [
                {
                  codigo: '02.01',
                  descripcion: 'Demolición muros tabiques interiores',
                  unidad: 'm2',
                  cantidad: 45,
                  precioUnitario: 35000,
                  subtotal: 1575000,
                  orden: 0,
                },
              ],
            },
          },
          {
            codigo: '03',
            nombre: 'Albañilería',
            orden: 2,
            partidas: {
              create: [
                {
                  codigo: '03.01',
                  descripcion: 'Muros de ladrillo 15cm doble hilada',
                  unidad: 'm2',
                  cantidad: 68,
                  precioUnitario: 85000,
                  subtotal: 5780000,
                  orden: 0,
                },
                {
                  codigo: '03.02',
                  descripcion: 'Tabique metalcon 70mm + placa yeso',
                  unidad: 'm2',
                  cantidad: 32,
                  precioUnitario: 65000,
                  subtotal: 2080000,
                  orden: 1,
                },
              ],
            },
          },
          {
            codigo: '07',
            nombre: 'Terminaciones',
            orden: 3,
            partidas: {
              create: [
                {
                  codigo: '07.01',
                  descripcion: 'Porcelanato piso 60x60 rectificado',
                  unidad: 'm2',
                  cantidad: 85,
                  precioUnitario: 95000,
                  subtotal: 8075000,
                  orden: 0,
                },
                {
                  codigo: '07.02',
                  descripcion: 'Revestimiento cerámico muro baño',
                  unidad: 'm2',
                  cantidad: 48,
                  precioUnitario: 75000,
                  subtotal: 3600000,
                  orden: 1,
                },
              ],
            },
          },
          {
            codigo: '09',
            nombre: 'Melamina / Ebanistería',
            orden: 4,
            partidas: {
              create: [
                {
                  codigo: '09.01',
                  descripcion: 'Muebles cocina empotrados (módulos base + aéreos)',
                  unidad: 'gl',
                  cantidad: 1,
                  precioUnitario: 2440000,
                  subtotal: 2440000,
                  orden: 0,
                },
              ],
            },
          },
        ],
      },
    },
  })

  console.log(`Presupuesto V2 creado: ${presupuestoV2.numero} (ID: ${presupuestoV2.id})`)

  console.log('Creando módulos de melamina V2...')

  await prisma.moduloMelaminaV2.createMany({
    data: [
      {
        proyectoId: proyecto1?.id || null,
        codigo: 'MOD-001',
        tipoModulo: 'Base',
        nombre: 'Módulo base cajones (3 cajones suaves)',
        ancho: 60,
        alto: 80,
        profundidad: 55,
        material: 'Melamina Egger 18mm Blanco Alpino',
        colorAcabado: 'Blanco Alpino',
        herrajes: 'Bisagra Blum + correderas telescópicas',
        cantidad: 4,
        costoMateriales: 185000,
        costoManoObra: 95000,
        costoInstalacion: 25000,
        precioVenta: 380000,
        estadoProduccion: 'En armado',
      },
      {
        proyectoId: proyecto1?.id || null,
        codigo: 'MOD-002',
        tipoModulo: 'Aéreo',
        nombre: 'Módulo aéreo puerta rebatible',
        ancho: 60,
        alto: 72,
        profundidad: 35,
        material: 'Melamina Egger 18mm Blanco Alpino',
        colorAcabado: 'Blanco Alpino',
        herrajes: 'Bisagra Blum aventos HF',
        cantidad: 6,
        costoMateriales: 145000,
        costoManoObra: 75000,
        costoInstalacion: 20000,
        precioVenta: 295000,
        estadoProduccion: 'En corte',
      },
      {
        proyectoId: proyecto3?.id || null,
        codigo: 'MOD-003',
        tipoModulo: 'Columna',
        nombre: 'Columna vestidor ropa larga',
        ancho: 60,
        alto: 240,
        profundidad: 55,
        material: 'Melamina Egger 18mm Grafito',
        colorAcabado: 'Grafito',
        herrajes: 'Barra ropa cromo + estantes regulables',
        cantidad: 2,
        costoMateriales: 320000,
        costoManoObra: 150000,
        costoInstalacion: 40000,
        precioVenta: 680000,
        estadoProduccion: 'Diseño',
      },
    ],
  })

  console.log('Módulos de melamina V2 creados.')

  console.log('Creando tareas...')

  await prisma.tarea.createMany({
    data: [
      {
        titulo: 'Enviar presupuesto actualizado a Fuentes Morales',
        descripcion: `Revisar y enviar la cotización ${presupuestoV2.numero} por correo`,
        clienteId: cliente1.id,
        proyectoId: proyecto1?.id || null,
        fechaLimite: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
        prioridad: 'Alta',
        estado: 'Pendiente',
        responsable: 'Juan Pérez',
      },
      {
        titulo: 'Visita a terreno Los Álamos Block A',
        descripcion: 'Inspección de avance de obra',
        clienteId: cliente2.id,
        proyectoId: proyecto2?.id || null,
        fechaLimite: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
        prioridad: 'Media',
        estado: 'Pendiente',
        responsable: 'Ing. Roberto Alvarado',
      },
      {
        titulo: 'Confirmar materiales melamina Contreras',
        descripcion: 'Llamar a Valentina para confirmar color y material definitivo del closet',
        clienteId: cliente3.id,
        proyectoId: proyecto3?.id || null,
        fechaLimite: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000),
        prioridad: 'Alta',
        estado: 'Pendiente',
        responsable: 'Cristián Torres',
      },
      {
        titulo: 'Seguimiento cotización Sepúlveda oficinas',
        descripcion: 'Contactar a Marcelo Sepúlveda para saber si aprobó el presupuesto',
        clienteId: cliente5.id,
        fechaLimite: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000),
        prioridad: 'Alta',
        estado: 'En proceso',
        responsable: 'Juan Pérez',
      },
      {
        titulo: 'Pagar factura proveedor melamina',
        descripcion: 'Factura pendiente con Masisa',
        fechaLimite: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        prioridad: 'Media',
        estado: 'Pendiente',
        responsable: 'Administración',
      },
    ],
  })

  console.log('Tareas creadas.')
  console.log('\nSeed V2 completado exitosamente.')
  console.log(`  - 1 presupuesto V2 con ${5} capítulos`)
  console.log(`  - 3 módulos de melamina V2`)
  console.log(`  - 5 tareas`)
}

main()
  .catch((e) => {
    console.error('Error en seed V2:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
