import { headers } from 'next/headers'
import { Sidebar } from './Sidebar'
import { prisma } from '@/lib/prisma'

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

  // Fetch empresa branding (logo + nombre)
  const empresa = await prisma.empresa.findFirst({
    select: { nombre: true, logoUrl: true },
  })

  return (
    <div className="flex min-h-screen bg-slate-50">
      <Sidebar
        userName={userName}
        userEmail={userEmail}
        logoUrl={empresa?.logoUrl ?? null}
        nombreEmpresa={empresa?.nombre ?? 'Gonzalva Group'}
      />
      <main className="flex-1 ml-64 min-h-screen">
        <div className="p-8">
          {children}
        </div>
      </main>
    </div>
  )
}
