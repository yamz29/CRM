import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge, EstadoProyectoBadge, EstadoPresupuestoBadge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ArrowLeft,
  Pencil,
  Phone,
  Mail,
  MapPin,
  MessageCircle,
  FolderOpen,
  FileText,
  User,
  Plus,
} from 'lucide-react'

async function getCliente(id: number) {
  return prisma.cliente.findUnique({
    where: { id },
    include: {
      proyectos: {
        orderBy: { createdAt: 'desc' },
      },
      presupuestos: {
        include: { proyecto: { select: { nombre: true } } },
        orderBy: { createdAt: 'desc' },
      },
    },
  })
}

const tipoClienteVariant: Record<string, 'default' | 'info' | 'warning' | 'success'> = {
  'Particular': 'default',
  'Empresa': 'info',
  'Arquitecto': 'warning',
  'Inmobiliaria': 'success',
}

export default async function ClienteDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const cliente = await getCliente(id)
  if (!cliente) notFound()

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/clientes"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{cliente.nombre}</h1>
              <Badge variant={tipoClienteVariant[cliente.tipoCliente] || 'default'}>
                {cliente.tipoCliente}
              </Badge>
            </div>
            <p className="text-muted-foreground mt-0.5">Cliente registrado el {formatDate(cliente.createdAt)}</p>
          </div>
        </div>
        <Link href={`/clientes/${cliente.id}/editar`}>
          <Button variant="secondary">
            <Pencil className="w-4 h-4" />
            Editar
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Client Info */}
        <div className="space-y-6">
          {/* Contact Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="w-4 h-4 text-muted-foreground" />
                Información de Contacto
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {cliente.telefono && (
                <div className="flex items-center gap-3">
                  <Phone className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Teléfono</p>
                    <p className="text-sm font-medium text-foreground">{cliente.telefono}</p>
                  </div>
                </div>
              )}
              {cliente.whatsapp && (
                <div className="flex items-center gap-3">
                  <MessageCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">WhatsApp</p>
                    <p className="text-sm font-medium text-foreground">{cliente.whatsapp}</p>
                  </div>
                </div>
              )}
              {cliente.correo && (
                <div className="flex items-center gap-3">
                  <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                  <div>
                    <p className="text-xs text-muted-foreground">Correo</p>
                    <p className="text-sm font-medium text-foreground break-all">{cliente.correo}</p>
                  </div>
                </div>
              )}
              {cliente.direccion && (
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs text-muted-foreground">Dirección</p>
                    <p className="text-sm font-medium text-foreground">{cliente.direccion}</p>
                  </div>
                </div>
              )}
              {!cliente.telefono && !cliente.whatsapp && !cliente.correo && !cliente.direccion && (
                <p className="text-sm text-muted-foreground">Sin datos de contacto</p>
              )}
            </CardContent>
          </Card>

          {/* Details Card */}
          <Card>
            <CardHeader>
              <CardTitle>Detalles</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <p className="text-xs text-muted-foreground">Tipo de cliente</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{cliente.tipoCliente}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Fuente de captación</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{cliente.fuente}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Proyectos</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{cliente.proyectos.length}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Presupuestos</p>
                <p className="text-sm font-bold text-foreground mt-0.5">{cliente.presupuestos.length}</p>
              </div>
            </CardContent>
          </Card>

          {/* Notes Card */}
          {cliente.notas && (
            <Card>
              <CardHeader>
                <CardTitle>Notas</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground leading-relaxed">{cliente.notas}</p>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Right Column - Projects and Budgets */}
        <div className="lg:col-span-2 space-y-6">
          {/* Projects */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-muted-foreground" />
                  Proyectos ({cliente.proyectos.length})
                </CardTitle>
                <Link href={`/proyectos/nuevo?clienteId=${cliente.id}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="w-3.5 h-3.5" />
                    Nuevo proyecto
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {cliente.proyectos.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">Sin proyectos registrados</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Proyecto</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Presupuesto</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cliente.proyectos.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/proyectos/${p.id}`}
                            className="text-sm font-medium text-foreground hover:text-primary"
                          >
                            {p.nombre}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">{p.tipoProyecto}</td>
                        <td className="px-4 py-3">
                          <EstadoProyectoBadge estado={p.estado} />
                        </td>
                        <td className="px-4 py-3 text-sm font-medium text-foreground">
                          {p.presupuestoEstimado ? formatCurrency(p.presupuestoEstimado) : '-'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          {/* Budgets */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-muted-foreground" />
                  Presupuestos ({cliente.presupuestos.length})
                </CardTitle>
                <Link href={`/presupuestos/nuevo?clienteId=${cliente.id}`}>
                  <Button size="sm" variant="secondary">
                    <Plus className="w-3.5 h-3.5" />
                    Nuevo presupuesto
                  </Button>
                </Link>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              {cliente.presupuestos.length === 0 ? (
                <p className="text-muted-foreground text-sm text-center py-6">Sin presupuestos registrados</p>
              ) : (
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Número</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Proyecto</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Total</th>
                      <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Estado</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {cliente.presupuestos.map((p) => (
                      <tr key={p.id} className="hover:bg-muted/50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/presupuestos/${p.id}`}
                            className="text-sm font-medium text-foreground hover:text-primary"
                          >
                            {p.numero}
                          </Link>
                          <p className="text-xs text-muted-foreground">{formatDate(p.createdAt)}</p>
                        </td>
                        <td className="px-4 py-3 text-sm text-muted-foreground">
                          {p.proyecto?.nombre || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm font-semibold text-foreground">
                          {formatCurrency(p.total)}
                        </td>
                        <td className="px-4 py-3">
                          <EstadoPresupuestoBadge estado={p.estado} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
