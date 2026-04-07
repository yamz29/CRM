import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { EstadoPresupuestoBadge } from '@/components/ui/badge'
import { formatCurrency, formatDate } from '@/lib/utils'
import {
  ArrowLeft,
  Pencil,
  Printer,
  User,
  FolderOpen,
  FileText,
  Calendar,
  Hammer,
  Box,
} from 'lucide-react'
import { CambiarEstadoButton } from './CambiarEstadoButton'
import { DuplicarButton } from './DuplicarButton'
import { ResumenIAPanel } from '@/components/presupuestos/ResumenIAPanel'

async function getPresupuesto(id: number) {
  return prisma.presupuesto.findUnique({
    where: { id },
    include: {
      cliente: true,
      proyecto: true,
      partidas: { orderBy: { orden: 'asc' } },
      modulosMelamina: { orderBy: { orden: 'asc' } },
      indirectos: { orderBy: { orden: 'asc' } },
      capitulos: {
        include: {
          partidas: { include: { analisis: true }, orderBy: { orden: 'asc' } },
        },
        orderBy: { orden: 'asc' },
      },
    },
  })
}

export default async function PresupuestoDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const presupuesto = await getPresupuesto(id)
  if (!presupuesto) notFound()

  const subtotalObra = presupuesto.partidas.reduce((acc, p) => acc + p.subtotal, 0)
  const subtotalMelamina = presupuesto.modulosMelamina.reduce(
    (acc, m) => acc + m.subtotal * m.cantidad,
    0
  )
  const subtotalBase = presupuesto.capitulos.reduce(
    (acc, cap) => acc + cap.partidas.reduce((s, p) => s + (p.esNota ? 0 : p.subtotal), 0),
    0
  )
  const indirectosActivos = presupuesto.indirectos.filter(l => l.activo)
  const subtotalIndirecto = indirectosActivos.reduce(
    (s, l) => s + subtotalBase * l.porcentaje / 100, 0
  )

  return (
    <div className="space-y-6 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <Link
            href="/presupuestos"
            className="flex items-center justify-center w-9 h-9 rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-foreground">{presupuesto.numero}</h1>
              <EstadoPresupuestoBadge estado={presupuesto.estado} />
            </div>
            <p className="text-muted-foreground text-sm mt-0.5">
              Creado el {formatDate(presupuesto.createdAt)}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href={`/presupuestos/${presupuesto.id}/imprimir`} target="_blank">
            <Button variant="secondary">
              <Printer className="w-4 h-4" />
              Imprimir
            </Button>
          </Link>
          <DuplicarButton presupuestoId={presupuesto.id} />
          <Link href={
            presupuesto.capitulos.length > 0
              ? `/presupuestos/${presupuesto.id}/editar-v2`
              : `/presupuestos/${presupuesto.id}/editar`
          }>
            <Button variant="secondary">
              <Pencil className="w-4 h-4" />
              Editar
            </Button>
          </Link>
        </div>
      </div>

      {/* Info Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center flex-shrink-0">
                <User className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliente</p>
                <Link
                  href={`/clientes/${presupuesto.cliente.id}`}
                  className="text-sm font-semibold text-foreground hover:text-primary"
                >
                  {presupuesto.cliente.nombre}
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center flex-shrink-0">
                <FolderOpen className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Proyecto</p>
                {presupuesto.proyecto ? (
                  <Link
                    href={`/proyectos/${presupuesto.proyecto.id}`}
                    className="text-sm font-semibold text-foreground hover:text-primary"
                  >
                    {presupuesto.proyecto.nombre}
                  </Link>
                ) : (
                  <p className="text-sm text-muted-foreground">Sin proyecto</p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-purple-50 flex items-center justify-center flex-shrink-0">
                <Calendar className="w-4 h-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Última actualización</p>
                <p className="text-sm font-semibold text-foreground">
                  {formatDate(presupuesto.updatedAt)}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Status Change */}
      <Card>
        <CardContent className="py-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <p className="text-sm font-medium text-foreground">Estado del presupuesto</p>
              <p className="text-xs text-muted-foreground mt-0.5">Cambia el estado según el avance de la negociación</p>
            </div>
            <div className="flex gap-2">
              <CambiarEstadoButton
                presupuestoId={presupuesto.id}
                estadoActual={presupuesto.estado}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Resumen IA */}
      <ResumenIAPanel
        presupuestoId={presupuesto.id}
        resumenIA={presupuesto.resumenIA}
        resumenIAGeneradoAt={presupuesto.resumenIAGeneradoAt ? presupuesto.resumenIAGeneradoAt.toISOString() : null}
      />

      {/* Capítulos V2 */}
      {presupuesto.capitulos.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Hammer className="w-4 h-4 text-muted-foreground" />
            <h2 className="text-lg font-semibold text-foreground">Capítulos y Partidas</h2>
          </div>
          {presupuesto.capitulos.map((cap) => {
            const capTotal = cap.partidas.reduce((a, p) => a + (p.esNota ? 0 : p.subtotal), 0)
            return (
              <Card key={cap.id}>
                <div className="flex items-center justify-between px-4 py-2.5 bg-slate-800 text-white rounded-t-xl">
                  <span className="font-semibold text-sm">
                    {cap.codigo ? `${cap.codigo} ` : ''}
                    {cap.nombre}
                  </span>
                  <span className="text-sm font-bold">{formatCurrency(capTotal)}</span>
                </div>
                <CardContent className="p-0">
                  <table className="w-full">
                    <thead>
                      <tr className="bg-muted/40 border-b border-border">
                        <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-20">Código</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                        <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase w-20">Unid.</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-24">Cantidad</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-32">Precio Unit.</th>
                        <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-32">Subtotal</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {cap.partidas.map((partida) => (
                        partida.esNota ? (
                          <tr key={partida.id} className="bg-amber-50/60">
                            <td className="px-4 py-2 text-center text-amber-700 font-bold" title="Nota">★</td>
                            <td colSpan={5} className="px-4 py-2 text-sm italic text-amber-900">{partida.descripcion}</td>
                          </tr>
                        ) : (
                          <tr key={partida.id} className="hover:bg-muted/50">
                            <td className="px-4 py-2.5 text-sm text-muted-foreground font-mono">{partida.codigo || '-'}</td>
                            <td className="px-4 py-2.5 text-sm text-foreground">{partida.descripcion}</td>
                            <td className="px-4 py-2.5 text-sm text-muted-foreground">{partida.unidad}</td>
                            <td className="px-4 py-2.5 text-sm text-muted-foreground text-right">{partida.cantidad}</td>
                            <td className="px-4 py-2.5 text-sm text-muted-foreground text-right">{formatCurrency(partida.precioUnitario)}</td>
                            <td className="px-4 py-2.5 text-sm font-semibold text-foreground text-right">{formatCurrency(partida.subtotal)}</td>
                          </tr>
                        )
                      ))}
                    </tbody>
                  </table>
                </CardContent>
              </Card>
            )
          })}
          {/* Gastos Indirectos */}
          {indirectosActivos.length > 0 && (
            <Card>
              <div className="flex items-center justify-between px-4 py-2.5 bg-slate-600 text-white rounded-t-xl">
                <span className="font-semibold text-sm">Gastos Indirectos</span>
                <span className="text-sm font-bold">{formatCurrency(subtotalIndirecto)}</span>
              </div>
              <CardContent className="p-0">
                <table className="w-full">
                  <thead>
                    <tr className="bg-muted/40 border-b border-border">
                      <th className="px-4 py-2 text-left text-xs font-semibold text-muted-foreground uppercase">Concepto</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-32">% sobre base</th>
                      <th className="px-4 py-2 text-right text-xs font-semibold text-muted-foreground uppercase w-40">Importe</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {indirectosActivos.map((l) => (
                      <tr key={l.id} className="hover:bg-muted/50">
                        <td className="px-4 py-2.5 text-sm text-foreground">{l.nombre}</td>
                        <td className="px-4 py-2.5 text-sm text-muted-foreground text-right">{l.porcentaje}%</td>
                        <td className="px-4 py-2.5 text-sm font-semibold text-foreground text-right">
                          {formatCurrency(subtotalBase * l.porcentaje / 100)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Partidas */}
      {presupuesto.partidas.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Hammer className="w-4 h-4 text-muted-foreground" />
              Partidas de Obra
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">N°</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase w-20">Unid.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase w-24">Cantidad</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase w-32">Precio Unit.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase w-32">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {presupuesto.partidas.map((partida, i) => (
                    <tr key={partida.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3 text-sm text-muted-foreground">{i + 1}</td>
                      <td className="px-4 py-3 text-sm text-foreground">{partida.descripcion}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground">{partida.unidad}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right">{partida.cantidad}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                        {formatCurrency(partida.precioUnitario)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                        {formatCurrency(partida.subtotal)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 border-border">
                    <td colSpan={5} className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">
                      Subtotal Obra:
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-foreground">
                      {formatCurrency(subtotalObra)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Módulos Melamina */}
      {presupuesto.modulosMelamina.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Box className="w-4 h-4 text-muted-foreground" />
              Módulos de Melamina / Ebanistería
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="bg-muted/40 border-b border-border">
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Tipo</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Descripción</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Dimensiones</th>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold text-muted-foreground uppercase">Material</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Cant.</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">C/U</th>
                    <th className="px-4 py-2.5 text-right text-xs font-semibold text-muted-foreground uppercase">Subtotal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {presupuesto.modulosMelamina.map((modulo) => (
                    <tr key={modulo.id} className="hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-muted text-muted-foreground">
                          {modulo.tipoModulo}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-foreground">{modulo.descripcion}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {modulo.ancho}×{modulo.alto}×{modulo.profundidad} cm
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{modulo.material}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right">{modulo.cantidad}</td>
                      <td className="px-4 py-3 text-sm text-muted-foreground text-right">
                        {formatCurrency(modulo.subtotal)}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-foreground text-right">
                        {formatCurrency(modulo.subtotal * modulo.cantidad)}
                      </td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="bg-muted/40 border-t-2 border-border">
                    <td colSpan={6} className="px-4 py-3 text-right text-sm font-semibold text-muted-foreground">
                      Subtotal Melamina:
                    </td>
                    <td className="px-4 py-3 text-right text-sm font-bold text-foreground">
                      {formatCurrency(subtotalMelamina)}
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Notes */}
      {presupuesto.notas && (
        <Card>
          <CardHeader>
            <CardTitle>Notas y Condiciones</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground leading-relaxed">{presupuesto.notas}</p>
          </CardContent>
        </Card>
      )}

      {/* Total Summary */}
      <Card className="border-2 border-blue-100">
        <CardContent className="py-5">
          <div className="flex flex-col items-end gap-2">
            {subtotalBase > 0 && subtotalIndirecto > 0 && (
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-sm text-muted-foreground">Subtotal directo</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(subtotalBase)}</span>
              </div>
            )}
            {subtotalIndirecto > 0 && (
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-sm text-muted-foreground">Gastos indirectos</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(subtotalIndirecto)}</span>
              </div>
            )}
            {subtotalObra > 0 && (
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-sm text-muted-foreground">Subtotal Obra</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(subtotalObra)}</span>
              </div>
            )}
            {subtotalMelamina > 0 && (
              <div className="flex justify-between w-full max-w-xs">
                <span className="text-sm text-muted-foreground">Subtotal Melamina</span>
                <span className="text-sm font-semibold text-foreground">{formatCurrency(subtotalMelamina)}</span>
              </div>
            )}
            <div className="flex justify-between w-full max-w-xs border-t border-border pt-2 mt-1">
              <span className="text-lg font-bold text-foreground">TOTAL</span>
              <span className="text-2xl font-bold text-blue-700">{formatCurrency(presupuesto.total)}</span>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
