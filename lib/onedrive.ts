import { getMsalInstance, graphScopes } from './msal-config'

const GRAPH_BASE = 'https://graph.microsoft.com/v1.0'

// ── Auth ─────────────────────────────────────────────────────────────────

let msalInitialized = false

/** Clear stale MSAL interaction flags from browser storage */
function clearMsalInteractionState() {
  if (typeof sessionStorage === 'undefined') return
  for (const key of Object.keys(sessionStorage)) {
    if (key.includes('msal') && key.includes('interaction')) {
      sessionStorage.removeItem(key)
    }
  }
}

export async function initMsal(): Promise<void> {
  if (msalInitialized) return
  const msal = getMsalInstance()
  await msal.initialize()
  try {
    await msal.handleRedirectPromise()
  } catch {
    // Ignore
  }
  msalInitialized = true
}

export async function getAccessToken(): Promise<string | null> {
  await initMsal()
  const msal = getMsalInstance()

  const accounts = msal.getAllAccounts()
  if (accounts.length > 0) {
    try {
      const result = await msal.acquireTokenSilent({ scopes: graphScopes, account: accounts[0] })
      return result.accessToken
    } catch {
      // Token expired, try popup
      try {
        clearMsalInteractionState()
        const result = await msal.acquireTokenPopup({ scopes: graphScopes })
        return result.accessToken
      } catch (e) {
        console.error('MSAL acquireTokenPopup error:', e)
        return null
      }
    }
  }

  return null
}

export async function loginOneDrive(): Promise<boolean> {
  await initMsal()
  const msal = getMsalInstance()

  // Clear any stale interaction_in_progress flags from previous attempts
  clearMsalInteractionState()

  try {
    const result = await msal.loginPopup({ scopes: graphScopes })
    console.log('MSAL login success:', result.account?.username)
    return !!result.account
  } catch (e) {
    console.error('MSAL login error:', e)
    // Fallback: try redirect
    try {
      clearMsalInteractionState()
      await msal.loginRedirect({ scopes: graphScopes })
      return false
    } catch (e2) {
      console.error('MSAL redirect error:', e2)
      return false
    }
  }
}

export function isLoggedIn(): boolean {
  try {
    const msal = getMsalInstance()
    return msal.getAllAccounts().length > 0
  } catch {
    return false
  }
}

export async function logoutOneDrive(): Promise<void> {
  await initMsal()
  const msal = getMsalInstance()
  const accounts = msal.getAllAccounts()
  if (accounts.length > 0) {
    try {
      await msal.logoutPopup({ account: accounts[0] })
    } catch {
      // If popup fails, clear accounts manually
      msal.setActiveAccount(null)
    }
  }
  msalInitialized = false
}

// ── Graph API helpers ────────────────────────────────────────────────────

async function graphGet(path: string): Promise<Record<string, unknown> | null> {
  const token = await getAccessToken()
  if (!token) return null

  const res = await fetch(`${GRAPH_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  if (!res.ok) {
    console.error('Graph API error:', res.status, await res.text().catch(() => ''))
    return null
  }
  return res.json()
}

// ── Types ────────────────────────────────────────────────────────────────

export interface OneDriveItem {
  id: string
  name: string
  size: number
  webUrl: string
  lastModifiedDateTime: string
  folder?: { childCount: number }
  file?: { mimeType: string }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  thumbnails?: any[]
  '@microsoft.graph.downloadUrl'?: string
}

// ── File operations ──────────────────────────────────────────────────────

export async function listRootFiles(): Promise<OneDriveItem[]> {
  const data = await graphGet('/me/drive/root/children?$top=200&$orderby=name')
  return ((data as Record<string, unknown>)?.value as OneDriveItem[]) ?? []
}

export async function listFolderFiles(folderId: string): Promise<OneDriveItem[]> {
  const data = await graphGet(`/me/drive/items/${folderId}/children?$top=200&$orderby=name`)
  return ((data as Record<string, unknown>)?.value as OneDriveItem[]) ?? []
}

export async function getEmbedUrl(itemId: string): Promise<string | null> {
  const data = await graphGet(`/me/drive/items/${itemId}/preview`)
  return ((data as Record<string, unknown>)?.getUrl as string) ?? null
}

export async function getItemShareLink(itemId: string): Promise<string | null> {
  const token = await getAccessToken()
  if (!token) return null

  const res = await fetch(`${GRAPH_BASE}/me/drive/items/${itemId}/createLink`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ type: 'view', scope: 'organization' }),
  })

  if (!res.ok) return null
  const data = await res.json()
  return data?.link?.webUrl ?? null
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

export function getFileIcon(name: string, mimeType?: string): 'pdf' | 'image' | 'excel' | 'word' | 'ppt' | 'folder' | 'file' {
  if (mimeType?.startsWith('image/')) return 'image'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (ext === 'pdf') return 'pdf'
  if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp'].includes(ext)) return 'image'
  if (['xlsx', 'xls', 'csv'].includes(ext)) return 'excel'
  if (['docx', 'doc'].includes(ext)) return 'word'
  if (['pptx', 'ppt'].includes(ext)) return 'ppt'
  return 'file'
}
