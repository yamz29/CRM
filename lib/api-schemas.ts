/**
 * Schemas Zod centralizados para validación de bodies en API routes.
 *
 * Uso:
 *   const parsed = await parseBody(req, GastoCreateSchema)
 *   if (!parsed.ok) return parsed.response
 *   const data = parsed.data  // fully typed
 */

import { z } from 'zod'
import { NextResponse } from 'next/server'

// ── Helper ───────────────────────────────────────────────────────────────

type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse }

/**
 * Lee el body JSON del request y lo valida contra un schema Zod.
 * Devuelve un objeto discriminado (ok: true con datos, ok: false con 400).
 */
export async function parseBody<T>(
  req: Request,
  schema: z.ZodSchema<T>,
): Promise<ParseResult<T>> {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Body inválido (JSON malformado)' }, { status: 400 }),
    }
  }

  const result = schema.safeParse(json)
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error: 'Datos inválidos',
          details: result.error.issues.map(i => ({
            path: i.path.join('.'),
            message: i.message,
          })),
        },
        { status: 400 },
      ),
    }
  }
  return { ok: true, data: result.data }
}

// ── Primitives reutilizables ─────────────────────────────────────────────

const optionalId = z.coerce.number().int().positive().optional().nullable()
const optionalString = z.string().trim().max(1000).optional().nullable()

// ── Gastos ───────────────────────────────────────────────────────────────

export const DESTINO_TIPOS = ['proyecto', 'oficina', 'taller', 'general', 'sin_asignar'] as const

/**
 * Schema para crear un gasto.
 * Nota: los campos de archivo (archivoUrl, etc.) se manejan por separado
 * porque vienen de multipart/form-data, no del body JSON.
 */
export const GastoCreateSchema = z.object({
  descripcion: z.string().trim().min(1, 'Descripción requerida'),
  fecha: z.coerce.date(),
  monto: z.coerce.number().finite().nonnegative(),
  moneda: z.string().trim().max(10).default('RD$'),
  destinoTipo: z.enum(DESTINO_TIPOS).default('proyecto'),
  tipoGasto: z.string().trim().max(100).default('Gasto menor'),
  referencia: optionalString,
  suplidor: optionalString,
  categoria: optionalString,
  subcategoria: optionalString,
  metodoPago: z.string().trim().max(50).default('Efectivo'),
  cuentaOrigen: optionalString,
  observaciones: optionalString,
  estado: z.string().trim().max(50).default('Registrado'),
  proyectoId: optionalId,
  partidaId: optionalId,
  recursoId: optionalId,
  cantidadRecurso: z.coerce.number().finite().optional().nullable(),
  movimientoStock: z.enum(['entrada', 'salida']).optional().nullable(),
})

export type GastoCreate = z.infer<typeof GastoCreateSchema>

/**
 * Schema para actualizar (PUT/PATCH). Todos los campos opcionales.
 */
export const GastoUpdateSchema = GastoCreateSchema.partial()
export type GastoUpdate = z.infer<typeof GastoUpdateSchema>
