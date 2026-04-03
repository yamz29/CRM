'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { FileSpreadsheet } from 'lucide-react'
import ImportarRecursosModal from './ImportarRecursosModal'

export function RecursosPageClient() {
  const [open, setOpen] = useState(false)
  const router = useRouter()

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-foreground bg-card border border-border rounded-lg hover:bg-muted transition-colors"
      >
        <FileSpreadsheet className="w-4 h-4 text-green-600" />
        Importar Excel
      </button>

      {open && (
        <ImportarRecursosModal
          onClose={() => setOpen(false)}
          onImported={() => { setOpen(false); router.refresh() }}
        />
      )}
    </>
  )
}
