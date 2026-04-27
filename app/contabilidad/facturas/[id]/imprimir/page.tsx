import { prisma } from '@/lib/prisma'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { formatCurrency, formatDate } from '@/lib/utils'
import { ArrowLeft } from 'lucide-react'
import { PrintButton } from './PrintButton'

async function getFactura(id: number) {
  return prisma.factura.findUnique({
    where: { id },
    include: {
      cliente: true,
      proveedorRef: true,
      proyecto: { select: { id: true, nombre: true, codigo: true } },
      pagos: { orderBy: { fecha: 'asc' } },
    },
  })
}

export default async function ImprimirFacturaPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id: idStr } = await params
  const id = parseInt(idStr)
  if (isNaN(id)) notFound()

  const [factura, empresa] = await Promise.all([
    getFactura(id),
    prisma.empresa.findFirst(),
  ])
  if (!factura) notFound()

  const esProforma = !!factura.esProforma
  const tipoLabel = factura.tipo === 'ingreso' ? 'COBRO' : 'PAGO'

  const nombreEmpresa = empresa?.nombre || 'Gonzalva Group'
  const rncEmpresa = empresa?.rut || ''
  const direccionEmpresa = empresa?.direccion || ''
  const telefonoEmpresa = empresa?.telefono || ''
  const emailEmpresa = empresa?.correo || ''
  const logoUrl = empresa?.logoUrl || null

  // Contraparte: cliente (si ingreso) o proveedor (si egreso)
  const contraparteNombre = factura.tipo === 'ingreso'
    ? factura.cliente?.nombre || '—'
    : factura.proveedorRef?.nombre || factura.proveedor || '—'
  const contraparteRnc = factura.tipo === 'ingreso'
    ? factura.cliente?.rnc || ''
    : factura.proveedorRef?.rnc || factura.rncProveedor || ''
  const contraparteDireccion = factura.tipo === 'ingreso'
    ? factura.cliente?.direccion || ''
    : factura.proveedorRef?.direccion || ''
  const contraparteTelefono = factura.tipo === 'ingreso'
    ? factura.cliente?.telefono || ''
    : factura.proveedorRef?.telefono || ''

  const totalPagado = factura.pagos.reduce((s, p) => s + p.monto, 0)
  const saldo = Math.max(0, factura.total - totalPagado)

  const estadoColor: Record<string, string> = {
    pagada: '#16a34a', parcial: '#d97706', pendiente: '#64748b', anulada: '#dc2626',
  }
  const estadoBg: Record<string, string> = {
    pagada: '#dcfce7', parcial: '#fef3c7', pendiente: '#f1f5f9', anulada: '#fee2e2',
  }

  return (
    <>
      <style>{`
        @page { size: A4 portrait; margin: 1.8cm; }

        @media print {
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          html, body { background: white !important; margin: 0 !important; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-shell { background: white !important; padding: 0 !important; }
          .print-wrap { box-shadow: none !important; max-width: 100% !important; margin: 0 !important; padding: 0 !important; border-radius: 0 !important; }
          .pagebreak-avoid { page-break-inside: avoid; break-inside: avoid; }
        }
      `}</style>

      <div className="print-shell" style={{ background: '#f3f4f6', minHeight: '100vh', padding: '1.5rem' }}>
        {/* Toolbar — solo pantalla */}
        <div className="no-print" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', maxWidth: '850px', margin: '0 auto 1rem' }}>
          <Link
            href={`/contabilidad/facturas/${factura.id}`}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderRadius: 8, background: 'white', border: '1px solid #e2e8f0', color: '#475569', fontSize: 14, textDecoration: 'none' }}
          >
            <ArrowLeft size={16} /> Volver
          </Link>
          <PrintButton />
        </div>

        {/* Documento */}
        <div
          className="print-wrap"
          style={{
            maxWidth: '850px',
            margin: '0 auto',
            background: 'white',
            padding: '2rem 2.5rem',
            borderRadius: 12,
            boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            color: '#0f172a',
            fontFamily: 'system-ui, -apple-system, sans-serif',
          }}
        >
          {/* Marca de agua PROFORMA */}
          {esProforma && (
            <div
              style={{
                position: 'fixed',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%) rotate(-30deg)',
                fontSize: '120px',
                fontWeight: 900,
                color: 'rgba(245, 158, 11, 0.12)',
                pointerEvents: 'none',
                zIndex: 0,
                letterSpacing: '0.1em',
                userSelect: 'none',
              }}
            >
              PROFORMA
            </div>
          )}

          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 24, paddingBottom: 20, borderBottom: '2px solid #0f172a', position: 'relative', zIndex: 1 }}>
            <div style={{ flex: 1 }}>
              {logoUrl && (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={logoUrl} alt={nombreEmpresa} style={{ height: 56, marginBottom: 8, objectFit: 'contain' }} />
              )}
              <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>{nombreEmpresa}</h1>
              {rncEmpresa && <p style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>RNC: {rncEmpresa}</p>}
              {direccionEmpresa && <p style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>{direccionEmpresa}</p>}
              <p style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>
                {telefonoEmpresa}
                {telefonoEmpresa && emailEmpresa ? ' · ' : ''}
                {emailEmpresa}
              </p>
            </div>

            <div style={{ textAlign: 'right' }}>
              <div
                style={{
                  display: 'inline-block',
                  padding: '6px 14px',
                  borderRadius: 6,
                  background: esProforma ? '#fef3c7' : (factura.tipo === 'ingreso' ? '#dbeafe' : '#fee2e2'),
                  color: esProforma ? '#92400e' : (factura.tipo === 'ingreso' ? '#1e40af' : '#991b1b'),
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: '0.08em',
                  textTransform: 'uppercase',
                  marginBottom: 8,
                }}
              >
                {esProforma ? 'Proforma' : `Factura de ${tipoLabel}`}
              </div>
              <h2 style={{ fontSize: 24, fontWeight: 800, margin: 0, fontFamily: 'monospace' }}>
                #{factura.numero}
              </h2>
              {factura.ncf && !esProforma && (
                <p style={{ fontSize: 12, margin: '4px 0', color: '#475569' }}>
                  NCF: <span style={{ fontFamily: 'monospace' }}>{factura.ncf}</span>
                </p>
              )}
              <p style={{ fontSize: 12, margin: '4px 0', color: '#475569' }}>
                Fecha: <strong style={{ color: '#0f172a' }}>{formatDate(factura.fecha)}</strong>
              </p>
              {factura.fechaVencimiento && (
                <p style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>
                  Vence: <strong style={{ color: '#0f172a' }}>{formatDate(factura.fechaVencimiento)}</strong>
                </p>
              )}
              <span
                style={{
                  display: 'inline-block',
                  marginTop: 6,
                  padding: '3px 10px',
                  borderRadius: 999,
                  background: estadoBg[factura.estado] || '#f1f5f9',
                  color: estadoColor[factura.estado] || '#475569',
                  fontSize: 11,
                  fontWeight: 700,
                  textTransform: 'capitalize',
                }}
              >
                {factura.estado}
              </span>
            </div>
          </div>

          {/* Aviso proforma */}
          {esProforma && (
            <div
              className="pagebreak-avoid"
              style={{
                marginTop: 16,
                padding: '10px 14px',
                background: '#fef3c7',
                border: '1px solid #fbbf24',
                borderRadius: 8,
                fontSize: 12,
                color: '#78350f',
                position: 'relative', zIndex: 1,
              }}
            >
              <strong>Documento sin valor fiscal.</strong> Esta proforma es una cotización de cobro y
              <strong> no sustituye a una factura con NCF</strong>. No es válida para crédito fiscal del ITBIS.
            </div>
          )}

          {/* Contraparte */}
          <div className="pagebreak-avoid" style={{ marginTop: 24, padding: 16, background: '#f8fafc', borderRadius: 8, position: 'relative', zIndex: 1 }}>
            <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 6px' }}>
              {factura.tipo === 'ingreso' ? 'Cliente' : 'Proveedor'}
            </p>
            <p style={{ fontSize: 16, fontWeight: 700, margin: '0 0 4px', color: '#0f172a' }}>{contraparteNombre}</p>
            {contraparteRnc && <p style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>RNC: {contraparteRnc}</p>}
            {contraparteDireccion && <p style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>{contraparteDireccion}</p>}
            {contraparteTelefono && <p style={{ fontSize: 12, margin: '2px 0', color: '#475569' }}>Tel: {contraparteTelefono}</p>}
            {factura.proyecto && (
              <p style={{ fontSize: 12, margin: '6px 0 0', color: '#475569' }}>
                Proyecto: <strong style={{ color: '#0f172a' }}>{factura.proyecto.codigo ? `${factura.proyecto.codigo} — ` : ''}{factura.proyecto.nombre}</strong>
              </p>
            )}
          </div>

          {/* Concepto */}
          {factura.descripcion && (
            <div className="pagebreak-avoid" style={{ marginTop: 24, position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 6px' }}>
                Concepto
              </p>
              <p style={{ fontSize: 14, lineHeight: 1.5, margin: 0, color: '#0f172a', whiteSpace: 'pre-wrap' }}>
                {factura.descripcion}
              </p>
            </div>
          )}

          {/* Desglose */}
          <div className="pagebreak-avoid" style={{ marginTop: 28, position: 'relative', zIndex: 1 }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
              <tbody>
                <tr>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Subtotal</td>
                  <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: 'monospace' }}>
                    {formatCurrency(factura.subtotal)}
                  </td>
                </tr>
                {factura.impuesto > 0 && (
                  <tr>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      ITBIS ({factura.tasaItbis}%)
                    </td>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(factura.impuesto)}
                    </td>
                  </tr>
                )}
                {factura.propinaLegal > 0 && (
                  <tr>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      Propina Legal (10%)
                    </td>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(factura.propinaLegal)}
                    </td>
                  </tr>
                )}
                {factura.otrosImpuestos > 0 && (
                  <tr>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>Otros impuestos</td>
                    <td style={{ padding: '8px 0', borderBottom: '1px solid #e2e8f0', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(factura.otrosImpuestos)}
                    </td>
                  </tr>
                )}
                <tr>
                  <td style={{ padding: '14px 0 6px', fontSize: 16, fontWeight: 800 }}>TOTAL</td>
                  <td style={{ padding: '14px 0 6px', textAlign: 'right', fontSize: 20, fontWeight: 800, fontFamily: 'monospace', color: '#0f172a' }}>
                    {formatCurrency(factura.total)}
                  </td>
                </tr>
                {totalPagado > 0 && !esProforma && (
                  <>
                    <tr>
                      <td style={{ padding: '4px 0', color: '#16a34a', fontSize: 13 }}>Pagado</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', color: '#16a34a', fontFamily: 'monospace' }}>
                        - {formatCurrency(totalPagado)}
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '4px 0', fontWeight: 700, color: saldo > 0 ? '#d97706' : '#16a34a' }}>Saldo</td>
                      <td style={{ padding: '4px 0', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: saldo > 0 ? '#d97706' : '#16a34a' }}>
                        {formatCurrency(saldo)}
                      </td>
                    </tr>
                  </>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagos detalle (solo si hay y no es proforma) */}
          {factura.pagos.length > 0 && !esProforma && (
            <div className="pagebreak-avoid" style={{ marginTop: 28, position: 'relative', zIndex: 1 }}>
              <p style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', margin: '0 0 8px' }}>
                Historial de pagos
              </p>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr style={{ background: '#f8fafc' }}>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Fecha</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Método</th>
                    <th style={{ padding: '6px 8px', textAlign: 'left', fontWeight: 700, color: '#475569' }}>Referencia</th>
                    <th style={{ padding: '6px 8px', textAlign: 'right', fontWeight: 700, color: '#475569' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {factura.pagos.map(p => (
                    <tr key={p.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 8px' }}>{formatDate(p.fecha)}</td>
                      <td style={{ padding: '6px 8px' }}>{p.metodoPago}</td>
                      <td style={{ padding: '6px 8px', fontFamily: 'monospace', color: '#475569' }}>{p.referencia || '—'}</td>
                      <td style={{ padding: '6px 8px', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(p.monto)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Footer */}
          <div style={{ marginTop: 40, paddingTop: 16, borderTop: '1px solid #e2e8f0', fontSize: 11, color: '#64748b', textAlign: 'center', position: 'relative', zIndex: 1 }}>
            {esProforma
              ? 'Esta proforma es válida por 30 días desde la fecha de emisión, salvo indicación en contrario.'
              : `Documento generado el ${formatDate(new Date())} — ${nombreEmpresa}`}
          </div>
        </div>
      </div>
    </>
  )
}
