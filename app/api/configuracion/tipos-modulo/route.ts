import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

const CLAVE = 'tipos_modulo_melamina'
const DEFAULTS = [
  'Base con puertas', 'Base con cajones', 'Base mixto',
  'Aéreo con puertas', 'Repisa', 'Columna', 'Closet', 'Baño', 'Oficina',
  'Electrodoméstico', 'Otro',
]

export const GET = withPermiso('configuracion', 'ver', async (_req: NextRequest) => {
  const config = await prisma.configuracion.findUnique({ where: { clave: CLAVE } })
  const tipos: string[] = config ? JSON.parse(config.valor) : DEFAULTS
  return NextResponse.json(tipos)
})

export const PUT = withPermiso('configuracion', 'editar', async (req: NextRequest) => {
  const { tipos } = await req.json()

  if (!Array.isArray(tipos) || tipos.length === 0) {
    return NextResponse.json({ error: 'Debe haber al menos un tipo' }, { status: 400 })
  }

  await prisma.configuracion.upsert({
    where: { clave: CLAVE },
    update: { valor: JSON.stringify(tipos) },
    create: { clave: CLAVE, valor: JSON.stringify(tipos) },
  })

  return NextResponse.json(tipos)
})
