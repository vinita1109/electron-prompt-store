'use client'

import { useEffect, useState } from 'react'
import {
  FileIcon,
  AlertTriangle,
  FolderOpen,
  X,
  Plus,
  ExternalLink
} from 'lucide-react'
import { api, formatBytes } from '../lib/api'
import type { AttachmentStatus } from '../lib/types'
import { useToast } from '../lib/store'

interface AttachmentListProps {
  paths: string[]
  onChange: (next: string[]) => void
  readOnly?: boolean
}

export function AttachmentList({ paths, onChange, readOnly }: AttachmentListProps) {
  const [statuses, setStatuses] = useState<AttachmentStatus[]>([])
  const [loading, setLoading] = useState(false)
  const [menuFor, setMenuFor] = useState<string | null>(null)
  const toast = useToast()

  useEffect(() => {
    let cancelled = false
    if (paths.length === 0) {
      setStatuses([])
      return
    }
    setLoading(true)
    api.fs
      .statAttachments(paths)
      .then((r) => {
        if (!cancelled) setStatuses(r)
      })
      .catch(() => {
        if (!cancelled) {
          setStatuses(paths.map((p) => ({ path: p, exists: false })))
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [paths])

  const handleAttach = async () => {
    try {
      const picked = await api.fs.attachFile()
      if (picked.length === 0) return
      const next = Array.from(new Set([...paths, ...picked]))
      onChange(next)
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Could not attach file',
        description: (e as Error).message
      })
    }
  }

  const handleOpen = async (p: string) => {
    try {
      await api.fs.openAttachment(p)
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Could not open',
        description: (e as Error).message
      })
    }
  }

  const handleReveal = async (p: string) => {
    try {
      await api.fs.revealAttachment(p)
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Could not reveal',
        description: (e as Error).message
      })
    }
  }

  const handleRemove = (p: string) => {
    onChange(paths.filter((x) => x !== p))
  }

  const basename = (p: string) => p.split(/[\\/]/).pop() || p

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-xs font-medium uppercase tracking-wider text-surface-300 dark:text-surface-800">
          Attachments ({paths.length})
        </div>
        {!readOnly && (
          <button
            type="button"
            onClick={handleAttach}
            className="btn-ghost !text-xs"
          >
            <Plus className="h-3.5 w-3.5" /> Attach
          </button>
        )}
      </div>
      {loading && paths.length > 0 && (
        <p className="text-xs text-surface-300 dark:text-surface-800">Checking files…</p>
      )}
      {paths.length === 0 ? (
        <p className="text-xs text-surface-300 dark:text-surface-800">
          No attachments. Attached files are referenced by absolute path — they are
          not copied into the app.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1.5">
          {paths.map((p) => {
            const status = statuses.find((s) => s.path === p)
            const missing = status && !status.exists
            return (
              <div
                key={p}
                className={`group relative inline-flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs max-w-full ${
                  missing
                    ? 'border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200'
                    : 'border-surface-200 bg-surface-50 text-surface-800 dark:border-surface-800 dark:bg-surface-800/50 dark:text-surface-100'
                }`}
                onContextMenu={(e) => {
                  e.preventDefault()
                  setMenuFor(menuFor === p ? null : p)
                }}
              >
                {missing ? (
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                ) : (
                  <FileIcon className="h-3.5 w-3.5 flex-shrink-0 opacity-70" />
                )}
                <button
                  type="button"
                  onClick={() => handleOpen(p)}
                  className="max-w-[200px] truncate hover:underline"
                  title={p}
                >
                  {basename(p)}
                </button>
                {status?.size !== undefined && !missing && (
                  <span className="text-[10px] opacity-60 tabular-nums">
                    {formatBytes(status.size)}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => handleReveal(p)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-800 dark:text-surface-100"
                  aria-label="Reveal in file explorer"
                  title="Reveal in Finder/Explorer"
                >
                  <FolderOpen className="h-3 w-3" />
                </button>
                <button
                  type="button"
                  onClick={() => handleOpen(p)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-800 dark:text-surface-100"
                  aria-label="Open with default app"
                  title="Open with default app"
                >
                  <ExternalLink className="h-3 w-3" />
                </button>
                {!readOnly && (
                  <button
                    type="button"
                    onClick={() => handleRemove(p)}
                    className="opacity-0 group-hover:opacity-100 transition-opacity text-surface-800 dark:text-surface-100"
                    aria-label="Remove attachment"
                    title="Remove"
                  >
                    <X className="h-3 w-3" />
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
