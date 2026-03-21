import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  console.log('Iniciando seed de catálogos...')

  // ── RECURSOS ─────────────────────────────────────────────────────────────────

  const recursos = await Promise.all([
    // Materiales — Mampostería
    prisma.recurso.create({ data: { codigo: 'REC-M001', nombre: 'Cemento Portland 25kg', tipo: 'materiales', categoria: 'Mampostería', unidad: 'saco', costoUnitario: 4500, marca: 'Melón' } }),
    prisma.recurso.create({ data: { codigo: 'REC-M002', nombre: 'Arena lavada fina', tipo: 'materiales', categoria: 'Mampostería', unidad: 'm3', costoUnitario: 18000 } }),
    prisma.recurso.create({ data: { codigo: 'REC-M003', nombre: 'Block hormigón 6"', tipo: 'materiales', categoria: 'Mampostería', unidad: 'ud', costoUnitario: 850, proveedor: 'Blockera Sur' } }),
    prisma.recurso.create({ data: { codigo: 'REC-M004', nombre: 'Block hormigón 12"', tipo: 'materiales', categoria: 'Mampostería', unidad: 'ud', costoUnitario: 1200, proveedor: 'Blockera Sur' } }),
    prisma.recurso.create({ data: { codigo: 'REC-M005', nombre: 'Agua potable', tipo: 'materiales', categoria: 'Mampostería', unidad: 'lt', costoUnitario: 5 } }),

    // Materiales — Terminaciones
    prisma.recurso.create({ data: { codigo: 'REC-M006', nombre: 'Pintura acrílica mate 1gl', tipo: 'materiales', categoria: 'Terminaciones', unidad: 'gl', costoUnitario: 15000, marca: 'Sipa' } }),
    prisma.recurso.create({ data: { codigo: 'REC-M007', nombre: 'Sellador PVA 1gl', tipo: 'materiales', categoria: 'Terminaciones', unidad: 'gl', costoUnitario: 8500 } }),
    prisma.recurso.create({ data: { codigo: 'REC-M008', nombre: 'Rodillo de pintura 23cm', tipo: 'consumibles', categoria: 'Terminaciones', unidad: 'ud', costoUnitario: 2500 } }),
    prisma.recurso.create({ data: { codigo: 'REC-M009', nombre: 'Yeso en polvo 25kg', tipo: 'materiales', categoria: 'Terminaciones', unidad: 'saco', costoUnitario: 5800 } }),

    // Materiales — Melamina
    prisma.recurso.create({ data: { codigo: 'REC-M010', nombre: 'Melamina RH 18mm Blanco', tipo: 'materiales', categoria: 'Melamina', unidad: 'pl', costoUnitario: 28000, marca: 'Egger', proveedor: 'Maderkit' } }),
    prisma.recurso.create({ data: { codigo: 'REC-M011', nombre: 'Melamina RH 15mm Blanco', tipo: 'materiales', categoria: 'Melamina', unidad: 'pl', costoUnitario: 22000, marca: 'Egger' } }),
    prisma.recurso.create({ data: { codigo: 'REC-M012', nombre: 'Melamina RH 18mm Wengué', tipo: 'materiales', categoria: 'Melamina', unidad: 'pl', costoUnitario: 32000, marca: 'Egger' } }),
    prisma.recurso.create({ data: { codigo: 'REC-M013', nombre: 'Canto melamina 18mm x 50m', tipo: 'materiales', categoria: 'Melamina', unidad: 'rollo', costoUnitario: 4500 } }),

    // Herrajes
    prisma.recurso.create({ data: { codigo: 'REC-H001', nombre: 'Bisagra a presión 35mm', tipo: 'herrajes', categoria: 'Melamina', unidad: 'ud', costoUnitario: 1200, marca: 'Grass' } }),
    prisma.recurso.create({ data: { codigo: 'REC-H002', nombre: 'Corredera telescópica 45cm', tipo: 'herrajes', categoria: 'Melamina', unidad: 'par', costoUnitario: 4500, marca: 'Blum' } }),
    prisma.recurso.create({ data: { codigo: 'REC-H003', nombre: 'Corredera telescópica 35cm', tipo: 'herrajes', categoria: 'Melamina', unidad: 'par', costoUnitario: 3800, marca: 'Blum' } }),
    prisma.recurso.create({ data: { codigo: 'REC-H004', nombre: 'Perno confirmador', tipo: 'herrajes', categoria: 'Melamina', unidad: 'ud', costoUnitario: 120 } }),
    prisma.recurso.create({ data: { codigo: 'REC-H005', nombre: 'Taco plástico 6mm', tipo: 'herrajes', categoria: 'Melamina', unidad: 'ud', costoUnitario: 80 } }),

    // Mano de Obra
    prisma.recurso.create({ data: { codigo: 'REC-MO01', nombre: 'Oficial albañil', tipo: 'manoObra', categoria: 'Albañilería', unidad: 'día', costoUnitario: 35000 } }),
    prisma.recurso.create({ data: { codigo: 'REC-MO02', nombre: 'Ayudante de albañil', tipo: 'manoObra', categoria: 'Albañilería', unidad: 'día', costoUnitario: 22000 } }),
    prisma.recurso.create({ data: { codigo: 'REC-MO03', nombre: 'Maestro pintor', tipo: 'manoObra', categoria: 'Terminaciones', unidad: 'día', costoUnitario: 32000 } }),
    prisma.recurso.create({ data: { codigo: 'REC-MO04', nombre: 'MO taller melamina', tipo: 'manoObra', categoria: 'Melamina', unidad: 'hr', costoUnitario: 6000 } }),
    prisma.recurso.create({ data: { codigo: 'REC-MO05', nombre: 'Instalador melamina', tipo: 'manoObra', categoria: 'Melamina', unidad: 'hr', costoUnitario: 7500 } }),
    prisma.recurso.create({ data: { codigo: 'REC-MO06', nombre: 'Maestro eléctrico', tipo: 'manoObra', categoria: 'Eléctricas', unidad: 'día', costoUnitario: 45000 } }),

    // Transportes
    prisma.recurso.create({ data: { codigo: 'REC-T001', nombre: 'Flete materiales áridos', tipo: 'transportes', categoria: 'General', unidad: 'viaje', costoUnitario: 25000 } }),
    prisma.recurso.create({ data: { codigo: 'REC-T002', nombre: 'Flete módulos melamina', tipo: 'transportes', categoria: 'Melamina', unidad: 'viaje', costoUnitario: 35000 } }),
  ])

  console.log(`${recursos.length} recursos creados.`)

  // Mapear recursos por código
  const r = Object.fromEntries(recursos.map((rec) => [rec.codigo!, rec]))

  // ── APUs ──────────────────────────────────────────────────────────────────────

  // ── APU 1: Levantado muro block 6" (m2) ──
  const apu1 = await prisma.apuCatalogo.create({
    data: {
      codigo: 'APU-ALB-001',
      nombre: 'Levantado muro block 6"',
      descripcion: 'Levantado de muro de block de hormigón de 6", con mortero de cemento-arena 1:4',
      capitulo: 'Albañilería',
      unidad: 'm2',
      indirectos: 10,
      utilidad: 20,
      desperdicio: 5,
      recursos: {
        create: [
          { recursoId: r['REC-M001'].id, cantidad: 0.12, costoSnapshot: r['REC-M001'].costoUnitario, subtotal: 0.12 * r['REC-M001'].costoUnitario, orden: 0 },
          { recursoId: r['REC-M002'].id, cantidad: 0.04, costoSnapshot: r['REC-M002'].costoUnitario, subtotal: 0.04 * r['REC-M002'].costoUnitario, orden: 1 },
          { recursoId: r['REC-M003'].id, cantidad: 12.5, costoSnapshot: r['REC-M003'].costoUnitario, subtotal: 12.5 * r['REC-M003'].costoUnitario, orden: 2 },
          { recursoId: r['REC-M005'].id, cantidad: 15, costoSnapshot: r['REC-M005'].costoUnitario, subtotal: 15 * r['REC-M005'].costoUnitario, orden: 3 },
          { recursoId: r['REC-MO01'].id, cantidad: 0.12, costoSnapshot: r['REC-MO01'].costoUnitario, subtotal: 0.12 * r['REC-MO01'].costoUnitario, orden: 4 },
          { recursoId: r['REC-MO02'].id, cantidad: 0.12, costoSnapshot: r['REC-MO02'].costoUnitario, subtotal: 0.12 * r['REC-MO02'].costoUnitario, orden: 5 },
        ],
      },
    },
  })
  const costoD1 = 0.12*4500 + 0.04*18000 + 12.5*850 + 15*5 + 0.12*35000 + 0.12*22000
  await prisma.apuCatalogo.update({ where: { id: apu1.id }, data: { costoDirecto: costoD1, costoTotal: costoD1*1.10, precioVenta: costoD1*1.10*1.20 } })

  // ── APU 2: Pañete liso muro (m2) ──
  const costoD2 = 0.2*4500 + 0.05*18000 + 0.1*35000 + 0.05*22000
  await prisma.apuCatalogo.create({
    data: {
      codigo: 'APU-ALB-002',
      nombre: 'Pañete liso muro interior',
      descripcion: 'Estuco liso fino en muro interior, espesor 15mm, mortero cemento-arena 1:5',
      capitulo: 'Albañilería',
      unidad: 'm2',
      indirectos: 10,
      utilidad: 20,
      desperdicio: 5,
      costoDirecto: costoD2,
      costoTotal: costoD2 * 1.10,
      precioVenta: costoD2 * 1.10 * 1.20,
      recursos: {
        create: [
          { recursoId: r['REC-M001'].id, cantidad: 0.2,  costoSnapshot: r['REC-M001'].costoUnitario, subtotal: 0.2*r['REC-M001'].costoUnitario,  orden: 0 },
          { recursoId: r['REC-M002'].id, cantidad: 0.05, costoSnapshot: r['REC-M002'].costoUnitario, subtotal: 0.05*r['REC-M002'].costoUnitario, orden: 1 },
          { recursoId: r['REC-MO01'].id, cantidad: 0.1,  costoSnapshot: r['REC-MO01'].costoUnitario, subtotal: 0.1*r['REC-MO01'].costoUnitario,  orden: 2 },
          { recursoId: r['REC-MO02'].id, cantidad: 0.05, costoSnapshot: r['REC-MO02'].costoUnitario, subtotal: 0.05*r['REC-MO02'].costoUnitario, orden: 3 },
        ],
      },
    },
  })

  // ── APU 3: Pintura acrílica 2 manos (m2) ──
  const costoD3 = 0.15*15000 + 0.05*8500 + 0.1*32000
  await prisma.apuCatalogo.create({
    data: {
      codigo: 'APU-PIN-001',
      nombre: 'Pintura acrílica 2 manos',
      descripcion: 'Pintura acrílica latex interior 2 manos, con sellador previo',
      capitulo: 'Pintura',
      unidad: 'm2',
      indirectos: 10,
      utilidad: 20,
      desperdicio: 5,
      costoDirecto: costoD3,
      costoTotal: costoD3 * 1.10,
      precioVenta: costoD3 * 1.10 * 1.20,
      recursos: {
        create: [
          { recursoId: r['REC-M006'].id, cantidad: 0.15, costoSnapshot: r['REC-M006'].costoUnitario, subtotal: 0.15*r['REC-M006'].costoUnitario, orden: 0 },
          { recursoId: r['REC-M007'].id, cantidad: 0.05, costoSnapshot: r['REC-M007'].costoUnitario, subtotal: 0.05*r['REC-M007'].costoUnitario, orden: 1 },
          { recursoId: r['REC-M008'].id, cantidad: 0.02, costoSnapshot: r['REC-M008'].costoUnitario, subtotal: 0.02*r['REC-M008'].costoUnitario, orden: 2 },
          { recursoId: r['REC-MO03'].id, cantidad: 0.1,  costoSnapshot: r['REC-MO03'].costoUnitario, subtotal: 0.1*r['REC-MO03'].costoUnitario,  orden: 3 },
        ],
      },
    },
  })

  // ── APU 4: Módulo base melamina 60×90×58cm (ud) ──
  const costoD4 = 2*28000 + 4*1200 + 1*4500 + 16*120 + 4*6000 + 1*7500
  await prisma.apuCatalogo.create({
    data: {
      codigo: 'APU-MEL-001',
      nombre: 'Módulo base melamina 60×90×58cm',
      descripcion: 'Módulo base cocina/baño 60cm ancho x 90cm alto x 58cm prof., melamina blanca 18mm con bisagras y correderas',
      capitulo: 'Melamina',
      unidad: 'ud',
      indirectos: 8,
      utilidad: 25,
      desperdicio: 3,
      costoDirecto: costoD4,
      costoTotal: costoD4 * 1.08,
      precioVenta: costoD4 * 1.08 * 1.25,
      recursos: {
        create: [
          { recursoId: r['REC-M010'].id, cantidad: 2,  costoSnapshot: r['REC-M010'].costoUnitario, subtotal: 2*r['REC-M010'].costoUnitario,  orden: 0 },
          { recursoId: r['REC-H001'].id, cantidad: 4,  costoSnapshot: r['REC-H001'].costoUnitario, subtotal: 4*r['REC-H001'].costoUnitario,  orden: 1 },
          { recursoId: r['REC-H002'].id, cantidad: 1,  costoSnapshot: r['REC-H002'].costoUnitario, subtotal: 1*r['REC-H002'].costoUnitario,  orden: 2 },
          { recursoId: r['REC-H004'].id, cantidad: 16, costoSnapshot: r['REC-H004'].costoUnitario, subtotal: 16*r['REC-H004'].costoUnitario, orden: 3 },
          { recursoId: r['REC-MO04'].id, cantidad: 4,  costoSnapshot: r['REC-MO04'].costoUnitario, subtotal: 4*r['REC-MO04'].costoUnitario,  orden: 4 },
          { recursoId: r['REC-MO05'].id, cantidad: 1,  costoSnapshot: r['REC-MO05'].costoUnitario, subtotal: 1*r['REC-MO05'].costoUnitario,  orden: 5 },
        ],
      },
    },
  })

  // ── APU 5: Módulo aéreo melamina 60×35×30cm (ud) ──
  const costoD5 = 1*28000 + 4*1200 + 8*120 + 2*6000 + 0.5*7500
  await prisma.apuCatalogo.create({
    data: {
      codigo: 'APU-MEL-002',
      nombre: 'Módulo aéreo melamina 60×35×30cm',
      descripcion: 'Módulo aéreo 60cm ancho x 35cm alto x 30cm prof., melamina blanca 18mm con bisagras',
      capitulo: 'Melamina',
      unidad: 'ud',
      indirectos: 8,
      utilidad: 25,
      desperdicio: 3,
      costoDirecto: costoD5,
      costoTotal: costoD5 * 1.08,
      precioVenta: costoD5 * 1.08 * 1.25,
      recursos: {
        create: [
          { recursoId: r['REC-M010'].id, cantidad: 1,   costoSnapshot: r['REC-M010'].costoUnitario, subtotal: 1*r['REC-M010'].costoUnitario,   orden: 0 },
          { recursoId: r['REC-H001'].id, cantidad: 4,   costoSnapshot: r['REC-H001'].costoUnitario, subtotal: 4*r['REC-H001'].costoUnitario,   orden: 1 },
          { recursoId: r['REC-H004'].id, cantidad: 8,   costoSnapshot: r['REC-H004'].costoUnitario, subtotal: 8*r['REC-H004'].costoUnitario,   orden: 2 },
          { recursoId: r['REC-MO04'].id, cantidad: 2,   costoSnapshot: r['REC-MO04'].costoUnitario, subtotal: 2*r['REC-MO04'].costoUnitario,   orden: 3 },
          { recursoId: r['REC-MO05'].id, cantidad: 0.5, costoSnapshot: r['REC-MO05'].costoUnitario, subtotal: 0.5*r['REC-MO05'].costoUnitario, orden: 4 },
        ],
      },
    },
  })

  console.log('5 APUs creados con recursos.')
  console.log('\nSeed de catálogos completado exitosamente.')
  console.log(`  - ${recursos.length} recursos`)
  console.log('  - 5 APUs (Albañilería, Pintura, Melamina)')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
