import { headers } from 'next/headers'
import { Sidebar } from './Sidebar'
import { prisma } from '@/lib/prisma'
import { toPermisosMap } from '@/lib/permisos'

interface AppLayoutProps {
  children: React.ReactNode
}

export async function AppLayout({ children }: AppLayoutProps) {
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  // Pages that render without the dashboard shell (login, print/report views)
  const SHELL_FREE = [
    '/login',
    '/reporte',
    '/imprimir',
  ]
  if (SHELL_FREE.some(p => pathname === p || pathname.endsWith(p))) {
    return <>{children}</>
  }

  // Read user from headers set by middleware
  const userName = headersList.get('x-user-nombre') ?? 'Administrador'
  const userEmail = headersList.get('x-user-correo') ?? ''
  const userIdStr = headersList.get('x-user-id') ?? ''
  const userRol = headersList.get('x-user-rol') ?? ''
  const esAdmin = userRol === 'Admin'

  // Fetch empresa branding + user permisos in parallel
  const userId = parseInt(userIdStr)
  const [empresa, permisosRows] = await Promise.all([
    prisma.empresa.findFirst({ select: { nombre: true, logoUrl: true } }),
    !isNaN(userId) && !esAdmin
      ? prisma.permisoUsuario.findMany({ where: { usuarioId: userId } })
      : Promise.resolve([]),
  ])
  const permisos = toPermisosMap(permisosRows)

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        logoUrl={empresa?.logoUrl ?? null}
        nombreEmpresa={empresa?.nombre ?? 'Gonzalva Group'}
        permisos={permisos}
        esAdmin={esAdmin}
      />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
