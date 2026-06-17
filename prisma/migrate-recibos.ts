// prisma/migrate-recibos.ts
// Convierte cada PagoFactura de factura tipo 'ingreso' en Recibo + Aplicación.
// Idempotente: salta pagos ya migrados (marca por observaciones).
// Ejecutar: ts-node --project tsconfig.seed.json prisma/migrate-recibos.ts
import { PrismaClient } from '@prisma/client'
import { estadoRecibo, estadoFactura, siguienteNumeroRecibo } from '../lib/recibos'

const prisma = new PrismaClient()
const MARCA = '[migrado-de-pago]'

async function main() {
  const pagos = await prisma.pagoFactura.findMany({
    where: { factura: { tipo: 'ingreso' } },
    include: { factura: { select: { clienteId: true } } },
    orderBy: { fecha: 'asc' },
  })
  console.log(`Pagos de ingreso a migrar: ${pagos.length}`)

  // Set EXACTO de pagos ya migrados (parseando los marcadores de recibos
  // existentes). NO usar `contains` por pago dentro del loop: 'pago#5' es
  // subcadena de 'pago#52', lo que provoca falsos positivos y salta pagos.
  const yaMigrados = new Set<number>()
  const recibosConMarca = await prisma.recibo.findMany({
    where: { observaciones: { contains: MARCA } },
    select: { observaciones: true },
  })
  for (const r of recibosConMarca) {
    for (const tok of r.observaciones?.match(/pago#(\d+)/g) ?? []) {
      yaMigrados.add(parseInt(tok.slice('pago#'.length), 10))
    }
  }

  const contadorAnio = new Map<number, number>()
  let creados = 0

  for (const p of pagos) {
    const obs = `${MARCA} pago#${p.id}`
    if (yaMigrados.has(p.id)) continue
    if (!p.factura.clienteId) { console.warn(`Pago ${p.id} sin clienteId — omitido`); continue }

    const anio = p.fecha.getFullYear()
    let n = contadorAnio.get(anio)
    if (n === undefined) {
      const ultimo = await prisma.recibo.findFirst({
        where: { numero: { startsWith: `REC-${anio}-` } }, orderBy: { numero: 'desc' }, select: { numero: true },
      })
      n = ultimo ? parseInt(ultimo.numero.match(/REC-\d{4}-(\d+)/)?.[1] ?? '0', 10) : 0
    }
    const numero = siguienteNumeroRecibo(`REC-${anio}-${String(n).padStart(4, '0')}`, anio)
    contadorAnio.set(anio, n + 1)

    await prisma.$transaction(async (tx) => {
      const recibo = await tx.recibo.create({
        data: {
          numero, clienteId: p.factura.clienteId!, fecha: p.fecha, monto: p.monto,
          metodoPago: p.metodoPago, cuentaBancariaId: p.cuentaBancariaId,
          referencia: p.referencia,
          observaciones: [p.observaciones, obs].filter(Boolean).join(' '),
          montoAplicado: p.monto, estado: estadoRecibo(p.monto, p.monto),
        },
      })
      await tx.aplicacionRecibo.create({ data: { reciboId: recibo.id, facturaId: p.facturaId, monto: p.monto } })
    })
    creados++
  }

  const facturas = await prisma.factura.findMany({ where: { tipo: 'ingreso' }, select: { id: true, total: true } })
  for (const f of facturas) {
    const agg = await prisma.aplicacionRecibo.aggregate({ where: { facturaId: f.id }, _sum: { monto: true } })
    const montoPagado = agg._sum.monto ?? 0
    await prisma.factura.update({ where: { id: f.id }, data: { montoPagado, estado: estadoFactura(f.total, montoPagado) } })
  }

  console.log(`Recibos creados: ${creados}. Facturas recalculadas: ${facturas.length}.`)
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => prisma.$disconnect())
