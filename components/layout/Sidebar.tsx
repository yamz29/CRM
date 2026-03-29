'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  LayoutDashboard,
  Users,
  FolderOpen,
  FileText,
  ChevronRight,
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
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useState } from 'react'
import { useTheme } from '@/components/theme/ThemeProvider'

const navItems = [
  { href: '/', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/clientes', label: 'Clientes', icon: Users },
  { href: '/proyectos', label: 'Proyectos', icon: FolderOpen },
  { href: '/presupuestos', label: 'Presupuestos', icon: FileText },
  { href: '/gastos', label: 'Gastos', icon: Receipt },
  { href: '/tareas', label: 'Tareas', icon: CheckSquare },
  { href: '/melamina', label: 'Módulos Melamina', icon: Box },
  { href: '/cocinas',  label: 'Espacios (Modulares)', icon: ChefHat },
  { href: '/horas',    label: 'Horas del Equipo', icon: Clock },
]

const catalogoItems = [
  { href: '/recursos', label: 'Recursos', icon: Package },
  { href: '/apus', label: 'Catálogo APU', icon: FileSpreadsheet },
]

const systemItems = [
  { href: '/configuracion', label: 'Configuración', icon: Settings },
]

interface SidebarProps {
  userName?: string
  userEmail?: string
  logoUrl?: string | null
  nombreEmpresa?: string
}

function NavLink({ href, label, icon: Icon }: { href: string; label: string; icon: React.ElementType }) {
  const pathname = usePathname()
  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href)
  return (
    <Link
      href={href}
      className={cn(
        'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150 group',
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
            <p className="text-slate-500 text-xs">CRM Gestión <span className="text-slate-600 ml-1">v1.2</span></p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        <p className="px-3 mb-2 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Menú Principal
        </p>
        {navItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}

        <p className="px-3 mb-1 mt-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Catálogos
        </p>
        {catalogoItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
        ))}

        <p className="px-3 mb-1 mt-4 text-xs font-semibold text-slate-600 uppercase tracking-wider">
          Sistema
        </p>
        {systemItems.map((item) => (
          <NavLink key={item.href} href={item.href} label={item.label} icon={item.icon} />
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
