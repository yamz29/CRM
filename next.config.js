/** @type {import('next').NextConfig} */
const nextConfig = {
  compress: true,
  poweredByHeader: false,
  images: {
    formats: ['image/webp'],
  },
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
