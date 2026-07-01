/**
 * Historial de "recientes" del command palette (#H03). La lógica de lista es
 * pura (testeable); el acceso a localStorage la envuelve.
 */
export interface Reciente {
  kind: string
  id: number | string
  label: string
  sub: string
  href: string
}

const KEY = 'cmdk_recientes'
const MAX = 8

/** Antepone `item` deduplicando por (kind,id) y recorta a `max`. Puro. */
export function pushRecienteList(list: Reciente[], item: Reciente, max = MAX): Reciente[] {
  const filtrada = list.filter(r => !(r.kind === item.kind && String(r.id) === String(item.id)))
  return [item, ...filtrada].slice(0, max)
}

export function leerRecientes(): Reciente[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as Reciente[]) : []
  } catch {
    return []
  }
}

export function guardarReciente(item: Reciente): void {
  if (typeof window === 'undefined') return
  try {
    localStorage.setItem(KEY, JSON.stringify(pushRecienteList(leerRecientes(), item)))
  } catch {
    /* almacenamiento no disponible: ignorar */
  }
}
