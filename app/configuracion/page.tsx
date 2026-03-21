import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Settings, Building2, UserCheck, Tag, Users, Ruler, HardDrive } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmpresaForm } from '@/components/configuracion/EmpresaForm'
import { VendedoresPanel } from '@/components/configuracion/VendedoresPanel'
import { CategoriasPanel } from '@/components/configuracion/CategoriasPanel'
import { UsuariosPanel } from '@/components/configuracion/UsuariosPanel'
import { UnidadesPanel } from '@/components/configuracion/UnidadesPanel'
import { RespaldoPanel } from '@/components/configuracion/RespaldoPanel'

const tabs = [
  { key: 'empresa', label: 'Empresa', icon: Building2 },
  { key: 'vendedores', label: 'Vendedores', icon: UserCheck },
  { key: 'categorias', label: 'Categorías', icon: Tag },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'unidades', label: 'Unidades', icon: Ruler },
  { key: 'respaldo', label: 'Respaldo', icon: HardDrive },
]

export default async function ConfiguracionPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const { tab: tabParam } = await searchParams
  const activeTab = tabParam || 'empresa'

  // Load data server-side based on active tab
  const empresa = activeTab === 'empresa' ? await prisma.empresa.findFirst() : null
  const vendedores =
    activeTab === 'vendedores'
      ? await prisma.vendedor.findMany({ orderBy: { nombre: 'asc' } })
      : []
  const categorias =
    activeTab === 'categorias'
      ? await prisma.categoria.findMany({ orderBy: { nombre: 'asc' } })
      : []
  const usuariosRaw =
    activeTab === 'usuarios'
      ? await prisma.usuario.findMany({ orderBy: { nombre: 'asc' } })
      : []
  const usuarios = usuariosRaw.map(u => ({ ...u, hasPassword: u.password !== null }))
  const unidades =
    activeTab === 'unidades'
      ? await prisma.unidadGlobal.findMany({ orderBy: [{ tipo: 'asc' }, { codigo: 'asc' }] })
      : []

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-slate-100 flex items-center justify-center">
          <Settings className="w-5 h-5 text-slate-600" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Configuración</h1>
          <p className="text-slate-500 text-sm">Administra los datos del sistema</p>
        </div>
      </div>

      {/* Layout: sidebar + content */}
      <div className="flex gap-6">
        {/* Left Sidebar */}
        <aside className="w-52 flex-shrink-0">
          <nav className="space-y-1">
            {tabs.map(({ key, label, icon: Icon }) => {
              const isActive = activeTab === key
              return (
                <Link
                  key={key}
                  href={`/configuracion?tab=${key}`}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                    isActive
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-200'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  )}
                >
                  <Icon
                    className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-white' : 'text-slate-400')}
                  />
                  {label}
                </Link>
              )
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {activeTab === 'empresa' && <EmpresaForm initialData={empresa} />}
          {activeTab === 'vendedores' && <VendedoresPanel initialData={vendedores} />}
          {activeTab === 'categorias' && <CategoriasPanel initialData={categorias} />}
          {activeTab === 'usuarios' && <UsuariosPanel initialData={usuarios} />}
          {activeTab === 'unidades' && <UnidadesPanel initialData={unidades} />}
          {activeTab === 'respaldo' && <RespaldoPanel />}
        </div>
      </div>
    </div>
  )
}
