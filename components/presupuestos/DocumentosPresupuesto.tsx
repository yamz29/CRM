'use client'

import { useState, useEffect } from 'react'
import { FolderOpen, ExternalLink } from 'lucide-react'
import { SharePointUploader, guessCategory } from '@/components/documentos/SharePointUploader'
import { sanitizeFolderName } from '@/lib/sharepoint'
import { formatFileSize, type OneDriveItem } from '@/lib/onedrive'

interface Doc {
  id: number
  nombre: string
  categoria: string
  url: string
  createdAt: string
}

interface Props {
  oportunidadId: number | null
  clienteNombre: string
  /** Use oportunidad name or presupuesto number for folder */
  folderName: string
}

export function DocumentosPresupuesto({ oportunidadId, clienteNombre, folderName }: Props) {
  const [docs, setDocs] = useState<Doc[]>([])
  const [loaded, setLoaded] = useState(false)

  function loadDocs() {
    if (!oportunidadId) return
    fetch(`/api/documentos?oportunidadId=${oportunidadId}`)
      .then(r => r.json())
      .then(data => { setDocs(data); setLoaded(true) })
  }

  useEffect(() => { loadDocs() }, [oportunidadId]) // eslint-disable-line react-hooks/exhaustive-deps

  const spPath = `CRM/${sanitizeFolderName(clienteNombre)}/${sanitizeFolderName(folderName)}`

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <FolderOpen className="w-4 h-4 text-muted-foreground" />
          Documentos
        </h3>
        {oportunidadId && (
          <a href="/documentos" className="text-xs text-primary hover:underline">Ver todos</a>
        )}
      </div>

      {/* Upload zone */}
      <SharePointUploader
        folderPath={spPath}
        onUploaded={(item: OneDriveItem, shareUrl: string) => {
          const payload: Record<string, unknown> = {
            nombre: item.name.replace(/\.[^.]+$/, ''),
            url: shareUrl,
            categoria: guessCategory(item.name),
            tamanioRef: formatFileSize(item.size),
          }
          if (oportunidadId) payload.oportunidadId = oportunidadId
          fetch('/api/documentos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          }).then(() => loadDocs())
        }}
        label="Subir documento a SharePoint"
      />

      {/* Existing docs */}
      {loaded && docs.length > 0 && (
        <div className="space-y-1">
          {docs.map(d => (
            <div key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/30 group">
              <FolderOpen className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <a href={d.url} target="_blank" rel="noopener noreferrer"
                  className="text-xs font-medium text-foreground hover:text-primary transition-colors truncate block">
                  {d.nombre}
                </a>
                <span className="text-[10px] text-muted-foreground">{d.categoria}</span>
              </div>
              <a href={d.url} target="_blank" rel="noopener noreferrer"
                className="p-1 text-muted-foreground hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          ))}
        </div>
      )}

      {loaded && docs.length === 0 && oportunidadId && (
        <p className="text-xs text-muted-foreground">Sin documentos vinculados a la oportunidad.</p>
      )}

      {!oportunidadId && (
        <p className="text-xs text-muted-foreground">Este presupuesto no está vinculado a una oportunidad.</p>
      )}
    </div>
  )
}
