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
