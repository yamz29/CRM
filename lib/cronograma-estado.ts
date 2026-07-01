/**
 * Estado derivado de una actividad de cronograma a partir de su avance y su
 * fecha de fin, relativo a "hoy". Lógica única compartida entre la página de
 * cronograma y el Gantt embebido en el proyecto (#H23).
 */
export function derivarEstadoActividad(
  pctAvance: number,
  fechaFin: string | Date,
  hoy: Date,
): 'Completado' | 'En Ejecución' | 'Atrasado' | 'Pendiente' {
  if (pctAvance >= 100) return 'Completado'
  const fin = new Date(fechaFin)
  if (pctAvance > 0) return fin < hoy ? 'Atrasado' : 'En Ejecución'
  return fin < hoy ? 'Atrasado' : 'Pendiente'
}

/** Aplica el estado derivado a una lista de actividades (inmutable). */
export function derivarEstados<T extends { pctAvance: number; fechaFin: string | Date }>(
  actividades: T[],
  hoy: Date = new Date(),
): (T & { estado: string })[] {
  return actividades.map(a => ({ ...a, estado: derivarEstadoActividad(a.pctAvance, a.fechaFin, hoy) }))
}
