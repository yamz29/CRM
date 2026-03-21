import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed de la base de datos...')

  // Limpiar datos existentes
  await prisma.moduloMelamina.deleteMany()
  await prisma.partida.deleteMany()
  await prisma.presupuesto.deleteMany()
  await prisma.proyecto.deleteMany()
  await prisma.cliente.deleteMany()

  // Crear clientes
  const cliente1 = await prisma.cliente.create({
    data: {
      nombre: 'Rodrigo Ignacio Fuentes Morales',
      telefono: '+56 9 8234 5678',
      whatsapp: '+56 9 8234 5678',
      correo: 'r.fuentes@gmail.com',
      direccion: 'Los Aromos 1245, Las Condes, Santiago',
      tipoCliente: 'Particular',
      fuente: 'Referido',
      notas: 'Cliente referido por la señora Patricia Soto. Interesado en remodelación completa de cocina y baños. Tiene buena disposición de pago.',
    },
  })

  const cliente2 = await prisma.cliente.create({
    data: {
      nombre: 'Inmobiliaria Los Alamos SpA',
      telefono: '+56 2 2345 6789',
      whatsapp: '+56 9 7654 3210',
      correo: 'contacto@losalamos.cl',
      direccion: 'Av. Apoquindo 4800, Piso 12, Las Condes',
      tipoCliente: 'Inmobiliaria',
      fuente: 'Web',
      notas: 'Empresa con varios proyectos en cartera. Contacto principal: Ingeniero Carlos Vera. Trabajan con pago a 30 días.',
    },
  })

  const cliente3 = await prisma.cliente.create({
    data: {
      nombre: 'Valentina Paz Contreras Ríos',
      telefono: '+56 9 6543 2109',
      whatsapp: '+56 9 6543 2109',
      correo: 'vale.contreras@outlook.com',
      direccion: 'Calle Los Pinos 456, Vitacura, Santiago',
      tipoCliente: 'Particular',
      fuente: 'Instagram',
      notas: 'Vio nuestros trabajos en Instagram. Quiere diseño de closets y vestidor para casa nueva.',
    },
  })

  const cliente4 = await prisma.cliente.create({
    data: {
      nombre: 'Arquitecta Andrea Soledad Muñoz Pizarro',
      telefono: '+56 9 5432 1098',
      whatsapp: '+56 9 5432 1098',
      correo: 'amuñoz@estudiomuñoz.cl',
      direccion: 'Av. Italia 2345, Providencia, Santiago',
      tipoCliente: 'Arquitecto',
      fuente: 'Referido',
      notas: 'Arquitecta con estudio propio. Nos deriva proyectos de sus clientes. Tiene proyectos en Ñuñoa y Providencia.',
    },
  })

  const cliente5 = await prisma.cliente.create({
    data: {
      nombre: 'Marcelo Andrés Sepúlveda González',
      telefono: '+56 9 4321 0987',
      whatsapp: '+56 9 4321 0987',
      correo: 'msepulveda@empresa.com',
      direccion: 'Camino Lo Barnechea 890, Lo Barnechea',
      tipoCliente: 'Empresa',
      fuente: 'Facebook',
      notas: 'Empresario. Quiere remodelar oficinas corporativas. Presupuesto amplio disponible.',
    },
  })

  console.log('Clientes creados:', { cliente1: cliente1.id, cliente2: cliente2.id, cliente3: cliente3.id })

  // Crear proyectos
  const proyecto1 = await prisma.proyecto.create({
    data: {
      nombre: 'Remodelación Cocina y Baños - Fuentes Morales',
      clienteId: cliente1.id,
      tipoProyecto: 'Remodelación',
      ubicacion: 'Los Aromos 1245, Las Condes',
      fechaInicio: new Date('2024-02-01'),
      fechaEstimada: new Date('2024-04-30'),
      estado: 'En Ejecución',
      descripcion: 'Remodelación completa de cocina americana, baño principal y baño de visitas. Incluye demolición de tabiques, nueva instalación sanitaria, eléctrica, revestimientos y terminaciones de alto estándar.',
      responsable: 'Juan Pérez',
      presupuestoEstimado: 18500000,
    },
  })

  const proyecto2 = await prisma.proyecto.create({
    data: {
      nombre: 'Edificio Residencial Los Álamos - Block A',
      clienteId: cliente2.id,
      tipoProyecto: 'Construcción',
      ubicacion: 'Av. Las Torres 3456, Pudahuel Norte',
      fechaInicio: new Date('2024-03-15'),
      fechaEstimada: new Date('2024-12-31'),
      estado: 'Adjudicado',
      descripcion: 'Construcción de edificio residencial de 8 pisos con 32 departamentos. Obra gruesa, terminaciones y paisajismo. Proyecto certificado en eficiencia energética.',
      responsable: 'Ing. Roberto Alvarado',
      presupuestoEstimado: 850000000,
    },
  })

  const proyecto3 = await prisma.proyecto.create({
    data: {
      nombre: 'Diseño y Fabricación Closet + Vestidor',
      clienteId: cliente3.id,
      tipoProyecto: 'Melamina',
      ubicacion: 'Los Pinos 456, Vitacura',
      fechaInicio: new Date('2024-01-20'),
      fechaEstimada: new Date('2024-02-15'),
      estado: 'En Cotización',
      descripcion: 'Diseño y fabricación de closet empotrado en dormitorio principal (3.5m de ancho) y vestidor con módulos base, aéreos y columnas. Material: Melamina Egger 18mm, colores a elección del cliente.',
      responsable: 'Cristián Torres',
      presupuestoEstimado: 4200000,
    },
  })

  console.log('Proyectos creados:', { proyecto1: proyecto1.id, proyecto2: proyecto2.id, proyecto3: proyecto3.id })

  // Crear presupuestos
  const presupuesto1 = await prisma.presupuesto.create({
    data: {
      numero: 'COT-2024-001',
      proyectoId: proyecto1.id,
      clienteId: cliente1.id,
      estado: 'Aprobado',
      notas: 'Presupuesto aprobado el 25 de enero 2024. Inicio de obras coordinado para el 1 de febrero. Se incluye garantía de 1 año en mano de obra.',
      subtotal: 17890000,
      total: 17890000,
      partidas: {
        create: [
          {
            descripcion: 'Demolición y retiro de escombros (cocina y baños)',
            unidad: 'gl',
            cantidad: 1,
            precioUnitario: 850000,
            subtotal: 850000,
            orden: 1,
          },
          {
            descripcion: 'Albañilería - Muros y tabiques nuevos',
            unidad: 'm2',
            cantidad: 45,
            precioUnitario: 65000,
            subtotal: 2925000,
            orden: 2,
          },
          {
            descripcion: 'Instalación sanitaria - Cocina (agua fría/caliente + desagüe)',
            unidad: 'gl',
            cantidad: 1,
            precioUnitario: 1250000,
            subtotal: 1250000,
            orden: 3,
          },
          {
            descripcion: 'Instalación sanitaria - Baño principal (agua fría/caliente + desagüe)',
            unidad: 'gl',
            cantidad: 1,
            precioUnitario: 980000,
            subtotal: 980000,
            orden: 4,
          },
          {
            descripcion: 'Instalación eléctrica - Cocina y baños (puntos, tablero)',
            unidad: 'gl',
            cantidad: 1,
            precioUnitario: 1450000,
            subtotal: 1450000,
            orden: 5,
          },
          {
            descripcion: 'Cerámico piso cocina 60x60cm - Porcelanato rectificado',
            unidad: 'm2',
            cantidad: 28,
            precioUnitario: 95000,
            subtotal: 2660000,
            orden: 6,
          },
          {
            descripcion: 'Revestimiento muro baño - Porcelanato 30x60cm',
            unidad: 'm2',
            cantidad: 32,
            precioUnitario: 85000,
            subtotal: 2720000,
            orden: 7,
          },
          {
            descripcion: 'Pintura lavable muros y cielos',
            unidad: 'm2',
            cantidad: 120,
            precioUnitario: 18000,
            subtotal: 2160000,
            orden: 8,
          },
          {
            descripcion: 'Artefactos sanitarios (WC, lavamanos, tina) - Incluye instalación',
            unidad: 'gl',
            cantidad: 1,
            precioUnitario: 2850000,
            subtotal: 2850000,
            orden: 9,
          },
          {
            descripcion: 'Gastos generales, administración y utilidad (10%)',
            unidad: 'gl',
            cantidad: 1,
            precioUnitario: 1045000,
            subtotal: 1045000,
            orden: 10,
          },
        ],
      },
    },
  })

  const presupuesto2 = await prisma.presupuesto.create({
    data: {
      numero: 'COT-2024-002',
      proyectoId: proyecto3.id,
      clienteId: cliente3.id,
      estado: 'Enviado',
      notas: 'Cotización enviada el 22 de enero 2024. Plazo de fabricación: 15 días hábiles desde aprobación. Instalación incluida.',
      subtotal: 0,
      total: 0,
      modulosMelamina: {
        create: [
          {
            tipoModulo: 'Base',
            descripcion: 'Módulo base cajones closet (3 cajones blandos)',
            ancho: 60,
            alto: 80,
            profundidad: 55,
            material: 'Melamina Egger 18mm Blanco Alpino',
            costoMaterial: 185000,
            costoManoObra: 95000,
            subtotal: 280000,
            cantidad: 3,
            orden: 1,
          },
          {
            tipoModulo: 'Aéreo',
            descripcion: 'Módulo aéreo con puerta abatible y bisagra Blum',
            ancho: 60,
            alto: 80,
            profundidad: 38,
            material: 'Melamina Egger 18mm Blanco Alpino',
            costoMaterial: 145000,
            costoManoObra: 75000,
            subtotal: 220000,
            cantidad: 4,
            orden: 2,
          },
          {
            tipoModulo: 'Columna',
            descripcion: 'Columna para ropa larga con doble barra',
            ancho: 60,
            alto: 240,
            profundidad: 55,
            material: 'Melamina Egger 18mm Blanco Alpino',
            costoMaterial: 320000,
            costoManoObra: 150000,
            subtotal: 470000,
            cantidad: 2,
            orden: 3,
          },
          {
            tipoModulo: 'Panel',
            descripcion: 'Panel lateral decorativo y tapa lateral',
            ancho: 55,
            alto: 240,
            profundidad: 1.8,
            material: 'Melamina Egger 18mm Blanco Alpino',
            costoMaterial: 65000,
            costoManoObra: 35000,
            subtotal: 100000,
            cantidad: 4,
            orden: 4,
          },
          {
            tipoModulo: 'Base',
            descripcion: 'Módulo base zapatera (inclinada, 4 niveles)',
            ancho: 80,
            alto: 80,
            profundidad: 30,
            material: 'Melamina Egger 18mm Grafito',
            costoMaterial: 145000,
            costoManoObra: 80000,
            subtotal: 225000,
            cantidad: 2,
            orden: 5,
          },
        ],
      },
    },
  })

  // Actualizar subtotales del presupuesto 2
  const modulosP2 = await prisma.moduloMelamina.findMany({
    where: { presupuestoId: presupuesto2.id },
  })
  const subtotalMelaminaP2 = modulosP2.reduce((acc, m) => acc + m.subtotal * m.cantidad, 0)
  await prisma.presupuesto.update({
    where: { id: presupuesto2.id },
    data: { subtotal: subtotalMelaminaP2, total: subtotalMelaminaP2 },
  })

  console.log('Presupuestos creados:', { presupuesto1: presupuesto1.id, presupuesto2: presupuesto2.id })
  console.log('Seed completado exitosamente!')
}

main()
  .catch((e) => {
    console.error('Error en seed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
