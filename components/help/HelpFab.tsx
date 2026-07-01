'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { HelpCircle } from 'lucide-react'
import { HelpDrawer } from './HelpDrawer'

/** Ruta → artículo de ayuda (slug de content/help). El primero que matchea gana. */
const RUTA_AYUDA: { prefix: string; slug: string; titulo: string }[] = [
  { prefix: '/clientes', slug: 'clientes', titulo: 'Clientes' },
  { prefix: '/proyectos', slug: 'proyectos', titulo: 'Proyectos' },
  { prefix: '/presupuestos', slug: 'presupuestos', titulo: 'Presupuestos' },
  { prefix: '/cronograma', slug: 'cronogramas', titulo: 'Cronogramas' },
  { prefix: '/gastos', slug: 'gastos', titulo: 'Gastos' },
  { prefix: '/recursos', slug: 'materiales', titulo: 'Recursos' },
  { prefix: '/apus', slug: 'apu', titulo: 'Catálogo APU' },
  { prefix: '/empleados', slug: 'empleados', titulo: 'Empleados' },
  { prefix: '/horas', slug: 'horas', titulo: 'Control de Horas' },
  { prefix: '/nomina', slug: 'nomina', titulo: 'Nómina' },
  { prefix: '/contabilidad', slug: 'contabilidad', titulo: 'Contabilidad' },
  { prefix: '/compras', slug: 'compras', titulo: 'Compras' },
  { prefix: '/proveedores', slug: 'proveedores', titulo: 'Proveedores' },
  { prefix: '/oportunidades', slug: 'oportunidades', titulo: 'Pipeline de Ventas' },
  { prefix: '/melamina', slug: 'materiales', titulo: 'Módulos Melamina' },
  { prefix: '/cocinas', slug: 'cocinas', titulo: 'Configurador de Cocinas' },
  { prefix: '/produccion', slug: 'produccion', titulo: 'Producción' },
]

const BOTON = 'fixed bottom-4 right-4 z-[80] flex items-center justify-center w-11 h-11 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 hover:bg-primary/90 transition-colors'

/**
 * Botón flotante de ayuda contextual global (#H02): detecta la ruta y abre el
 * HelpDrawer con el artículo correspondiente. Si la ruta no tiene artículo,
 * lleva al índice de ayuda.
 */
export function HelpFab() {
  const pathname = usePathname()
  const [open, setOpen] = useState(false)
  const match = RUTA_AYUDA.find(r => pathname?.startsWith(r.prefix))

  if (!match) {
    return (
      <Link href="/ayuda" className={BOTON} title="Ayuda" aria-label="Abrir ayuda">
        <HelpCircle className="w-5 h-5" />
      </Link>
    )
  }

  return (
    <>
      <button onClick={() => setOpen(true)} className={BOTON} title={`Ayuda · ${match.titulo}`} aria-label="Abrir ayuda contextual">
        <HelpCircle className="w-5 h-5" />
      </button>
      <HelpDrawer slug={match.slug} titulo={match.titulo} open={open} onOpenChange={setOpen} hideTrigger />
    </>
  )
}
