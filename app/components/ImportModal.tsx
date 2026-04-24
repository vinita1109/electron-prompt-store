'use client'

import { useState } from 'react'
import { AlertTriangle, Upload, FileJson, FolderOpen } from 'lucide-react'
import { api } from '../lib/api'
import type { ImportMode, ImportPreview, PromptInput } from '../lib/types'
import { useToast } from '../lib/store'

interface ImportModalProps {
  open: boolean
  onClose: () => void
  onImported: () => void
}

type Phase = 'idle' | 'preview' | 'committing'

export function ImportModal({ open, onClose, onImported }: ImportModalProps) {
  const [phase, setPhase] = useState<Phase>('idle')
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [prompts, setPrompts] = useState<PromptInput[]>([])
  const [filePath, setFilePath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()

  if (!open) return null

  const reset = () => {
    setPhase('idle')
    setPreview(null)
    setPrompts([])
    setFilePath(null)
    setError(null)
  }

  const pickJson = async () => {
    setError(null)
    try {
      const res = await api.fs.importJsonPreview()
      setPreview(res.preview)
      setPrompts(res.prompts)
      setFilePath(res.filePath)
      setPhase('preview')
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const importMarkdown = async () => {
    setError(null)
    try {
      const summary = await api.fs.importMarkdownFolder()
      toast.push({
        kind: 'success',
        title: `Imported ${summary.imported} prompt(s)`,
        description:
          summary.skipped || summary.failed.length
            ? `Skipped ${summary.skipped}, failed ${summary.failed.length}`
            : undefined
      })
      onImported()
      reset()
      onClose()
    } catch (e) {
      setError((e as Error).message)
    }
  }

  const commit = async (mode: ImportMode) => {
    if (prompts.length === 0) return
    setPhase('committing')
    try {
      const summary = await api.fs.importCommit(prompts, mode)
      toast.push({
        kind: 'success',
        title: `Imported ${summary.imported} prompt(s)`,
        description:
          summary.skipped || summary.failed.length
            ? `Skipped ${summary.skipped}, failed ${summary.failed.length}`
            : undefined
      })
      onImported()
      reset()
      onClose()
    } catch (e) {
      setError((e as Error).message)
      setPhase('preview')
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
      <div className="card w-full max-w-lg shadow-xl">
        <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="text-sm font-semibold">Import prompts</h2>
          <button
            type="button"
            onClick={() => {
              reset()
              onClose()
            }}
            className="btn-ghost !p-1 text-xs"
          >
            Close
          </button>
        </div>

        <div className="space-y-4 px-4 py-4">
          {phase === 'idle' && (
            <div className="space-y-3">
              <p className="text-sm text-surface-500 dark:text-surface-300">
                Choose the format of the source you want to import from.
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={pickJson}
                  className="card p-4 text-left hover:bg-surface-50 dark:hover:bg-surface-800/40"
                >
                  <FileJson className="h-5 w-5 text-indigo-500" />
                  <div className="mt-2 text-sm font-medium">From JSON file</div>
                  <p className="mt-1 text-xs text-surface-500 dark:text-surface-300">
                    Previously exported library or compatible JSON.
                  </p>
                </button>
                <button
                  type="button"
                  onClick={importMarkdown}
                  className="card p-4 text-left hover:bg-surface-50 dark:hover:bg-surface-800/40"
                >
                  <FolderOpen className="h-5 w-5 text-indigo-500" />
                  <div className="mt-2 text-sm font-medium">From Markdown folder</div>
                  <p className="mt-1 text-xs text-surface-500 dark:text-surface-300">
                    Scans a folder for .md files with frontmatter.
                  </p>
                </button>
              </div>
            </div>
          )}

          {phase !== 'idle' && preview && (
            <div className="space-y-3">
              <div className="rounded-md bg-surface-50 dark:bg-surface-800/60 p-3 text-sm">
                <div className="text-xs text-surface-500 dark:text-surface-300 truncate">
                  {filePath}
                </div>
                <div className="mt-1 flex flex-wrap gap-4 text-xs">
                  <span>
                    <strong className="tabular-nums">{preview.total}</strong> total
                  </span>
                  <span className="text-emerald-600 dark:text-emerald-400">
                    <strong className="tabular-nums">{preview.newCount}</strong> new
                  </span>
                  <span className="text-amber-600 dark:text-amber-400">
                    <strong className="tabular-nums">{preview.duplicateCount}</strong>{' '}
                    duplicates
                  </span>
                </div>
              </div>

              {preview.titles.length > 0 && (
                <details className="text-xs">
                  <summary className="cursor-pointer text-surface-500 dark:text-surface-300">
                    Preview titles ({preview.titles.length})
                  </summary>
                  <ul className="mt-2 max-h-32 overflow-y-auto rounded-md border border-surface-200 dark:border-surface-800 p-2 space-y-0.5">
                    {preview.titles.map((t, i) => (
                      <li key={i} className="truncate">
                        {t}
                      </li>
                    ))}
                  </ul>
                </details>
              )}

              <div className="rounded-md border border-amber-300 bg-amber-50 p-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 flex-shrink-0 mt-0.5" />
                <span>
                  <strong>Replace All</strong> is destructive — it deletes every
                  existing prompt and tag first. <strong>Merge</strong> skips
                  duplicates by title.
                </span>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={reset}
                  className="btn-ghost"
                  disabled={phase === 'committing'}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => commit('merge')}
                  disabled={phase === 'committing' || preview.total === 0}
                  className="btn-primary"
                >
                  <Upload className="h-3.5 w-3.5" /> Merge
                </button>
                <button
                  type="button"
                  onClick={() => {
                    if (
                      confirm(
                        'Replace All will delete every existing prompt before importing. Continue?'
                      )
                    ) {
                      commit('replace')
                    }
                  }}
                  disabled={phase === 'committing' || preview.total === 0}
                  className="btn-danger"
                >
                  Replace All
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-md bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
