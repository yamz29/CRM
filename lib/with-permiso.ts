/**
 * Higher-order function para envolver route handlers con checkPermiso.
 *
 * Uso:
 *   export const GET = withPermiso('gastos', 'ver', async (req) => {
 *     // ... handler sólo se ejecuta si el usuario tiene permiso
 *   })
 *
 *   export const POST = withPermiso('gastos', 'editar', async (req, ctx) => {
 *     // ctx es el segundo argumento de Next (ej: { params })
 *   })
 *
 * Si el usuario no tiene permiso, devuelve 401/403 automáticamente.
 */

import type { NextRequest, NextResponse } from 'next/server'
import { checkPermiso, type ModuloKey, type NivelPermiso } from './permisos'

// Handler tipado libre: acepta cualquier shape de context (params, etc.)
// y cualquier shape de response (NextResponse puede variar por rama del handler).
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ApiHandler = (req: NextRequest, ctx: any) => Promise<NextResponse> | NextResponse

export function withPermiso(
  modulo: ModuloKey,
  nivel: NivelPermiso,
  handler: ApiHandler,
): ApiHandler {
  return async (req, ctx) => {
    const denied = await checkPermiso(req, modulo, nivel)
    if (denied) return denied
    return handler(req, ctx)
  }
}
