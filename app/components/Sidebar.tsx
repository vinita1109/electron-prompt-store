'use client'

import { useMemo } from 'react'
import { Star, Folder, Hash, Filter, Tag as TagIcon } from 'lucide-react'
import { TagChip } from './TagChip'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MODELS
} from '@/shared/types'
import type { PromptFilters } from '../lib/types'

interface SidebarProps {
  filters: PromptFilters
  onChange: (patch: Partial<PromptFilters>) => void
  tags: Array<{ name: string; count: number }>
  categories: string[]
  onOpenSettings: () => void
  totalCount: number
  favoritesCount: number
}

export function Sidebar({
  filters,
  onChange,
  tags,
  categories,
  onOpenSettings,
  totalCount,
  favoritesCount
}: SidebarProps) {
  const mergedCategories = useMemo(() => {
    const set = new Set<string>([...DEFAULT_CATEGORIES, ...categories])
    return Array.from(set)
  }, [categories])

  const selectedCategories = new Set(filters.categories ?? [])
  const selectedTags = new Set(filters.tags ?? [])
  const selectedModels = new Set(filters.modelTargets ?? [])

  const toggle = <K extends keyof PromptFilters>(
    key: K,
    value: string
  ) => {
    const current = (filters[key] as string[] | undefined) ?? []
    const next = current.includes(value)
      ? current.filter((v) => v !== value)
      : [...current, value]
    onChange({ [key]: next } as Partial<PromptFilters>)
  }

  const active =
    (filters.categories?.length ?? 0) +
      (filters.tags?.length ?? 0) +
      (filters.modelTargets?.length ?? 0) +
      (filters.favoritesOnly ? 1 : 0) >
    0

  return (
    <aside className="flex h-full w-60 flex-col border-r border-surface-200 bg-white dark:border-surface-800 dark:bg-surface-900">
      <div className="flex items-center justify-between px-3 py-3 border-b border-surface-200 dark:border-surface-800">
        <div className="flex items-center gap-2">
          <div className="h-6 w-6 rounded-md bg-gradient-to-br from-indigo-500 to-purple-500 flex items-center justify-center">
            <Hash className="h-3.5 w-3.5 text-white" strokeWidth={2.5} />
          </div>
          <span className="text-sm font-semibold">Prompt Library</span>
        </div>
        <button
          type="button"
          onClick={onOpenSettings}
          className="btn-ghost !p-1"
          title="Settings (Cmd/Ctrl+,)"
          aria-label="Open settings"
        >
          <Filter className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-2 py-2 space-y-4">
        <Section title="Library">
          <Row
            icon={<Folder className="h-4 w-4" />}
            label="All prompts"
            count={totalCount}
            active={!active}
            onClick={() =>
              onChange({
                categories: [],
                tags: [],
                modelTargets: [],
                favoritesOnly: false
              })
            }
          />
          <Row
            icon={<Star className="h-4 w-4" />}
            label="Favorites"
            count={favoritesCount}
            active={!!filters.favoritesOnly}
            onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
          />
        </Section>

        <Section title="Categories">
          {mergedCategories.map((c) => (
            <Row
              key={c}
              icon={<Folder className="h-4 w-4" />}
              label={c}
              active={selectedCategories.has(c)}
              onClick={() => toggle('categories', c)}
            />
          ))}
        </Section>

        <Section title="Models">
          {DEFAULT_MODELS.map((m) => (
            <Row
              key={m}
              icon={<span className="mono text-[10px] opacity-60">·</span>}
              label={m}
              active={selectedModels.has(m)}
              onClick={() => toggle('modelTargets', m)}
            />
          ))}
        </Section>

        <Section
          title={
            <span className="flex items-center gap-1.5">
              <TagIcon className="h-3 w-3" />
              <span>Tags</span>
            </span>
          }
        >
          {tags.length === 0 && (
            <p className="px-2 py-1 text-xs text-surface-300 dark:text-surface-800">
              No tags yet
            </p>
          )}
          <div className="flex flex-wrap gap-1.5 px-1 py-1">
            {tags.map((t) => (
              <TagChip
                key={t.name}
                name={`${t.name} · ${t.count}`}
                active={selectedTags.has(t.name)}
                onClick={() => toggle('tags', t.name)}
              />
            ))}
          </div>
        </Section>
      </div>
    </aside>
  )
}

function Section({
  title,
  children
}: {
  title: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="px-2 pb-1 text-[10px] uppercase tracking-wider text-surface-300 dark:text-surface-800 font-semibold">
        {title}
      </div>
      <div className="space-y-0.5">{children}</div>
    </div>
  )
}

function Row({
  icon,
  label,
  count,
  active,
  onClick
}: {
  icon: React.ReactNode
  label: string
  count?: number
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full flex items-center justify-between px-2 py-1 rounded-md text-sm focus-ring transition-colors ${
        active
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
          : 'text-surface-800 hover:bg-surface-100 dark:text-surface-200 dark:hover:bg-surface-800'
      }`}
    >
      <span className="flex items-center gap-2 min-w-0">
        <span className="opacity-70 flex-shrink-0">{icon}</span>
        <span className="truncate">{label}</span>
      </span>
      {typeof count === 'number' && (
        <span className="text-[11px] text-surface-300 dark:text-surface-800 ml-2">
          {count}
        </span>
      )}
    </button>
  )
}
