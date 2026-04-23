import { NextResponse, NextRequest } from 'next/server'
import { readFileSync } from 'fs'
import path from 'path'
import { withPermiso } from '@/lib/with-permiso'

type Ctx = Params

type Params = { params: Promise<{ slug: string }> }

export const GET = withPermiso('dashboard', 'ver', async (_req: NextRequest, { params }: Ctx) => {
  try {
    const { slug } = await params
    // Sanitize: only allow alphanumeric + hyphens
    if (!/^[a-z0-9-]+$/.test(slug)) {
      return NextResponse.json({ error: 'Slug inválido' }, { status: 400 })
    }
    const filePath = path.join(process.cwd(), 'content', 'help', `${slug}.md`)
    const content = readFileSync(filePath, 'utf-8')
    return NextResponse.json({ content })
  } catch {
    return NextResponse.json({ error: 'Artículo no encontrado' }, { status: 404 })
  }
})
