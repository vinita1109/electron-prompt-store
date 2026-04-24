'use client'

import { Star } from 'lucide-react'
import { TagChip } from './TagChip'
import type { Prompt } from '../lib/types'
import { formatRelative } from '../lib/api'

interface PromptListProps {
  prompts: Prompt[]
  selectedId: string | null
  onSelect: (id: string) => void
  searchActive: boolean
  onCreate: () => void
}

export function PromptList({
  prompts,
  selectedId,
  onSelect,
  searchActive,
  onCreate
}: PromptListProps) {
  if (prompts.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-3 p-8 text-center">
        <p className="text-sm text-surface-500 dark:text-surface-300 font-medium">
          {searchActive ? 'No prompts match your filters.' : 'Your library is empty.'}
        </p>
        <button type="button" onClick={onCreate} className="btn-primary">
          New Prompt
        </button>
      </div>
    )
  }

  return (
    <ul className="divide-y divide-surface-100 dark:divide-surface-800 overflow-y-auto h-full">
      {prompts.map((p) => (
        <li key={p.id}>
          <button
            type="button"
            onClick={() => onSelect(p.id)}
            className={`w-full text-left px-3 py-2.5 transition-colors focus-ring ${
              selectedId === p.id
                ? 'bg-indigo-50/80 dark:bg-indigo-950/40'
                : 'hover:bg-surface-50 dark:hover:bg-surface-800/60'
            }`}
          >
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  {p.isFavorite && (
                    <Star
                      className="h-3.5 w-3.5 flex-shrink-0 text-amber-500"
                      fill="currentColor"
                      strokeWidth={0}
                    />
                  )}
                  <h3 className="font-medium text-sm truncate text-surface-900 dark:text-surface-100">
                    {p.title}
                  </h3>
                </div>
                <p className="mt-0.5 text-xs text-surface-500 dark:text-surface-300 line-clamp-2">
                  {p.description || p.content.slice(0, 160)}
                </p>
                <div className="mt-1.5 flex flex-wrap items-center gap-1">
                  <span className="text-[10px] uppercase tracking-wider text-surface-300 dark:text-surface-800">
                    {p.category}
                  </span>
                  <span className="text-[10px] text-surface-300 dark:text-surface-800">
                    ·
                  </span>
                  <span className="text-[10px] text-surface-300 dark:text-surface-800">
                    {p.modelTarget}
                  </span>
                  <span className="text-[10px] text-surface-300 dark:text-surface-800">
                    ·
                  </span>
                  <span className="text-[10px] text-surface-300 dark:text-surface-800 tabular-nums">
                    {formatRelative(p.updatedAt)}
                  </span>
                </div>
                {p.tags.length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {p.tags.slice(0, 4).map((t) => (
                      <TagChip key={t} name={t} />
                    ))}
                    {p.tags.length > 4 && (
                      <span className="text-[10px] text-surface-300 dark:text-surface-800">
                        +{p.tags.length - 4}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          </button>
        </li>
      ))}
    </ul>
  )
}
