'use client'

import { useState, useEffect, createContext, useContext } from 'react'
import { Sidebar } from './Sidebar'
import { ChatWidget } from '@/components/ai/ChatWidget'
import { Menu } from 'lucide-react'
import { type PermisosMap } from '@/lib/permisos'

interface SidebarContextType {
  collapsed: boolean
  mobileOpen: boolean
  setMobileOpen: (open: boolean) => void
}

const SidebarContext = createContext<SidebarContextType>({
  collapsed: false,
  mobileOpen: false,
  setMobileOpen: () => {},
})

export function useSidebarContext() { return useContext(SidebarContext) }

interface LayoutShellProps {
  children: React.ReactNode
  userName: string
  userEmail: string
  logoUrl: string | null
  nombreEmpresa: string
  permisos: PermisosMap
  esAdmin: boolean
}

export function LayoutShell({
  children,
  userName,
  userEmail,
  logoUrl,
  nombreEmpresa,
  permisos,
  esAdmin,
}: LayoutShellProps) {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    const saved = localStorage.getItem('sidebar-collapsed')
    if (saved === 'true') setCollapsed(true)
  }, [])

  const toggleCollapsed = () => {
    setCollapsed(prev => {
      localStorage.setItem('sidebar-collapsed', String(!prev))
      return !prev
    })
  }

  // Close mobile menu on route change (via click on nav link)
  const closeMobile = () => setMobileOpen(false)

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  const sidebarProps = { userName, userEmail, logoUrl, nombreEmpresa, permisos, esAdmin }

  return (
    <SidebarContext.Provider value={{ collapsed, mobileOpen, setMobileOpen }}>
      <div className="flex min-h-screen">

        {/* ── Mobile overlay ── */}
        {mobileOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobile}
          />
        )}

        {/* ── Sidebar: desktop (collapsible) ── */}
        <div
          className={`hidden lg:block fixed left-0 top-0 h-full z-50 transition-all duration-300 ${
            mounted && collapsed ? 'w-16' : 'w-64'
          }`}
        >
          <Sidebar
            {...sidebarProps}
            collapsed={mounted && collapsed}
            onToggleCollapse={toggleCollapsed}
          />
        </div>

        {/* ── Sidebar: mobile (drawer) ── */}
        <div
          className={`fixed left-0 top-0 h-full z-50 w-72 transition-transform duration-300 ease-in-out lg:hidden ${
            mobileOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <Sidebar
            {...sidebarProps}
            collapsed={false}
            onNavClick={closeMobile}
          />
        </div>

        {/* ── Main content ── */}
        <main className={`flex-1 min-h-screen transition-all duration-300 ${
          mounted && collapsed ? 'lg:ml-16' : 'lg:ml-64'
        } ml-0`}>

          {/* Mobile top bar */}
          <div className="sticky top-0 z-30 flex items-center gap-3 px-4 py-3 bg-background/95 backdrop-blur-sm border-b border-border lg:hidden">
            <button
              onClick={() => setMobileOpen(true)}
              className="p-2 rounded-lg hover:bg-accent transition-colors"
            >
              <Menu className="w-5 h-5 text-foreground" />
            </button>
            <div className="flex items-center gap-2 min-w-0">
              {logoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={logoUrl} alt="" className="w-7 h-7 object-contain rounded bg-white p-0.5" />
              ) : (
                <div className="w-7 h-7 bg-blue-600 rounded-lg flex items-center justify-center">
                  <span className="text-white font-bold text-[10px]">GG</span>
                </div>
              )}
              <span className="font-bold text-sm text-foreground truncate">{nombreEmpresa}</span>
            </div>
          </div>

          <div className="p-4 lg:p-8">
            {children}
          </div>
        </main>

        <ChatWidget />
      </div>
    </SidebarContext.Provider>
  )
}
