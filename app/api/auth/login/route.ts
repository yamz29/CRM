import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createSessionToken, COOKIE_NAME } from '@/lib/auth'
import bcrypt from 'bcryptjs'

// ── Rate limiter en memoria ────────────────────────────────────────────────────
// 5 intentos fallidos por IP cada 15 minutos
const WINDOW_MS = 15 * 60 * 1000
const MAX_ATTEMPTS = 5

const attempts = new Map<string, { count: number; resetAt: number }>()

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  )
}

function checkRateLimit(ip: string): { blocked: boolean; remaining: number } {
  const now = Date.now()
  const entry = attempts.get(ip)

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 0, resetAt: now + WINDOW_MS })
    return { blocked: false, remaining: MAX_ATTEMPTS }
  }

  if (entry.count >= MAX_ATTEMPTS) {
    return { blocked: true, remaining: 0 }
  }

  return { blocked: false, remaining: MAX_ATTEMPTS - entry.count }
}

function recordFailedAttempt(ip: string) {
  const now = Date.now()
  const entry = attempts.get(ip)
  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS })
  } else {
    entry.count += 1
  }
}

function clearAttempts(ip: string) {
  attempts.delete(ip)
}

// ── Handler ────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest) {
  try {
    const ip = getClientIp(request)
    const { blocked } = checkRateLimit(ip)

    if (blocked) {
      return NextResponse.json(
        { error: 'Demasiados intentos fallidos. Intenta de nuevo en 15 minutos.' },
        { status: 429 }
      )
    }

    const { correo: correoRaw, password } = await request.json()
    const correo = correoRaw?.toLowerCase().trim()

    if (!correo || !password) {
      return NextResponse.json({ error: 'Correo y contraseña son requeridos' }, { status: 400 })
    }

    const usuario = await prisma.usuario.findFirst({
      where: { correo },
    })

    if (!usuario || !usuario.password || !usuario.activo) {
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    const passwordOk = await bcrypt.compare(password, usuario.password)
    if (!passwordOk) {
      recordFailedAttempt(ip)
      return NextResponse.json({ error: 'Credenciales incorrectas' }, { status: 401 })
    }

    // Login exitoso — limpiar intentos fallidos
    clearAttempts(ip)

    const token = await createSessionToken({
      id: usuario.id,
      nombre: usuario.nombre,
      correo: usuario.correo,
      rol: usuario.rol,
    })

    const response = NextResponse.json({
      ok: true,
      user: { id: usuario.id, nombre: usuario.nombre, correo: usuario.correo, rol: usuario.rol },
    })

    response.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    })

    return response
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: 'Error interno del servidor' }, { status: 500 })
  }
}
