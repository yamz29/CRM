import { PublicClientApplication, Configuration } from '@azure/msal-browser'

const msalConfig: Configuration = {
  auth: {
    clientId: process.env.NEXT_PUBLIC_AZURE_CLIENT_ID || '',
    authority: `https://login.microsoftonline.com/${process.env.NEXT_PUBLIC_AZURE_TENANT_ID || 'common'}`,
    redirectUri: typeof window !== 'undefined' ? `${window.location.origin}/auth-redirect` : '',
  },
  cache: {
    cacheLocation: 'localStorage',
  },
}

let msalInstance: PublicClientApplication | null = null

export function getMsalInstance(): PublicClientApplication {
  if (!msalInstance) {
    msalInstance = new PublicClientApplication(msalConfig)
  }
  return msalInstance
}

export const graphScopes = ['Files.Read.All', 'Files.ReadWrite.All', 'Sites.Read.All']
