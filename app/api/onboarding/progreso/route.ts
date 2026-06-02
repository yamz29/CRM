import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { withPermiso } from '@/lib/with-permiso'

/**
 * GET /api/onboarding/progreso
 *
 * Devuelve qué items del checklist de primeros pasos ya están "hechos"
 * en el sistema. La detección es GLOBAL (no por usuario): si alguien
 * en el equipo ya creó al menos 1 cliente, el item "Crear cliente"
 * aparece como completado para todos.
 *
 * Esto es intencional — el onboarding mide "el sistema está en marcha",
 * no "yo personalmente hice esto". Para tracking por usuario habría que
 * agregar una tabla OnboardingProgreso, no vale la pena para MVP.
 */
export const GET = withPermiso('dashboard', 'ver', async (_req: NextRequest) => {
  const [
    clientes,
    oportunidades,
    presupuestos,
    proyectos,
    cronogramas,
    cuentas,
    facturas,
    pagos,
    movimientos,
    proyectosCerrados,
    bitacora,
    adicionales,
  ] = await Promise.all([
    prisma.cliente.count(),
    prisma.oportunidad.count(),
    prisma.presupuesto.count(),
    prisma.proyecto.count(),
    prisma.cronograma.count(),
    prisma.cuentaBancaria.count(),
    prisma.factura.count(),
    prisma.pagoFactura.count(),
    prisma.movimientoBancario.count(),
    prisma.proyecto.count({ where: { estado: 'Cerrado' } }),
    prisma.bitacoraEntrada.count(),
    prisma.adicionalProyecto.count(),
  ])

  // Mapeo: cada clave es un slug del checklist, valor true si está cumplido
  const checklist: Record<string, boolean> = {
    // Vendedor
    'crear-cliente':        clientes > 0,
    'crear-oportunidad':    oportunidades > 0,
    'crear-presupuesto':    presupuestos > 0,
    'crear-proyecto':       proyectos > 0,

    // Supervisor
    'crear-cronograma':     cronogramas > 0,
    'registrar-bitacora':   bitacora > 0,
    'crear-adicional':      adicionales > 0,
    'cerrar-proyecto':      proyectosCerrados > 0,

    // Contable
    'configurar-cuenta':    cuentas > 0,
    'registrar-factura':    facturas > 0,
    'registrar-pago':       pagos > 0,
    'importar-movimientos': movimientos > 0,
  }

  return NextResponse.json({ checklist })
})
