'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  CalendarCheck,
  ChevronRight,
  ChevronDown,
  Settings,
  LogOut,
  Moon,
  Sun,
  BookOpen,
  Briefcase,
  ClipboardList,
  Wrench,
  Monitor,
  PanelLeftClose,
  PanelLeftOpen,
  Banknote,
  Search,
} from 'lucide-react'
import { ICONO } from '@/lib/iconos'
import { cn } from '@/lib/utils'
import { useState, Fragment } from 'react'
import { useResolvedModuleHref } from '@/components/ui/module-link'
import { useTheme } from '@/components/theme/ThemeProvider'
import { type PermisosMap, type ModuloKey, getNivel } from '@/lib/permisos'

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    key: 'operaciones',
    label: 'Operaciones',
    icon: Briefcase,
    items: [
      { href: '/clientes',      label: 'Clientes',      icon: ICONO.cliente,     modulo: 'clientes'      as ModuloKey },
      { href: '/oportunidades', label: 'Pipeline',       icon: ICONO.oportunidad, modulo: 'oportunidades' as ModuloKey },
      { href: '/presupuestos',  label: 'Presupuestos',  icon: ICONO.presupuesto, modulo: 'presupuestos'  as ModuloKey },
      { href: '/proyectos',     label: 'Proyectos',     icon: ICONO.proyecto,    modulo: 'proyectos'     as ModuloKey },
      { href: '/cronograma',    label: 'Cronogramas',   icon: ICONO.cronograma,  modulo: 'cronogramas'   as ModuloKey },
      { href: '/documentos',    label: 'Documentos',    icon: ICONO.documento,   modulo: 'documentos'    as ModuloKey },
      { href: '/gastos',        label: 'Gastos',        icon: ICONO.gasto,       modulo: 'gastos'        as ModuloKey },
      { href: '/recursos',      label: 'Recursos',      icon: ICONO.recurso,     modulo: 'recursos'      as ModuloKey },
      { href: '/apus',          label: 'Catálogo APU',  icon: ICONO.apu,         modulo: 'apus'          as ModuloKey },
    ],
  },
  {
    key: 'finanzas',
    label: 'Finanzas',
    icon: Banknote,
    items: [
      // Cobros y Transacciones se alcanzan vía la sub-nav (FinanzasNav) dentro de Contabilidad.
      { href: '/contabilidad', label: 'Contabilidad', icon: ICONO.contabilidad, modulo: 'contabilidad' as ModuloKey },
      { href: '/compras',      label: 'Compras',      icon: ICONO.compra,       modulo: 'compras'      as ModuloKey },
      { href: '/proveedores',  label: 'Proveedores',  icon: ICONO.proveedor,    modulo: 'proveedores'  as ModuloKey },
    ],
  },
  {
    key: 'gestion',
    label: 'Gestión',
    icon: ClipboardList,
    items: [
      { href: '/tareas',    label: 'Tareas',           icon: ICONO.tarea,    modulo: 'tareas'    as ModuloKey },
      { href: '/horas',     label: 'Horas del Equipo', icon: ICONO.hora,     modulo: 'horas'     as ModuloKey },
      { href: '/empleados', label: 'Empleados',        icon: ICONO.empleado, modulo: 'empleados' as ModuloKey },
      { href: '/nomina',    label: 'Nómina',           icon: ICONO.nomina,   modulo: 'nomina'    as ModuloKey },
    ],
  },
  {
    key: 'taller',
    label: 'Taller',
    icon: Wrench,
    items: [
      { href: '/melamina',    label: 'Módulos Melamina',     icon: ICONO.modulo,     modulo: 'melamina'    as ModuloKey },
      { href: '/cocinas',     label: 'Espacios modulares',   icon: ICONO.cocina,     modulo: 'cocinas'     as ModuloKey },
      { href: '/produccion',  label: 'Producción',           icon: ICONO.produccion, modulo: 'produccion'  as ModuloKey },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: Monitor,
    items: [
      { href: '/ayuda',         label: 'Ayuda',         icon: BookOpen, modulo: null },
      { href: '/configuracion', label: 'Configuración', icon: Settings, modulo: 'configuracion' as ModuloKey },
    ],
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  userName?: string
  userEmail?: string
  logoUrl?: string | null
  nombreEmpresa?: string
  permisos?: PermisosMap
  esAdmin?: boolean
  collapsed?: boolean
  onToggleCollapse?: () => void
  onNavClick?: () => void
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ href, label, icon: Icon, collapsed, onNavClick }: {
  href: string; label: string; icon: React.ElementType; collapsed?: boolean; onNavClick?: () => void
}) {
  const pathname = usePathname()
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
  const resolvedHref = useResolvedModuleHref(href)
  return (
    <Link
      href={resolvedHref}
      onClick={onNavClick}
      title={collapsed ? label : undefined}
      className={cn(
        'flex items-center gap-3 rounded-lg text-sm font-medium transition-all duration-150 group',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
        collapsed ? 'justify-center px-2 py-2.5' : 'pl-8 pr-3 py-2',
        isActive
          ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary-foreground' : 'text-slate-500 group-hover:text-slate-300')} />
      {!collapsed && <span className="flex-1">{label}</span>}
      {!collapsed && isActive && <ChevronRight className="w-3.5 h-3.5 text-primary-foreground/70" />}
    </Link>
  )
}

// ── NavGroup ──────────────────────────────────────────────────────────────────

function NavGroup({
  group,
  defaultOpen,
  permisos,
  esAdmin,
  collapsed,
  onNavClick,
}: {
  group: typeof NAV_GROUPS[0]
  defaultOpen: boolean
  permisos: PermisosMap
  esAdmin: boolean
  collapsed?: boolean
  onNavClick?: () => void
}) {
  const pathname = usePathname()

  const visibleItems = group.items.filter((item) => {
    if (!item.modulo) return true // Ayuda siempre visible
    return getNivel(permisos, item.modulo, esAdmin) !== 'ninguno'
  })

  const hasActive = visibleItems.some((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  )
  const [open, setOpen] = useState(defaultOpen || hasActive)
  const Icon = group.icon

  if (visibleItems.length === 0) return null

  // Collapsed: show items as flat icons
  if (collapsed) {
    return (
      <div className="space-y-0.5">
        {visibleItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} collapsed onNavClick={onNavClick} />
        ))}
      </div>
    )
  }

  return (
    <div>
      <button
        onClick={() => setOpen((o) => !o)}
        className={cn(
          'w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all duration-150',
          hasActive
            ? 'text-slate-300'
            : 'text-slate-600 hover:text-slate-400'
        )}
      >
        <Icon className="w-3.5 h-3.5 flex-shrink-0" />
        <span className="flex-1 text-left">{group.label}</span>
        <ChevronDown
          className={cn('w-3.5 h-3.5 transition-transform duration-200', open ? 'rotate-0' : '-rotate-90')}
        />
      </button>
      {open && (
        <div className="mt-0.5 space-y-0.5">
          {visibleItems.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} onNavClick={onNavClick} />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Sidebar ───────────────────────────────────────────────────────────────────

export function Sidebar({
  userName = 'Administrador',
  userEmail = '',
  logoUrl = null,
  nombreEmpresa = 'Gonzalva Group',
  permisos = {},
  esAdmin = false,
  collapsed = false,
  onToggleCollapse,
  onNavClick,
}: SidebarProps) {
  const router = useRouter()
  const { theme, toggle } = useTheme()
  const [loggingOut, setLoggingOut] = useState(false)

  const handleLogout = async () => {
    setLoggingOut(true)
    await fetch('/api/auth/logout', { method: 'POST' })
    router.push('/login')
    router.refresh()
  }

  const initials = userName
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase()

  return (
    <aside className="h-full bg-sidebar flex flex-col border-r border-white/5 overflow-hidden">
      {/* Brand / Logo */}
      <div className={cn('border-b border-white/5', collapsed ? 'px-2 py-4' : 'px-5 py-5')}>
        <div className={cn('flex items-center', collapsed ? 'justify-center' : 'gap-3')}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className={cn('object-contain rounded-lg bg-white p-0.5 flex-shrink-0', collapsed ? 'w-9 h-9' : 'w-10 h-10')}
            />
          ) : (
            <div className={cn('flex-shrink-0 bg-primary rounded-xl flex items-center justify-center shadow-lg shadow-primary/40', collapsed ? 'w-9 h-9' : 'w-10 h-10')}>
              <span className={cn('text-white font-black tracking-tight', collapsed ? 'text-xs' : 'text-sm')}>GG</span>
            </div>
          )}
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-white font-bold text-sm leading-tight truncate">{nombreEmpresa}</p>
              <p className="text-slate-500 text-xs">CRM Gestión <span className="text-slate-600 ml-1">v1.5</span></p>
            </div>
          )}
        </div>
      </div>

      {/* Búsqueda global (Cmd+K / Ctrl+K) */}
      <div className={cn('pt-3 pb-1', collapsed ? 'px-1.5' : 'px-3')}>
        <button
          type="button"
          onClick={() => window.dispatchEvent(new Event('open-command-palette'))}
          title={collapsed ? 'Buscar (Ctrl+K)' : undefined}
          className={cn(
            'flex items-center gap-3 w-full rounded-lg text-sm font-medium transition-colors text-white/60 hover:text-white hover:bg-white/5',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-sidebar',
            collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
          )}
        >
          <Search className="w-4 h-4 flex-shrink-0" />
          {!collapsed && (
            <>
              <span className="flex-1 text-left">Buscar</span>
              <kbd className="text-2xs text-white/40 font-mono border border-white/10 rounded px-1.5 py-0.5">
                Ctrl+K
              </kbd>
            </>
          )}
        </button>
      </div>

      {/* Mi día + Dashboard (visibles si tiene permiso de dashboard) */}
      {getNivel(permisos, 'dashboard', esAdmin) !== 'ninguno' && (
        <div className={cn('pb-1 space-y-1', collapsed ? 'px-1.5' : 'px-3')}>
          <NavLink href="/dashboard/personal" label="Mi día" icon={CalendarCheck} collapsed={collapsed} onNavClick={onNavClick} />
          <NavLink href="/" label="Dashboard" icon={LayoutDashboard} collapsed={collapsed} onNavClick={onNavClick} />
        </div>
      )}

      {/* Navigation groups */}
      <nav className={cn('flex-1 pb-4 space-y-1 overflow-y-auto', collapsed ? 'px-1.5' : 'px-3')}>
        {NAV_GROUPS.map((group, i) => (
          <NavGroup key={group.key} group={group} defaultOpen={i === 0} permisos={permisos} esAdmin={esAdmin} collapsed={collapsed} onNavClick={onNavClick} />
        ))}
      </nav>

      {/* Footer */}
      <div className={cn('border-t border-white/5 space-y-1', collapsed ? 'px-1.5 py-2' : 'px-3 py-3')}>
        {/* Collapse toggle (desktop only) */}
        {onToggleCollapse && (
          <button
            onClick={onToggleCollapse}
            title={collapsed ? 'Expandir menú' : 'Colapsar menú'}
            className={cn(
              'w-full flex items-center gap-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150 text-xs font-medium',
              collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
            )}
          >
            {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : (
              <>
                <PanelLeftClose className="w-4 h-4" />
                <span>Colapsar</span>
              </>
            )}
          </button>
        )}

        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className={cn(
            'w-full flex items-center gap-3 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150 text-xs font-medium',
            collapsed ? 'justify-center px-2 py-2' : 'px-3 py-2'
          )}
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              {!collapsed && <span>Modo claro</span>}
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-400" />
              {!collapsed && <span>Modo oscuro</span>}
            </>
          )}
        </button>

        {/* User profile + logout */}
        <div className={cn('flex items-center rounded-lg', collapsed ? 'justify-center py-1' : 'gap-2.5 px-2 py-1.5')}>
          <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center flex-shrink-0 ring-2 ring-primary/40">
            <span className="text-primary-foreground text-xs font-bold">{initials || 'AD'}</span>
          </div>
          {!collapsed && (
            <>
              <div className="flex-1 min-w-0">
                <p className="text-slate-200 text-xs font-semibold truncate">{userName}</p>
                {userEmail && <p className="text-slate-500 text-xs truncate">{userEmail}</p>}
              </div>
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                title="Cerrar sesión"
                className="p-1.5 text-slate-500 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors flex-shrink-0"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </>
          )}
        </div>

        {/* Logout (collapsed) */}
        {collapsed && (
          <button
            onClick={handleLogout}
            disabled={loggingOut}
            title="Cerrar sesión"
            className="w-full flex items-center justify-center px-2 py-2 rounded-lg text-slate-500 hover:text-red-400 hover:bg-white/5 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </aside>
  )
}
