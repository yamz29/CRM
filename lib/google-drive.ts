import { google } from 'googleapis'
import { Readable } from 'stream'

function getAuth() {
  const keyJson = process.env.GOOGLE_SERVICE_ACCOUNT_KEY
  if (!keyJson) return null

  try {
    const key = JSON.parse(keyJson)
    return new google.auth.GoogleAuth({
      credentials: key,
      scopes: ['https://www.googleapis.com/auth/drive.file'],
    })
  } catch {
    console.error('Error parsing GOOGLE_SERVICE_ACCOUNT_KEY')
    return null
  }
}

/**
 * Upload a file to Google Drive and return the web view link.
 * Returns null if Drive is not configured.
 */
export async function uploadToDrive(
  fileBuffer: Buffer,
  fileName: string,
  mimeType: string,
): Promise<string | null> {
  const auth = getAuth()
  if (!auth) return null

  const folderId = process.env.GOOGLE_DRIVE_FOLDER_ID
  if (!folderId) return null

  const drive = google.drive({ version: 'v3', auth })

  const res = await drive.files.create({
    requestBody: {
      name: fileName,
      parents: [folderId],
    },
    media: {
      mimeType,
      body: Readable.from(fileBuffer),
    },
    fields: 'id, webViewLink',
  })

  // Make it viewable by anyone with the link
  if (res.data.id) {
    await drive.permissions.create({
      fileId: res.data.id,
      requestBody: {
        role: 'reader',
        type: 'anyone',
      },
    })
  }

  return res.data.webViewLink || `https://drive.google.com/file/d/${res.data.id}/view`
}
