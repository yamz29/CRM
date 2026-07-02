/**
 * Wrapper estándar para route handlers (auditoría F2).
 *
 * Compone en un solo lugar lo que cada ruta repetía a mano:
 *   1. Chequeo de permisos (mismo `checkPermiso` que `withPermiso`)
 *   2. Resolución de `params` (Next 16 los entrega como Promise) y `ctx.id`
 *      parseado a entero (400 automático si no es numérico)
 *   3. Validación opcional del body JSON con Zod (`schema`)
 *   4. Traducción central de errores:
 *        - ApiError               → su status y mensaje
 *        - z.ZodError             → 400 con detalles por campo
 *        - Prisma P2025           → 404 "Registro no encontrado"
 *        - Prisma P2003           → 409 "tiene registros relacionados"
 *        - Prisma P2002           → 409 "valor duplicado"
 *        - resto                  → 500 + console.error con método y ruta
 *
 * Uso:
 *   export const GET = apiHandler({ modulo: 'contabilidad', nivel: 'ver' },
 *     async (_req, ctx) => {
 *       const cuenta = await prisma.cuentaBancaria.findUnique({ where: { id: ctx.id } })
 *       if (!cuenta) throw new ApiError(404, 'Cuenta no encontrada')
 *       return NextResponse.json(cuenta)
 *     })
 *
 *   export const POST = apiHandler(
 *     { modulo: 'contabilidad', nivel: 'editar', schema: CuentaCreateSchema },
 *     async (_req, ctx) => NextResponse.json(await crear(ctx.body), { status: 201 }),
 *   )
 *
 * Rutas multipart/form-data: no pasar `schema`; parsear el formData en el
 * handler y validar con `MiSchema.parse(data)` — el ZodError lo traduce
 * igual este wrapper.
 *
 * `withPermiso` sigue siendo válido para rutas aún no migradas; este wrapper
 * es el estándar para rutas nuevas y para las que se vayan tocando.
 */

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { Prisma } from '@prisma/client'
import { checkPermiso, type ModuloKey, type NivelPermiso } from './permisos'

/** Error de dominio que el handler puede lanzar para cortar con un status específico. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

type Params = Record<string, string>

export interface ApiCtx<TBody> {
  /** Body JSON ya validado por `schema` (undefined si no se pasó schema). */
  body: TBody
  /** Params de la ruta ya resueltos. */
  params: Params
  /** `params.id` como entero. Acceder a él lanza 400 si falta o no es numérico. */
  readonly id: number
}

interface Opts<TBody> {
  modulo: ModuloKey
  nivel: NivelPermiso
  schema?: z.ZodSchema<TBody>
}

type NextRouteCtx = { params?: Promise<Params> }

export function apiHandler<TBody = undefined>(
  opts: Opts<TBody>,
  handler: (req: NextRequest, ctx: ApiCtx<TBody>) => Promise<NextResponse> | NextResponse,
) {
  return async (req: NextRequest, nextCtx?: NextRouteCtx): Promise<NextResponse> => {
    const denied = await checkPermiso(req, opts.modulo, opts.nivel)
    if (denied) return denied

    try {
      const params = nextCtx?.params ? await nextCtx.params : {}

      let body = undefined as TBody
      if (opts.schema) {
        let json: unknown
        try {
          json = await req.json()
        } catch {
          throw new ApiError(400, 'Body inválido (JSON malformado)')
        }
        body = opts.schema.parse(json)
      }

      const ctx: ApiCtx<TBody> = {
        body,
        params,
        get id(): number {
          const n = parseInt(params.id ?? '', 10)
          if (isNaN(n)) throw new ApiError(400, 'ID inválido')
          return n
        },
      }

      return await handler(req, ctx)
    } catch (error) {
      return traducirError(error, req)
    }
  }
}

function traducirError(error: unknown, req: NextRequest): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json({ error: error.message }, { status: error.status })
  }

  if (error instanceof z.ZodError) {
    return NextResponse.json(
      {
        error: 'Datos inválidos',
        details: error.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
      },
      { status: 400 },
    )
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2025') {
      return NextResponse.json({ error: 'Registro no encontrado' }, { status: 404 })
    }
    if (error.code === 'P2003') {
      return NextResponse.json(
        { error: 'No se puede completar la operación: el registro tiene datos relacionados (elimínelos o anule en su lugar)' },
        { status: 409 },
      )
    }
    if (error.code === 'P2002') {
      const campos = Array.isArray(error.meta?.target) ? (error.meta.target as string[]).join(', ') : 'valor único'
      return NextResponse.json({ error: `Ya existe un registro con ese ${campos}` }, { status: 409 })
    }
  }

  console.error(`[api] ${req.method} ${req.nextUrl.pathname}:`, error)
  return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
}
