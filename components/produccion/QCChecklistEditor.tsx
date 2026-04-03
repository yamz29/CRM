'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Circle, Loader2 } from 'lucide-react'

interface QCItem {
  item: string
  checked: boolean
  checkedBy?: number
  checkedAt?: string
}

interface Props {
  title: string
  checklistJson: string | null
  ordenId: number
  itemId: number
  field: 'checklistQCProceso' | 'checklistQCFinal'
  readOnly?: boolean
}

export function QCChecklistEditor({ title, checklistJson, ordenId, itemId, field, readOnly }: Props) {
  const router = useRouter()
  const [saving, setSaving] = useState(false)

  let items: QCItem[] = []
  try {
    items = checklistJson ? JSON.parse(checklistJson) : []
  } catch {
    items = []
  }

  const checkedCount = items.filter(i => i.checked).length
  const allChecked = items.length > 0 && checkedCount === items.length

  async function toggleItem(idx: number) {
    if (readOnly) return
    setSaving(true)
    const updated = items.map((item, i) => {
      if (i !== idx) return item
      return {
        ...item,
        checked: !item.checked,
        checkedAt: !item.checked ? new Date().toISOString() : undefined,
      }
    })

    await fetch(`/api/produccion/${ordenId}/items/${itemId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ [field]: updated }),
    })

    router.refresh()
    setSaving(false)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-foreground flex items-center gap-2">
          {allChecked ? (
            <CheckCircle2 className="w-4 h-4 text-green-500" />
          ) : (
            <Circle className="w-4 h-4 text-muted-foreground" />
          )}
          {title}
          <span className="text-xs text-muted-foreground font-normal">({checkedCount}/{items.length})</span>
        </h4>
        {saving && <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />}
      </div>
      <div className="space-y-1 pl-1">
        {items.map((qcItem, idx) => (
          <label
            key={idx}
            className={`flex items-center gap-2.5 p-2 rounded-lg transition-colors ${
              readOnly ? 'cursor-default' : 'cursor-pointer hover:bg-muted/30'
            } ${qcItem.checked ? 'opacity-70' : ''}`}
          >
            <input
              type="checkbox"
              checked={qcItem.checked}
              onChange={() => toggleItem(idx)}
              disabled={readOnly || saving}
              className="accent-primary w-4 h-4"
            />
            <span className={`text-sm ${qcItem.checked ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
              {qcItem.item}
            </span>
          </label>
        ))}
      </div>
    </div>
  )
}
