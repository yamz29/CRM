import { prisma } from '@/lib/prisma'
import Link from 'next/link'
import { Settings, Building2, UserCheck, Tag, Users, Ruler, HardDrive, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'
import { EmpresaForm } from '@/components/configuracion/EmpresaForm'
import { VendedoresPanel } from '@/components/configuracion/VendedoresPanel'
import { CategoriasPanel } from '@/components/configuracion/CategoriasPanel'
import { UsuariosPanel } from '@/components/configuracion/UsuariosPanel'
import { UnidadesPanel } from '@/components/configuracion/UnidadesPanel'
import { RespaldoPanel } from '@/components/configuracion/RespaldoPanel'
import { TiposModuloPanel } from '@/components/configuracion/TiposModuloPanel'

const tabs = [
  { key: 'empresa', label: 'Empresa', icon: Building2 },
  { key: 'vendedores', label: 'Vendedores', icon: UserCheck },
  { key: 'categorias', label: 'Categorías', icon: Tag },
  { key: 'usuarios', label: 'Usuarios', icon: Users },
  { key: 'unidades', label: 'Unidades', icon: Ruler },
  { key: 'taller', label: 'Taller', icon: Wrench },
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
  const tiposModuloConfig =
    activeTab === 'taller'
      ? await prisma.configuracion.findUnique({ where: { clave: 'tipos_modulo_melamina' } })
      : null
  const tiposModulo: string[] = tiposModuloConfig
    ? JSON.parse(tiposModuloConfig.valor)
    : ['Base con puertas', 'Base con cajones', 'Base mixto', 'Aéreo con puertas', 'Columna', 'Closet', 'Baño', 'Oficina', 'Electrodoméstico', 'Otro']

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
          <Settings className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">Configuración</h1>
          <p className="text-muted-foreground text-sm">Administra los datos del sistema</p>
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
                      ? 'bg-primary text-primary-foreground shadow-md shadow-primary/20'
                      : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                  )}
                >
                  <Icon
                    className={cn('w-4 h-4 flex-shrink-0', isActive ? 'text-primary-foreground' : 'text-muted-foreground')}
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
          {activeTab === 'taller' && <TiposModuloPanel initialTipos={tiposModulo} />}
          {activeTab === 'respaldo' && <RespaldoPanel />}
        </div>
      </div>
    </div>
  )
}
