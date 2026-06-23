import Link from 'next/link'

const ITEMS = [
  { key: 'contabilidad', href: '/contabilidad', label: 'Contabilidad' },
  { key: 'cobros', href: '/facturacion', label: 'Cobros' },
  { key: 'transacciones', href: '/contabilidad/transacciones', label: 'Transacciones' },
  { key: 'compras', href: '/compras', label: 'Compras' },
  { key: 'rutas', href: '/compras/rutas', label: 'Rutas de compra' },
  { key: 'proveedores', href: '/proveedores', label: 'Proveedores' },
] as const

export type FinanzasSeccion = typeof ITEMS[number]['key']

/**
 * Sub-navegación del área de Finanzas. Server component (solo Links).
 * Las páginas siguen protegidas por sus propios permisos; este nav es
 * solo navegación visual del módulo.
 */
export function FinanzasNav({ activo }: { activo: FinanzasSeccion }) {
  return (
    <div className="flex gap-2 flex-wrap border-b border-border pb-3">
      {ITEMS.map(item => (
        <Link
          key={item.key}
          href={item.href}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
            activo === item.key
              ? 'bg-primary text-primary-foreground'
              : 'bg-secondary text-secondary-foreground hover:bg-secondary/80'
          }`}
        >
          {item.label}
        </Link>
      ))}
    </div>
  )
}
