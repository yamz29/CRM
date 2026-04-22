import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { feriadosDominicanos } from '@/lib/calendario-laboral'

// POST /api/configuracion/feriados/seed-oficiales
// Body: { years?: number[] } — default: año actual + 2 siguientes
// Carga los feriados oficiales dominicanos. Idempotente (salta si ya existe).
export const POST = withPermiso('configuracion', 'admin', async (request: NextRequest) => {
  try {
    const body = await request.json().catch(() => ({}))
    const currentYear = new Date().getUTCFullYear()
    const years: number[] = Array.isArray(body.years) && body.years.length > 0
      ? body.years.map((y: unknown) => parseInt(String(y))).filter((y: number) => !isNaN(y))
      : [currentYear, currentYear + 1, currentYear + 2]

    let creados = 0
    let existentes = 0

    for (const year of years) {
      const feriados = feriadosDominicanos(year)
      for (const f of feriados) {
        const existe = await prisma.diaFeriado.findUnique({ where: { fecha: f.fecha } })
        if (existe) {
          existentes++
          continue
        }
        await prisma.diaFeriado.create({
          data: { fecha: f.fecha, nombre: f.nombre, recurrente: f.recurrente },
        })
        creados++
      }
    }

    return NextResponse.json({ creados, existentes, years })
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})
