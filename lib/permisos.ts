// ── Módulos del sistema ────────────────────────────────────────────────────────

export const MODULOS = [
  { key: 'dashboard',     label: 'Dashboard',              grupo: 'Principal' },
  { key: 'clientes',      label: 'Clientes',               grupo: 'Operaciones' },
  { key: 'oportunidades', label: 'Pipeline / Oportunidades', grupo: 'Operaciones' },
  { key: 'presupuestos',  label: 'Presupuestos',           grupo: 'Operaciones' },
  { key: 'proyectos',     label: 'Proyectos',              grupo: 'Operaciones' },
  { key: 'cronogramas',   label: 'Cronogramas',            grupo: 'Operaciones' },
  { key: 'gastos',        label: 'Gastos',                 grupo: 'Operaciones' },
  { key: 'recursos',      label: 'Recursos',               grupo: 'Operaciones' },
  { key: 'apus',          label: 'Catálogo APU',           grupo: 'Operaciones' },
  { key: 'contabilidad',  label: 'Contabilidad',           grupo: 'Finanzas' },
  { key: 'proveedores',   label: 'Proveedores',            grupo: 'Finanzas' },
  { key: 'compras',       label: 'Compras',                grupo: 'Finanzas' },
  { key: 'tareas',        label: 'Tareas',                 grupo: 'Gestión' },
  { key: 'horas',         label: 'Horas del equipo',       grupo: 'Gestión' },
  { key: 'melamina',      label: 'Módulos Melamina',       grupo: 'Taller' },
  { key: 'cocinas',       label: 'Espacios Modulares',     grupo: 'Taller' },
  { key: 'produccion',    label: 'Producción',             grupo: 'Taller' },
  { key: 'configuracion', label: 'Configuración',          grupo: 'Sistema' },
] as const

export type ModuloKey = typeof MODULOS[number]['key']
export type NivelPermiso = 'ninguno' | 'ver' | 'editar' | 'admin'
export type PermisosMap = Partial<Record<ModuloKey, NivelPermiso>>

export const NIVELES: { value: NivelPermiso; label: string; color: string }[] = [
  { value: 'ninguno', label: 'Sin acceso', color: 'text-slate-400' },
  { value: 'ver',     label: 'Ver',        color: 'text-blue-500' },
  { value: 'editar',  label: 'Editar',     color: 'text-green-500' },
  { value: 'admin',   label: 'Admin',      color: 'text-purple-500' },
]

const NIVEL_ORDER: Record<NivelPermiso, number> = {
  ninguno: 0, ver: 1, editar: 2, admin: 3,
}

/** Verifica si el nivel actual es suficiente para el requerido */
export function nivelSuficiente(actual: NivelPermiso, requerido: NivelPermiso): boolean {
  return NIVEL_ORDER[actual] >= NIVEL_ORDER[requerido]
}

/**
 * Retorna el nivel de un usuario para un módulo.
 * - Si el usuario es Admin → siempre 'admin'
 * - Si no hay registro → 'editar' (compatibilidad hacia atrás)
 */
export function getNivel(
  permisos: PermisosMap,
  modulo: ModuloKey,
  esAdmin: boolean
): NivelPermiso {
  if (esAdmin) return 'admin'
  return permisos[modulo] ?? 'editar'
}

/** Convierte array de PermisoUsuario de Prisma a PermisosMap */
export function toPermisosMap(
  rows: { modulo: string; nivel: string }[]
): PermisosMap {
  const map: PermisosMap = {}
  for (const r of rows) {
    map[r.modulo as ModuloKey] = r.nivel as NivelPermiso
  }
  return map
}

// ── API route permission check ────────────────────────────────────────────────

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

/**
 * Verifica que el usuario autenticado tenga el nivel mínimo de permiso
 * para un módulo. Usa los headers inyectados por middleware.
 *
 * Retorna null si el acceso es permitido, o un NextResponse 403 si no.
 *
 * Uso: const denied = await checkPermiso(req, 'contabilidad', 'ver')
 *      if (denied) return denied
 */
export async function checkPermiso(
  req: NextRequest,
  modulo: ModuloKey,
  requerido: NivelPermiso
): Promise<NextResponse | null> {
  const userId = req.headers.get('x-user-id')
  const rol = req.headers.get('x-user-rol') || ''

  if (!userId) {
    return NextResponse.json({ error: 'No autenticado' }, { status: 401 })
  }

  // Admin siempre tiene acceso
  if (rol === 'Admin') return null

  // Lazy import to avoid circular deps
  const { prisma } = await import('@/lib/prisma')

  const permiso = await prisma.permisoUsuario.findUnique({
    where: { usuarioId_modulo: { usuarioId: parseInt(userId), modulo } },
  })

  // Si no hay registro, default = 'editar' (compatibilidad)
  const nivel: NivelPermiso = (permiso?.nivel as NivelPermiso) ?? 'editar'

  if (!nivelSuficiente(nivel, requerido)) {
    return NextResponse.json(
      { error: `Sin permiso para ${modulo} (requiere: ${requerido})` },
      { status: 403 }
    )
  }

  return null
}
