import { NextRequest, NextResponse } from 'next/server'
import * as XLSX from 'xlsx'
import { parseCsvDespiece } from '@/lib/produccion-csv'
import { withPermiso } from '@/lib/with-permiso'

/**
 * POST /api/produccion/importar-csv
 *
 * Parser en modo dry-run: recibe un archivo CSV o XLSX, lo parsea y
 * devuelve los items detectados + errores + resumen por material.
 * NO crea nada en DB. El guardado real lo hace POST /api/produccion con modo='csv'.
 *
 * Body: multipart/form-data con campo 'archivo' (File) o body JSON con { csv: string }
 *
 * Acepta:
 *   - .csv (cualquier encoding, separador ; o ,)
 *   - .xlsx / .xls (primera hoja, o primera que tenga 'pieza'/'despiece' en el nombre)
 */
export const POST = withPermiso('produccion', 'editar', async (req: NextRequest) => {
  try {
    let csvText: string

    const contentType = req.headers.get('content-type') ?? ''
    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData()
      const file = formData.get('archivo') as File | null
      if (!file || file.size === 0) {
        return NextResponse.json({ error: 'No se recibió archivo' }, { status: 400 })
      }
      if (file.size > 5 * 1024 * 1024) {
        return NextResponse.json({ error: 'El archivo supera 5 MB' }, { status: 400 })
      }

      const fileName = (file.name || '').toLowerCase()
      const isXlsx = fileName.endsWith('.xlsx') || fileName.endsWith('.xls')

      if (isXlsx) {
        // Convertir XLSX → CSV reusando el parser existente
        const buf = Buffer.from(await file.arrayBuffer())
        const wb = XLSX.read(buf, { type: 'buffer' })
        // Elegir hoja: la primera que se llame como 'Piezas' / 'Despiece', o la primera
        const sheetName =
          wb.SheetNames.find(n => /piezas|despiece/i.test(n)) ?? wb.SheetNames[0]
        if (!sheetName) {
          return NextResponse.json({ error: 'El XLSX no tiene hojas' }, { status: 400 })
        }
        const ws = wb.Sheets[sheetName]
        // Generar CSV con ; como separador (lo que espera el parser por defecto en ES)
        csvText = XLSX.utils.sheet_to_csv(ws, { FS: ';' })
      } else {
        csvText = await file.text()
      }
    } else {
      const body = await req.json()
      if (typeof body?.csv !== 'string') {
        return NextResponse.json({ error: 'Falta campo "csv"' }, { status: 400 })
      }
      csvText = body.csv
    }

    const result = parseCsvDespiece(csvText)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[POST /api/produccion/importar-csv]', err)
    return NextResponse.json({ error: 'Error al parsear el archivo' }, { status: 500 })
  }
})
