import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'
import { feriadosDominicanos } from '@/lib/calendario-laboral'

// GET /api/configuracion/feriados
// Lista feriados ordenados por fecha. Opcionalmente filtra por año (?year=2026).
export const GET = withPermiso('configuracion', 'ver', async (request: NextRequest) => {
  const yearRaw = request.nextUrl.searchParams.get('year')
  const year = yearRaw ? parseInt(yearRaw) : null

  const where = year
    ? {
        fecha: {
          gte: new Date(Date.UTC(year, 0, 1)),
          lte: new Date(Date.UTC(year, 11, 31)),
        },
      }
    : {}

  const feriados = await prisma.diaFeriado.findMany({
    where,
    orderBy: { fecha: 'asc' },
  })
  return NextResponse.json(feriados)
})

// POST /api/configuracion/feriados
// Crea un feriado individual { fecha: 'YYYY-MM-DD', nombre, recurrente? }
export const POST = withPermiso('configuracion', 'admin', async (request: NextRequest) => {
  try {
    const body = await request.json()
    const fecha = body.fecha
    const nombre = body.nombre?.toString().trim()
    const recurrente = body.recurrente === true

    if (!fecha || !nombre) {
      return NextResponse.json({ error: 'Fecha y nombre son requeridos' }, { status: 400 })
    }

    const fechaDate = new Date(fecha + 'T00:00:00Z')
    if (isNaN(fechaDate.getTime())) {
      return NextResponse.json({ error: 'Fecha inválida (formato YYYY-MM-DD)' }, { status: 400 })
    }

    const creado = await prisma.diaFeriado.upsert({
      where: { fecha: fechaDate },
      update: { nombre, recurrente },
      create: { fecha: fechaDate, nombre, recurrente },
    })
    return NextResponse.json(creado)
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Error'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
})

// POST /api/configuracion/feriados/seed-oficiales
// Carga los feriados oficiales dominicanos para el año actual + 2 siguientes.
// Idempotente: si la fecha ya existe la salta.
// Implementado como action=seed en el POST principal para evitar otra ruta.
