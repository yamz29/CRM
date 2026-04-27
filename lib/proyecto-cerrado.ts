import { NextResponse } from 'next/server'
import { prisma } from './prisma'

/**
 * Valida que el proyecto NO esté cerrado antes de permitir modificaciones.
 *
 * Usado en endpoints que afectan datos del proyecto: gastos, facturas,
 * adicionales, pagos, cronograma. Si el proyecto está cerrado, devuelve
 * 423 Locked con un mensaje claro indicando que solo Admin puede reabrir.
 *
 * Devuelve `null` si el proyecto NO está cerrado (el handler puede continuar).
 *
 * Uso típico:
 * ```ts
 * const denied = await validarProyectoNoCerrado(proyectoId)
 * if (denied) return denied
 * // ... lógica normal ...
 * ```
 */
export async function validarProyectoNoCerrado(
  proyectoId: number | null | undefined
): Promise<NextResponse | null> {
  if (!proyectoId) return null

  const proyecto = await prisma.proyecto.findUnique({
    where: { id: proyectoId },
    select: { estado: true, codigo: true, nombre: true },
  })
  if (!proyecto) return null // si no existe, otro handler manejará el 404

  if (proyecto.estado === 'Cerrado') {
    const ref = proyecto.codigo ? `${proyecto.codigo} (${proyecto.nombre})` : proyecto.nombre
    return NextResponse.json(
      {
        error: `El proyecto ${ref} está cerrado. No se pueden modificar sus datos. ` +
               `Pídele a un administrador que lo reabra si necesitas hacer cambios.`,
      },
      { status: 423 } // Locked
    )
  }

  return null
}
