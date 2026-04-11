'use client'

import { useEffect } from 'react'
import { broadcastResponseToMainFrame } from '@azure/msal-browser/redirect-bridge'

/**
 * MSAL v5 popup redirect bridge page.
 * When Microsoft redirects the popup here after authentication,
 * broadcastResponseToMainFrame() sends the auth response to the
 * parent window via BroadcastChannel and closes the popup.
 */
export default function AuthRedirectPage() {
  useEffect(() => {
    broadcastResponseToMainFrame().catch((e) => {
      console.error('MSAL redirect bridge error:', e)
    })
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <p style={{ color: '#888' }}>Autenticando...</p>
    </div>
  )
}
