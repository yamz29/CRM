'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Download, Loader2 } from 'lucide-react'

interface ExportButtonProps {
  href: string
  label?: string
}

export function ExportButton({ href, label = 'Exportar Excel' }: ExportButtonProps) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const res = await fetch(href)
      if (!res.ok) throw new Error('Error al exportar')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      const disposition = res.headers.get('Content-Disposition') ?? ''
      const match = disposition.match(/filename="([^"]+)"/)
      a.href = url
      a.download = match?.[1] ?? 'export.xlsx'
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      alert('Error al exportar')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="secondary" onClick={handleExport} disabled={loading}>
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
      {label}
    </Button>
  )
}
