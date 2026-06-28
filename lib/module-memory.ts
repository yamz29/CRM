/**
 * Memoria de módulo: recuerda la última URL (con filtros) de cada lista de
 * primer nivel para que, al volver a ese módulo desde el sidebar, los
 * breadcrumbs o el botón "Atrás", el usuario regrese a la vista que tenía
 * (filtros, orden, búsqueda) en lugar de a la lista en blanco.
 *
 * Se persiste en sessionStorage (vida de la pestaña). Todas las funciones son
 * seguras en SSR: si no hay `window` devuelven valores neutros.
 */
const KEY = 'erp:module-memory'

function read(): Record<string, string> {
  if (typeof window === 'undefined') return {}
  try {
    return JSON.parse(window.sessionStorage.getItem(KEY) || '{}')
  } catch {
    return {}
  }
}

function write(map: Record<string, string>) {
  if (typeof window === 'undefined') return
  try {
    window.sessionStorage.setItem(KEY, JSON.stringify(map))
  } catch {
    /* almacenamiento no disponible: ignorar */
  }
}

/** Devuelve la clave de módulo de una ruta: `/tareas/5/editar` → `/tareas`. */
export function moduleOf(path: string): string {
  const seg = path.split('?')[0].split('/').filter(Boolean)[0]
  return seg ? `/${seg}` : '/'
}

/** ¿Es la raíz de un módulo (un solo segmento)?  `/tareas` → sí, `/tareas/5` → no. */
export function isModuleRoot(pathname: string): boolean {
  return pathname.split('/').filter(Boolean).length === 1
}

/**
 * Registra la URL actual como la última vista del módulo, solo si es la raíz de
 * una lista (un segmento). `search` debe incluir el `?` inicial o ir vacío.
 */
export function rememberListUrl(pathname: string, search: string) {
  if (!isModuleRoot(pathname)) return
  const map = read()
  map[moduleOf(pathname)] = pathname + (search || '')
  write(map)
}

/**
 * Devuelve la URL recordada para una ruta de módulo (`/tareas`), o `null`.
 * Solo aplica a rutas raíz de módulo.
 */
export function getRememberedUrl(moduleHref: string): string | null {
  if (!isModuleRoot(moduleHref)) return null
  return read()[moduleHref] ?? null
}
