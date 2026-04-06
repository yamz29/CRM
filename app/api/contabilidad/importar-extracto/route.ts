import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { checkPermiso } from '@/lib/permisos'

// Banco Popular TXT format:
// cuenta,DD/MM/YYYY,referencia,000monto.00,DB|CR,descripcion,codigo,extra
function parseLine(line: string) {
  const trimmed = line.trim()
  if (!trimmed) return null

  // Split by comma, but description may contain commas — use positional parsing
  // Format is fixed: 7 commas = 8 fields
  const parts = trimmed.split(',')
  if (parts.length < 7) return null

  const fechaStr = parts[1] // DD/MM/YYYY
  const referencia = parts[2].replace(/^0+/, '') || null
  const montoStr = parts[3] // 000001732.00
  const tipo = parts[4].trim() // DB or CR
  const descripcion = parts[5].trim()
  const codigo = parts[6]?.trim() || null

  // Parse date
  const [day, month, year] = fechaStr.split('/')
  if (!day || !month || !year) return null
  const fecha = new Date(`${year}-${month}-${day}`)
  if (isNaN(fecha.getTime())) return null

  // Parse amount (remove leading zeros)
  const monto = parseFloat(montoStr) || 0
  if (monto <= 0) return null

  // Map DB/CR
  const tipoMovimiento = tipo === 'CR' ? 'credito' : 'debito'

  // Clean description (remove padding spaces and trailing RD$ .00)
  const descLimpia = descripcion
    .replace(/\s{2,}/g, ' ')
    .replace(/RD\$\s*\.00\s*$/, '')
    .trim()

  return {
    fecha,
    tipo: tipoMovimiento,
    monto,
    descripcion: descLimpia,
    referencia,
    codigo,
  }
}

export async function POST(request: NextRequest) {
  const denied = await checkPermiso(request, 'contabilidad', 'editar')
  if (denied) return denied

  try {
    const formData = await request.formData()
    const file = formData.get('archivo') as File | null
    const cuentaId = formData.get('cuentaId') as string | null

    if (!file || file.size === 0) {
      return NextResponse.json({ error: 'No se proporcionó archivo' }, { status: 400 })
    }
    if (file.size > 2 * 1024 * 1024) {
      return NextResponse.json({ error: 'Archivo demasiado grande (máx 2 MB)' }, { status: 400 })
    }
    if (!cuentaId) {
      return NextResponse.json({ error: 'Seleccione una cuenta bancaria' }, { status: 400 })
    }

    const cuentaBancariaId = parseInt(cuentaId)
    const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: cuentaBancariaId } })
    if (!cuenta) {
      return NextResponse.json({ error: 'Cuenta no encontrada' }, { status: 404 })
    }

    const text = await file.text()
    const lines = text.split('\n')
    const parsed = lines.map(parseLine).filter(Boolean) as NonNullable<ReturnType<typeof parseLine>>[]

    if (parsed.length === 0) {
      return NextResponse.json({ error: 'No se encontraron movimientos válidos en el archivo' }, { status: 400 })
    }

    // Get existing movements for this account to detect duplicates
    // Check by fecha + monto + descripcion
    const fechaMin = new Date(Math.min(...parsed.map(p => p.fecha.getTime())))
    const fechaMax = new Date(Math.max(...parsed.map(p => p.fecha.getTime())))
    fechaMax.setHours(23, 59, 59)

    const existentes = await prisma.movimientoBancario.findMany({
      where: {
        cuentaBancariaId,
        fecha: { gte: fechaMin, lte: fechaMax },
      },
      select: { fecha: true, monto: true, descripcion: true, referencia: true },
    })

    // Build set for duplicate detection using referencia (unique per bank txn) + fecha + monto + descripcion
    const existSet = new Set(
      existentes.map(e => `${e.fecha.toISOString().slice(0, 10)}|${e.monto}|${e.referencia || ''}|${e.descripcion}`)
    )

    const nuevos = parsed.filter(p => {
      const key = `${p.fecha.toISOString().slice(0, 10)}|${p.monto}|${p.referencia || ''}|${p.descripcion}`
      return !existSet.has(key)
    })

    if (nuevos.length === 0) {
      return NextResponse.json({
        importados: 0,
        duplicados: parsed.length,
        total: parsed.length,
        message: 'Todos los movimientos ya existen en el sistema',
      })
    }

    // Bulk create
    await prisma.movimientoBancario.createMany({
      data: nuevos.map(m => ({
        cuentaBancariaId,
        fecha: m.fecha,
        tipo: m.tipo,
        monto: m.monto,
        descripcion: m.descripcion,
        referencia: m.referencia,
        conciliado: false,
      })),
    })

    return NextResponse.json({
      importados: nuevos.length,
      duplicados: parsed.length - nuevos.length,
      total: parsed.length,
      message: `${nuevos.length} movimientos importados correctamente`,
    })
  } catch (error: any) {
    console.error('Error importing extracto:', error)
    return NextResponse.json({ error: `Error al importar: ${error.message}` }, { status: 500 })
  }
}
