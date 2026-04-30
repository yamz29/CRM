import { headers } from 'next/headers'
import Link from 'next/link'
import { ArrowLeft, Bell } from 'lucide-react'
import { NotificacionesCard } from '@/components/notifications/NotificacionesCard'
import { InteresadosForm } from './InteresadosForm'
import { prisma } from '@/lib/prisma'

export default async function NotificacionesConfigPage() {
  const hdrs = await headers()
  const esAdmin = hdrs.get('x-user-rol') === 'Admin'

  const usuarios = esAdmin
    ? await prisma.usuario.findMany({
        where: { activo: true },
        select: {
          id: true, nombre: true, correo: true, rol: true,
          esInteresadoNotificaciones: true,
          _count: { select: { pushSubscriptions: true } },
        },
        orderBy: { nombre: 'asc' },
      })
    : []

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link
          href="/configuracion"
          className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted/40"
        >
          <ArrowLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-6 h-6 text-muted-foreground" /> Notificaciones
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configura los avisos del sistema en este navegador y la lista de usuarios que los reciben.
          </p>
        </div>
      </div>

      {/* Card "este dispositivo" — siempre visible para todos */}
      <div>
        <h2 className="text-sm font-semibold text-foreground mb-2">Este dispositivo</h2>
        <NotificacionesCard />
      </div>

      {/* Lista de interesados — solo admin */}
      {esAdmin && (
        <div>
          <h2 className="text-sm font-semibold text-foreground mb-2">
            Lista de interesados
          </h2>
          <p className="text-xs text-muted-foreground mb-3">
            Los usuarios marcados reciben las notificaciones del sistema (facturas que vencen,
            cambios de estado en proyectos, cronogramas atrasados). El número entre paréntesis
            indica cuántos dispositivos tienen suscripción activa.
          </p>
          <InteresadosForm usuarios={usuarios.map(u => ({
            id: u.id,
            nombre: u.nombre,
            correo: u.correo,
            rol: u.rol,
            esInteresado: u.esInteresadoNotificaciones,
            dispositivos: u._count.pushSubscriptions,
          }))} />
        </div>
      )}
    </div>
  )
}
