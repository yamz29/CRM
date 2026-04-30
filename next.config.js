/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/webp'],
  },
  // Paquetes que Turbopack NO debe bundlear; se cargan como require() externos
  // en runtime. Necesarios cuando el paquete usa código nativo, dynamic imports
  // o expone múltiples archivos según condiciones del runtime:
  //   · jspdf / html2canvas / fflate → fflate/lib/node.cjs usa `new Worker(c, { eval: true })`
  //     que Turbopack no puede resolver.
  //   · web-push → tiene módulos nativos (crypto bindings) y usa require condicional.
  serverExternalPackages: ['jspdf', 'html2canvas', 'fflate', 'web-push'],
  // Nota sobre "Failed to find Server Action" errors en logs:
  // Next.js lee NEXT_SERVER_ACTIONS_ENCRYPTION_KEY de env vars automáticamente.
  // Definirlo en .env.server hace que los IDs de Server Actions sean estables
  // entre builds, evitando que pestañas abiertas tiren ese error tras un deploy.
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Frame-Options',           value: 'DENY' },
          { key: 'X-Content-Type-Options',     value: 'nosniff' },
          { key: 'Referrer-Policy',            value: 'strict-origin-when-cross-origin' },
          { key: 'Strict-Transport-Security',  value: 'max-age=63072000; includeSubDomains' },
          { key: 'X-DNS-Prefetch-Control',     value: 'on' },
          { key: 'Content-Security-Policy',    value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.sharepoint.com https://*.microsoft.com; font-src 'self' data:; connect-src 'self' https://login.microsoftonline.com https://graph.microsoft.com; frame-src 'self' https://*.sharepoint.com https://*.microsoft.com https://login.microsoftonline.com https://docs.google.com https://drive.google.com; frame-ancestors 'none'" },
          { key: 'Permissions-Policy',         value: 'camera=(), microphone=(), geolocation=(), payment=()' },
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ]
  },
}

module.exports = nextConfig
