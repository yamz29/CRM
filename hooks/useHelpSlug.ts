'use client'

import { usePathname } from 'next/navigation'

const ROUTE_TO_SLUG: Record<string, string> = {
  '/proyectos':    'proyectos',
  '/apus':         'apu',
  '/melamina':     'materiales',
  '/recursos':     'materiales',
  '/cocinas':      'cocinas',
  '/horas':        'horas',
  '/gastos':       'gastos',
  '/presupuestos': 'proyectos',
}

export function useHelpSlug(): string | null {
  const pathname = usePathname()
  const base = '/' + (pathname.split('/')[1] ?? '')
  return ROUTE_TO_SLUG[base] ?? null
}
