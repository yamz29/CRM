import { NextRequest, NextResponse } from 'next/server'

// OCR con Gemini Vision — desactivado por decisión del usuario
// El código completo se puede restaurar desde git history si se necesita reactivar

export async function POST(_request: NextRequest) {
  return NextResponse.json(
    { error: 'OCR no disponible. Ingrese los datos de la factura manualmente.' },
    { status: 501 }
  )
}
