'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  FileText,
  ChevronRight,
  ChevronDown,
  Settings,
  CheckSquare,
  Box,
  Package,
  FileSpreadsheet,
  LogOut,
  Receipt,
  Moon,
  Sun,
  Clock,
  ChefHat,
  BookOpen,
  TrendingUp,
  Briefcase,
  ClipboardList,
  Wrench,
  Monitor,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useTheme } from '@/components/theme/ThemeProvider'

// ── Nav structure ─────────────────────────────────────────────────────────────

const NAV_GROUPS = [
  {
    key: 'operaciones',
    label: 'Operaciones',
    icon: Briefcase,
    items: [
      { href: '/clientes',      label: 'Clientes',      icon: Users },
      { href: '/oportunidades', label: 'Pipeline',       icon: TrendingUp },
      { href: '/presupuestos',  label: 'Presupuestos',  icon: FileText },
      { href: '/proyectos',     label: 'Proyectos',     icon: FolderOpen },
      { href: '/gastos',        label: 'Gastos',        icon: Receipt },
      { href: '/recursos',      label: 'Recursos',      icon: Package },
      { href: '/apus',          label: 'Catálogo APU',  icon: FileSpreadsheet },
    ],
  },
  {
    key: 'gestion',
    label: 'Gestión',
    icon: ClipboardList,
    items: [
      { href: '/tareas', label: 'Tareas',          icon: CheckSquare },
      { href: '/horas',  label: 'Horas del Equipo', icon: Clock },
    ],
  },
  {
    key: 'taller',
    label: 'Taller',
    icon: Wrench,
    items: [
      { href: '/melamina', label: 'Módulos Melamina',    icon: Box },
      { href: '/cocinas',  label: 'Espacios (Modulares)', icon: ChefHat },
    ],
  },
  {
    key: 'sistema',
    label: 'Sistema',
    icon: Monitor,
    items: [
      { href: '/ayuda',         label: 'Ayuda',          icon: BookOpen },
      { href: '/configuracion', label: 'Configuración',  icon: Settings },
    ],
  },
]

// ── Types ─────────────────────────────────────────────────────────────────────

interface SidebarProps {
  userName?: string
  userEmail?: string
  logoUrl?: string | null
  nombreEmpresa?: string
}

// ── NavLink ───────────────────────────────────────────────────────────────────

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 pl-8 pr-3 py-2 rounded-lg text-sm font-medium transition-all duration-150 group',
        isActive
          ? 'bg-blue-600 text-white shadow-lg shadow-blue-900/30'
          : 'text-slate-400 hover:text-white hover:bg-white/5'
      )}
    >
      <Icon className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-slate-500 group-hover:text-slate-300')} />
      <span className="flex-1">{label}</span>
      {isActive && <ChevronRight className="w-3.5 h-3.5 text-blue-300" />}
    </Link>
  )
}

// ── NavGroup ──────────────────────────────────────────────────────────────────

function NavGroup({
  group,
  defaultOpen,
}: {
  group: typeof NAV_GROUPS[0]
  defaultOpen: boolean
}) {
  const pathname = usePathname()
  const hasActive = group.items.some((item) =>
    item.href === '/' ? pathname === '/' : pathname.startsWith(item.href)
  )
  const [open, setOpen] = useState(defaultOpen || hasActive)
  const Icon = group.icon

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
          {group.items.map((item) => (
            <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
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
    <aside className="fixed left-0 top-0 h-full w-64 bg-[#0b0f1a] dark:bg-[#0b0f1a] flex flex-col z-50 border-r border-white/5">
      {/* Brand / Logo */}
      <div className="px-5 py-5 border-b border-white/5">
        <div className="flex items-center gap-3">
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={logoUrl}
              alt="Logo"
              className="w-10 h-10 object-contain rounded-lg bg-white p-0.5 flex-shrink-0"
            />
          ) : (
            <div className="flex-shrink-0 w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center shadow-lg shadow-blue-900/40">
              <span className="text-white font-black text-sm tracking-tight">GG</span>
            </div>
          )}
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">{nombreEmpresa}</p>
            <p className="text-slate-500 text-xs">CRM Gestión <span className="text-slate-600 ml-1">v1.3</span></p>
          </div>
        </div>
      </div>

      {/* Dashboard (siempre visible, sin grupo) */}
      <div className="px-3 pt-3 pb-1">
        <NavLink href="/" label="Dashboard" icon={LayoutDashboard} />
      </div>

      {/* Navigation groups */}
      <nav className="flex-1 px-3 pb-4 space-y-1 overflow-y-auto">
        {NAV_GROUPS.map((group, i) => (
          <NavGroup key={group.key} group={group} defaultOpen={i === 0} />
        ))}
      </nav>

      {/* Footer: user + theme toggle + logout */}
      <div className="px-3 py-3 border-t border-white/5 space-y-1">
        {/* Theme toggle */}
        <button
          onClick={toggle}
          title={theme === 'dark' ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
          className="w-full flex items-center gap-3 px-3 py-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150 text-xs font-medium"
        >
          {theme === 'dark' ? (
            <>
              <Sun className="w-4 h-4 text-amber-400" />
              <span>Modo claro</span>
            </>
          ) : (
            <>
              <Moon className="w-4 h-4 text-blue-400" />
              <span>Modo oscuro</span>
            </>
          )}
        </button>

        {/* User profile + logout */}
        <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg">
          <div className="w-8 h-8 rounded-full bg-blue-700 flex items-center justify-center flex-shrink-0 ring-2 ring-blue-900/50">
            <span className="text-white text-xs font-bold">{initials || 'AD'}</span>
          </div>
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
        </div>
      </div>
    </aside>
  )
}
