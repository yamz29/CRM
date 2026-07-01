import { z } from 'zod'

/**
 * Validación client-side del formulario de empleado con Zod (#H17, Camino B:
 * Zod sin react-hook-form). Devuelve errores por campo para mostrarlos inline.
 */
export const empleadoFormSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio'),
  fechaIngreso: z.string().min(1, 'La fecha de ingreso es obligatoria'),
  correo: z.union([z.literal(''), z.string().email('Correo inválido')]),
  salario: z.union([z.literal(''), z.string().regex(/^\d+(\.\d+)?$/, 'Salario inválido')]),
})

/** Campo → pestaña donde vive, para poder saltar a la pestaña del primer error. */
export const CAMPO_TAB: Record<string, string> = {
  nombre: 'personal',
  correo: 'personal',
  fechaIngreso: 'laboral',
  salario: 'laboral',
}

/** Valida el form y devuelve un mapa campo→mensaje (vacío si es válido). */
export function validarEmpleado(form: Record<string, unknown>): Record<string, string> {
  const res = empleadoFormSchema.safeParse(form)
  if (res.success) return {}
  const errores: Record<string, string> = {}
  for (const issue of res.error.issues) {
    const campo = String(issue.path[0] ?? '')
    if (campo && !errores[campo]) errores[campo] = issue.message
  }
  return errores
}
