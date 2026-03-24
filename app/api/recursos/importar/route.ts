import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

interface RecursoImport {
  codigo: string
  nombre: string
  tipo: string
  categoria: string
  subcategoria: string
  unidad: string
  costoUnitario: number
  moneda: string
  proveedor: string
  marca: string
  observaciones: string
  activo: boolean
}

// POST /api/recursos/importar
// Body: { recursos: RecursoImport[], modo: 'crear_actualizar'|'solo_crear'|'solo_actualizar', nombreArchivo: string }
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const items: RecursoImport[] = body.recursos ?? []
    const modo: string = body.modo ?? 'crear_actualizar'
    const nombreArchivo: string = body.nombreArchivo ?? 'importacion.xlsx'

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: 'No se recibieron recursos para importar' }, { status: 400 })
    }

    // Create import batch record
    const lote = await prisma.recursoImportBatch.create({
      data: { nombreArchivo, totalFilas: items.length },
    })

    let creados = 0
    let actualizados = 0
    let preciosCambiados = 0
    let omitidos = 0
    const errores: string[] = []

    for (const r of items) {
      if (!r.nombre?.trim()) {
        errores.push(`Recurso sin nombre omitido`)
        continue
      }

      const costoNuevo = parseFloat(String(r.costoUnitario)) || 0

      try {
        // Look up existing resource by código
        const existing = r.codigo?.trim()
          ? await prisma.recurso.findFirst({ where: { codigo: r.codigo.trim() } })
          : null

        if (existing) {
          // Resource already exists
          if (modo === 'solo_crear') {
            omitidos++
            continue
          }

          // Update resource fields
          await prisma.recurso.update({
            where: { id: existing.id },
            data: {
              nombre:       r.nombre.trim(),
              tipo:         r.tipo || existing.tipo,
              categoria:    r.categoria?.trim() || existing.categoria,
              subcategoria: r.subcategoria?.trim() || existing.subcategoria,
              unidad:       r.unidad?.trim() || existing.unidad,
              costoUnitario: costoNuevo,
              proveedor:    r.proveedor?.trim() || existing.proveedor,
              marca:        r.marca?.trim() || existing.marca,
              observaciones: r.observaciones?.trim() || existing.observaciones,
              activo:       r.activo !== undefined ? r.activo : existing.activo,
            },
          })
          actualizados++

          // Record price history only if price actually changed
          if (costoNuevo !== existing.costoUnitario) {
            await prisma.recursoPriceHistory.create({
              data: {
                recursoId:      existing.id,
                codigoSnapshot: existing.codigo,
                nombreSnapshot: existing.nombre,
                precioAnterior: existing.costoUnitario,
                precioNuevo:    costoNuevo,
                moneda:         r.moneda || 'DOP',
                unidadSnapshot: existing.unidad,
                origenCambio:   'importacion',
                loteImportacionId: lote.id,
              },
            })
            preciosCambiados++
          }
        } else {
          // Resource does not exist
          if (modo === 'solo_actualizar') {
            omitidos++
            continue
          }

          await prisma.recurso.create({
            data: {
              codigo:       r.codigo?.trim() || null,
              nombre:       r.nombre.trim(),
              tipo:         r.tipo || 'materiales',
              categoria:    r.categoria?.trim() || null,
              subcategoria: r.subcategoria?.trim() || null,
              unidad:       r.unidad?.trim() || 'ud',
              costoUnitario: costoNuevo,
              proveedor:    r.proveedor?.trim() || null,
              marca:        r.marca?.trim() || null,
              observaciones: r.observaciones?.trim() || null,
              activo:       r.activo !== undefined ? r.activo : true,
            },
          })
          creados++
        }
      } catch {
        errores.push(`Error al procesar "${r.nombre}"`)
      }
    }

    // Update batch with final counts
    await prisma.recursoImportBatch.update({
      where: { id: lote.id },
      data: {
        filasCreadas:     creados,
        filasActualizadas: actualizados,
        filasConError:    errores.length,
        preciosCambiados: preciosCambiados,
      },
    })

    return NextResponse.json({
      loteId: lote.id,
      creados,
      actualizados,
      preciosCambiados,
      omitidos,
      errores,
    })
  } catch (error) {
    console.error('[importar recursos]', error)
    return NextResponse.json({ error: 'Error al importar recursos' }, { status: 500 })
  }
}
