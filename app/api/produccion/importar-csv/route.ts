import { NextRequest, NextResponse } from 'next/server'
import { parseCsvDespiece } from '@/lib/produccion-csv'
import { withPermiso } from '@/lib/with-permiso'

/**
 * POST /api/produccion/importar-csv
 *
 * Parser en modo dry-run: recibe un archivo CSV, lo parsea y devuelve
 * los items detectados + errores + resumen por material para preview.
 * NO crea nada en DB. El guardado real lo hace POST /api/produccion con modo='csv'.
 *
 * Body: multipart/form-data con campo 'archivo' (File) o body JSON con { csv: string }
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
      csvText = await file.text()
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
    return NextResponse.json({ error: 'Error al parsear el CSV' }, { status: 500 })
  }
})
