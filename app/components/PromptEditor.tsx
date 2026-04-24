'use client'

import { useEffect, useRef, useState } from 'react'
import {
  Copy,
  Star,
  Trash2,
  Files,
  FileDown,
  Save,
  Plus
} from 'lucide-react'
import type { Prompt, PromptInput } from '../lib/types'
import {
  DEFAULT_CATEGORIES,
  DEFAULT_MODELS
} from '@/shared/types'
import { TagChip } from './TagChip'
import { AttachmentList } from './AttachmentList'
import { api, formatRelative } from '../lib/api'
import { useToast } from '../lib/store'

interface PromptEditorProps {
  prompt: Prompt | null
  allTags: string[]
  onSaved: (saved: Prompt) => void
  onDeleted: (id: string) => void
  onDuplicated: (next: Prompt) => void
}

interface Draft {
  title: string
  content: string
  description: string
  category: string
  modelTarget: string
  isFavorite: boolean
  tags: string[]
  attachmentPaths: string[]
}

function emptyDraft(): Draft {
  return {
    title: '',
    content: '',
    description: '',
    category: 'Other',
    modelTarget: 'Any',
    isFavorite: false,
    tags: [],
    attachmentPaths: []
  }
}

function promptToDraft(p: Prompt): Draft {
  return {
    title: p.title,
    content: p.content,
    description: p.description,
    category: p.category,
    modelTarget: p.modelTarget,
    isFavorite: p.isFavorite,
    tags: [...p.tags],
    attachmentPaths: [...p.attachmentPaths]
  }
}

function draftEquals(a: Draft, b: Draft): boolean {
  return (
    a.title === b.title &&
    a.content === b.content &&
    a.description === b.description &&
    a.category === b.category &&
    a.modelTarget === b.modelTarget &&
    a.isFavorite === b.isFavorite &&
    a.tags.join('|') === b.tags.join('|') &&
    a.attachmentPaths.join('|') === b.attachmentPaths.join('|')
  )
}

export function PromptEditor({
  prompt,
  allTags,
  onSaved,
  onDeleted,
  onDuplicated
}: PromptEditorProps) {
  const [draft, setDraft] = useState<Draft>(() =>
    prompt ? promptToDraft(prompt) : emptyDraft()
  )
  const [baseline, setBaseline] = useState<Draft>(() =>
    prompt ? promptToDraft(prompt) : emptyDraft()
  )
  const [saving, setSaving] = useState(false)
  const [tagInput, setTagInput] = useState('')
  const [showSuggest, setShowSuggest] = useState(false)
  const toast = useToast()
  const titleRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (prompt) {
      const d = promptToDraft(prompt)
      setDraft(d)
      setBaseline(d)
    } else {
      const d = emptyDraft()
      setDraft(d)
      setBaseline(d)
    }
  }, [prompt?.id, prompt?.updatedAt])

  const dirty = !draftEquals(draft, baseline)
  const canSave = draft.title.trim().length > 0 && draft.content.length > 0

  const save = async () => {
    if (!canSave || saving) return
    setSaving(true)
    try {
      const input: PromptInput = {
        title: draft.title.trim(),
        content: draft.content,
        description: draft.description,
        category: draft.category,
        modelTarget: draft.modelTarget,
        isFavorite: draft.isFavorite,
        tags: draft.tags,
        attachmentPaths: draft.attachmentPaths
      }
      const saved = prompt
        ? await api.prompts.update(prompt.id, input)
        : await api.prompts.create(input)
      onSaved(saved)
      toast.push({
        kind: 'success',
        title: prompt ? 'Prompt updated' : 'Prompt created',
        description: saved.title
      })
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Save failed',
        description: (e as Error).message
      })
    } finally {
      setSaving(false)
    }
  }

  const doCopy = async () => {
    try {
      await api.clipboard.write(draft.content)
      toast.push({ kind: 'success', title: 'Copied to clipboard' })
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Copy failed',
        description: (e as Error).message
      })
    }
  }

  const doDelete = async () => {
    if (!prompt) return
    if (!confirm(`Delete "${prompt.title}"? This cannot be undone.`)) return
    try {
      await api.prompts.remove(prompt.id)
      onDeleted(prompt.id)
      toast.push({ kind: 'success', title: 'Prompt deleted' })
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Delete failed',
        description: (e as Error).message
      })
    }
  }

  const doDuplicate = async () => {
    if (!prompt) return
    try {
      const dup = await api.prompts.duplicate(prompt.id)
      onDuplicated(dup)
      toast.push({ kind: 'success', title: 'Duplicated', description: dup.title })
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Duplicate failed',
        description: (e as Error).message
      })
    }
  }

  const doExportMarkdown = async () => {
    if (!prompt) return
    try {
      const res = await api.fs.exportMarkdown(prompt.id)
      toast.push({
        kind: 'success',
        title: 'Exported as Markdown',
        description: res.path
      })
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Export failed',
        description: (e as Error).message
      })
    }
  }

  const addTag = (raw: string) => {
    const name = raw.trim()
    if (!name) return
    if (draft.tags.some((t) => t.toLowerCase() === name.toLowerCase())) return
    setDraft((d) => ({ ...d, tags: [...d.tags, name] }))
    setTagInput('')
  }

  const removeTag = (name: string) => {
    setDraft((d) => ({ ...d, tags: d.tags.filter((t) => t !== name) }))
  }

  const suggestions = tagInput.trim()
    ? allTags
        .filter(
          (t) =>
            t.toLowerCase().includes(tagInput.toLowerCase()) &&
            !draft.tags.includes(t)
        )
        .slice(0, 6)
    : []

  const categories = Array.from(
    new Set([...DEFAULT_CATEGORIES, draft.category].filter(Boolean))
  )

  useEffect(() => {
    if (!prompt) {
      titleRef.current?.focus()
    }
  }, [prompt?.id])

  return (
    <section className="flex h-full flex-col overflow-hidden">
      <header className="flex items-center gap-2 border-b border-surface-200 px-4 py-2.5 dark:border-surface-800">
        <button
          type="button"
          onClick={() => setDraft((d) => ({ ...d, isFavorite: !d.isFavorite }))}
          className="btn-ghost !p-1.5"
          aria-label="Toggle favorite"
          title={draft.isFavorite ? 'Unfavorite' : 'Favorite'}
        >
          <Star
            className={`h-4 w-4 ${draft.isFavorite ? 'text-amber-500' : ''}`}
            fill={draft.isFavorite ? 'currentColor' : 'none'}
            strokeWidth={draft.isFavorite ? 0 : 2}
          />
        </button>
        <div className="flex-1 text-xs text-surface-300 dark:text-surface-800 tabular-nums truncate">
          {prompt ? `Updated ${formatRelative(prompt.updatedAt)}` : 'New prompt'}
        </div>
        <button type="button" onClick={doCopy} className="btn-secondary" disabled={!draft.content}>
          <Copy className="h-3.5 w-3.5" /> Copy
        </button>
        {prompt && (
          <>
            <button type="button" onClick={doDuplicate} className="btn-secondary">
              <Files className="h-3.5 w-3.5" /> Duplicate
            </button>
            <button
              type="button"
              onClick={doExportMarkdown}
              className="btn-secondary"
            >
              <FileDown className="h-3.5 w-3.5" /> Export .md
            </button>
            <button
              type="button"
              onClick={doDelete}
              className="btn-ghost text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/50"
              aria-label="Delete prompt"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </>
        )}
        <button
          type="button"
          onClick={save}
          disabled={!canSave || !dirty || saving}
          className="btn-primary"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Saving…' : dirty ? 'Save' : 'Saved'}
        </button>
      </header>

      <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
        <input
          ref={titleRef}
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          placeholder="Prompt title"
          className="w-full bg-transparent text-2xl font-semibold outline-none placeholder:text-surface-300 dark:placeholder:text-surface-800"
        />
        <input
          value={draft.description}
          onChange={(e) =>
            setDraft((d) => ({ ...d, description: e.target.value }))
          }
          placeholder="Short description (optional)"
          className="w-full bg-transparent text-sm text-surface-500 dark:text-surface-300 outline-none placeholder:text-surface-300 dark:placeholder:text-surface-800"
        />

        <div className="flex flex-wrap gap-3">
          <label className="flex flex-col gap-1 text-xs text-surface-500 dark:text-surface-300">
            <span className="font-medium">Category</span>
            <select
              value={draft.category}
              onChange={(e) =>
                setDraft((d) => ({ ...d, category: e.target.value }))
              }
              className="field !py-1"
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-xs text-surface-500 dark:text-surface-300">
            <span className="font-medium">Model target</span>
            <select
              value={draft.modelTarget}
              onChange={(e) =>
                setDraft((d) => ({ ...d, modelTarget: e.target.value }))
              }
              className="field !py-1"
            >
              {DEFAULT_MODELS.map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="relative space-y-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-surface-500 dark:text-surface-300">
              Tags
            </span>
            <span className="text-[10px] text-surface-300 dark:text-surface-800">
              Press Enter or comma to add
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {draft.tags.map((t) => (
              <TagChip key={t} name={t} onRemove={() => removeTag(t)} />
            ))}
            <div className="relative">
              <input
                value={tagInput}
                onChange={(e) => {
                  setTagInput(e.target.value)
                  setShowSuggest(true)
                }}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ',') {
                    e.preventDefault()
                    addTag(tagInput)
                  } else if (
                    e.key === 'Backspace' &&
                    tagInput === '' &&
                    draft.tags.length > 0
                  ) {
                    removeTag(draft.tags[draft.tags.length - 1])
                  }
                }}
                onFocus={() => setShowSuggest(true)}
                onBlur={() => setTimeout(() => setShowSuggest(false), 120)}
                placeholder="add tag"
                className="text-xs bg-transparent outline-none px-1 py-0.5 w-[100px] placeholder:text-surface-300 dark:placeholder:text-surface-800"
              />
              {showSuggest && suggestions.length > 0 && (
                <div className="absolute top-full left-0 mt-1 z-10 min-w-[160px] card p-1 shadow-lg">
                  {suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addTag(s)}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-1">
          <div className="text-xs font-medium text-surface-500 dark:text-surface-300">
            Content
          </div>
          <textarea
            value={draft.content}
            onChange={(e) =>
              setDraft((d) => ({ ...d, content: e.target.value }))
            }
            spellCheck={false}
            className="mono field min-h-[280px] leading-relaxed text-[13px] resize-y"
            placeholder="Write the prompt body here. Use {placeholders} as needed."
          />
        </div>

        <AttachmentList
          paths={draft.attachmentPaths}
          onChange={(next) =>
            setDraft((d) => ({ ...d, attachmentPaths: next }))
          }
        />

        {!prompt && (
          <div className="rounded-md border border-dashed border-surface-200 dark:border-surface-800 p-3 text-xs text-surface-500 dark:text-surface-300 flex items-center gap-2">
            <Plus className="h-3.5 w-3.5" />
            <span>
              Fill in a title and content, then click <strong>Save</strong> to
              add this prompt to your library.
            </span>
          </div>
        )}
      </div>
    </section>
  )
}
