'use client'

import { X } from 'lucide-react'
import { tagColor } from '../lib/api'

interface TagChipProps {
  name: string
  onRemove?: () => void
  onClick?: () => void
  active?: boolean
  size?: 'sm' | 'md'
}

export function TagChip({
  name,
  onRemove,
  onClick,
  active,
  size = 'sm'
}: TagChipProps) {
  const color = tagColor(name)
  const base =
    size === 'sm'
      ? 'text-[11px] px-1.5 py-0.5'
      : 'text-xs px-2 py-1'

  return (
    <span
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={(e) => {
        if (!onClick) return
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick()
        }
      }}
      className={`inline-flex items-center gap-1 rounded-full font-medium transition-all focus-ring ${base} ${
        onClick ? 'cursor-pointer hover:brightness-105' : ''
      } ${active ? 'ring-2 ring-offset-1 ring-offset-transparent' : ''}`}
      style={{
        backgroundColor: color.bg,
        color: color.fg,
        boxShadow: active ? `0 0 0 2px ${color.ring}` : undefined
      }}
    >
      <span className="truncate max-w-[120px]">{name}</span>
      {onRemove && (
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onRemove()
          }}
          className="ml-0.5 rounded-full opacity-60 hover:opacity-100"
          aria-label={`Remove tag ${name}`}
        >
          <X className="h-3 w-3" strokeWidth={2.5} />
        </button>
      )}
    </span>
  )
}
