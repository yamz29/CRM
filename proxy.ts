import { NextRequest, NextResponse } from 'next/server'
import { jwtVerify } from 'jose'

const COOKIE_NAME = 'crm_session'

const PUBLIC_PATHS = ['/login', '/api/auth/login', '/api/auth/logout']
const STATIC_PREFIXES = ['/_next', '/favicon.ico', '/uploads']

function getSecret(): Uint8Array {
  return new TextEncoder().encode(process.env.JWT_SECRET || 'gonzalva-group-crm-jwt-secret-2025-xK9mP2qL')
}

export default async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Skip static and public paths
  if (STATIC_PREFIXES.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Inject x-pathname for server components
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  // Skip auth check for public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // API routes - skip heavy auth, let the route handle it if needed
  if (pathname.startsWith('/api/')) {
    const token = request.cookies.get(COOKIE_NAME)?.value
    if (token) {
      try {
        const { payload } = await jwtVerify(token, getSecret())
        requestHeaders.set('x-user-id', String(payload.id ?? ''))
        requestHeaders.set('x-user-nombre', String(payload.nombre ?? ''))
        requestHeaders.set('x-user-correo', String(payload.correo ?? ''))
      } catch { /* invalid token, but still allow API (optional protection) */ }
    }
    return NextResponse.next({ request: { headers: requestHeaders } })
  }

  // Protected page routes — require valid session
  const token = request.cookies.get(COOKIE_NAME)?.value

  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  try {
    const { payload } = await jwtVerify(token, getSecret())
    requestHeaders.set('x-user-id', String(payload.id ?? ''))
    requestHeaders.set('x-user-nombre', String(payload.nombre ?? ''))
    requestHeaders.set('x-user-correo', String(payload.correo ?? ''))
    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    // Invalid/expired session → send to login and clear cookie
    const response = NextResponse.redirect(new URL('/login', request.url))
    response.cookies.set(COOKIE_NAME, '', { maxAge: 0, path: '/' })
    return response
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|uploads/).*)'],
}
