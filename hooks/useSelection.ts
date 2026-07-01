'use client'

import { useState, useCallback } from 'react'

/**
 * Manejo de selección múltiple para listas (checkboxes + acciones en lote).
 * Trabaja sobre un Set de ids. `toggleAll` recibe los ids visibles actuales:
 * si ya están todos seleccionados los deselecciona, si no, los selecciona.
 */
export function useSelection<T = number>() {
  const [selected, setSelected] = useState<Set<T>>(new Set())

  const toggle = useCallback((id: T) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }, [])

  const toggleAll = useCallback((ids: T[]) => {
    setSelected((prev) => {
      const allSelected = ids.length > 0 && ids.every((id) => prev.has(id))
      return allSelected ? new Set<T>() : new Set(ids)
    })
  }, [])

  const clear = useCallback(() => setSelected(new Set<T>()), [])

  const isSelected = useCallback((id: T) => selected.has(id), [selected])

  return { selected, count: selected.size, toggle, toggleAll, clear, isSelected }
}
