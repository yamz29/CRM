'use client'

import { useEffect } from 'react'
import { getMsalInstance } from '@/lib/msal-config'

/**
 * Popup redirect page for MSAL authentication.
 * When Microsoft redirects the popup back here, MSAL processes
 * the auth response and communicates it to the parent window.
 */
export default function AuthRedirectPage() {
  useEffect(() => {
    async function handle() {
      try {
        const msal = getMsalInstance()
        await msal.initialize()
        await msal.handleRedirectPromise()
      } catch (e) {
        console.error('Auth redirect handling error:', e)
      }
    }
    handle()
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#888' }}>Autenticando...</p>
    </div>
  )
}
