'use client'

import { useEffect, useState } from 'react'
import { CheckCircle, X } from 'lucide-react'

interface SuccessBannerProps {
  mensaje: string
}

export function SuccessBanner({ mensaje }: SuccessBannerProps) {
  const [visible, setVisible] = useState(true)

  useEffect(() => {
    const timer = setTimeout(() => setVisible(false), 4000)
    return () => clearTimeout(timer)
  }, [])

  if (!visible) return null

  return (
    <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm animate-in fade-in slide-in-from-top-2 duration-300">
      <div className="flex items-center gap-2">
        <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
        <span className="font-medium">{mensaje}</span>
      </div>
      <button
        onClick={() => setVisible(false)}
        className="text-green-600 hover:text-green-800 ml-4"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  )
}
