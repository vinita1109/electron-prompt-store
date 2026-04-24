'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, X } from 'lucide-react'
import { api, formatDate } from '../lib/api'
import type { Settings } from '../lib/types'
import { DiagnosticsPanel } from './DiagnosticsPanel'
import { useToast } from '../lib/store'

type Tab = 'general' | 'backups' | 'diagnostics'

interface SettingsModalProps {
  open: boolean
  onClose: () => void
  settings: Settings | null
  onSettingsChanged: (next: Settings) => void
}

export function SettingsModal({
  open,
  onClose,
  settings,
  onSettingsChanged
}: SettingsModalProps) {
  const [tab, setTab] = useState<Tab>('general')
  const [busy, setBusy] = useState(false)
  const toast = useToast()

  useEffect(() => {
    if (!open) setTab('general')
  }, [open])

  if (!open) return null

  const patch = async (p: Partial<Settings>) => {
    setBusy(true)
    try {
      const next = await api.settings.patch(p)
      onSettingsChanged(next)
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Could not save settings',
        description: (e as Error).message
      })
    } finally {
      setBusy(false)
    }
  }

  const pickBackupFolder = async () => {
    try {
      const folder = await api.fs.selectBackupFolder()
      if (folder) {
        const next = await api.settings.all()
        onSettingsChanged(next)
        toast.push({
          kind: 'success',
          title: 'Backup folder set',
          description: folder
        })
      }
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Could not set folder',
        description: (e as Error).message
      })
    }
  }

  const runBackupNow = async () => {
    setBusy(true)
    try {
      const info = await api.fs.runBackupNow()
      const next = await api.settings.all()
      onSettingsChanged(next)
      toast.push({
        kind: 'success',
        title: 'Backup written',
        description: info.path
      })
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Backup failed',
        description: (e as Error).message
      })
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 p-6">
      <div className="card w-full max-w-2xl shadow-xl max-h-[85vh] flex flex-col">
        <div className="flex items-center justify-between border-b border-surface-200 px-4 py-3 dark:border-surface-800">
          <h2 className="text-sm font-semibold">Settings</h2>
          <button
            type="button"
            onClick={onClose}
            className="btn-ghost !p-1"
            aria-label="Close settings"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          <nav className="w-40 shrink-0 border-r border-surface-200 dark:border-surface-800 p-2 space-y-0.5">
            <TabBtn active={tab === 'general'} onClick={() => setTab('general')}>
              General
            </TabBtn>
            <TabBtn active={tab === 'backups'} onClick={() => setTab('backups')}>
              Backups
            </TabBtn>
            <TabBtn
              active={tab === 'diagnostics'}
              onClick={() => setTab('diagnostics')}
            >
              Diagnostics
            </TabBtn>
          </nav>

          <div className="flex-1 overflow-y-auto p-5 text-sm">
            {tab === 'general' && settings && (
              <div className="space-y-5">
                <Field label="Theme">
                  <div className="flex gap-2">
                    {(['system', 'light', 'dark'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => {
                          applyTheme(t)
                          patch({ theme: t })
                        }}
                        className={`btn ${
                          settings.theme === t ? 'btn-primary' : 'btn-secondary'
                        }`}
                      >
                        {t[0].toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </Field>

                <Field label="Keyboard shortcuts">
                  <ul className="mono text-xs space-y-1 text-surface-500 dark:text-surface-300">
                    <li>
                      <kbd>Cmd/Ctrl + N</kbd> · New prompt
                    </li>
                    <li>
                      <kbd>Cmd/Ctrl + K</kbd> · Focus search
                    </li>
                    <li>
                      <kbd>Cmd/Ctrl + D</kbd> · Duplicate selected
                    </li>
                    <li>
                      <kbd>Cmd/Ctrl + S</kbd> · Force backup
                    </li>
                    <li>
                      <kbd>Cmd/Ctrl + ,</kbd> · Open this settings panel
                    </li>
                  </ul>
                </Field>
              </div>
            )}

            {tab === 'backups' && settings && (
              <div className="space-y-5">
                <Field label="Auto-backup">
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      className="h-4 w-4"
                      checked={settings.autoBackupEnabled}
                      onChange={(e) =>
                        patch({ autoBackupEnabled: e.target.checked })
                      }
                    />
                    <span>
                      Write a backup file every time a prompt is created, updated,
                      or deleted. Keeps the last 10 files.
                    </span>
                  </label>
                </Field>

                <Field label="Backup folder">
                  <div className="flex items-center gap-2">
                    <div className="mono flex-1 truncate text-xs text-surface-500 dark:text-surface-300">
                      {settings.backupFolder || 'Not set'}
                    </div>
                    <button
                      type="button"
                      onClick={pickBackupFolder}
                      className="btn-secondary"
                    >
                      <FolderOpen className="h-3.5 w-3.5" /> Choose…
                    </button>
                  </div>
                </Field>

                <Field label="Last backup">
                  <div className="text-xs space-y-1">
                    <div>
                      <span className="text-surface-400 dark:text-surface-300">
                        At:{' '}
                      </span>
                      <span className="mono">{formatDate(settings.lastBackupAt)}</span>
                    </div>
                    <div className="mono truncate text-surface-500 dark:text-surface-300">
                      {settings.lastBackupPath || '—'}
                    </div>
                  </div>
                </Field>

                <button
                  type="button"
                  onClick={runBackupNow}
                  className="btn-primary"
                  disabled={busy}
                >
                  Force backup now
                </button>
              </div>
            )}

            {tab === 'diagnostics' && <DiagnosticsPanel />}
          </div>
        </div>
      </div>
    </div>
  )
}

function TabBtn({
  active,
  onClick,
  children
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full text-left rounded-md px-2 py-1.5 text-sm focus-ring ${
        active
          ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300'
          : 'text-surface-700 dark:text-surface-300 hover:bg-surface-100 dark:hover:bg-surface-800'
      }`}
    >
      {children}
    </button>
  )
}

function Field({
  label,
  children
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="mb-1.5 text-xs font-medium uppercase tracking-wider text-surface-500 dark:text-surface-300">
        {label}
      </div>
      {children}
    </div>
  )
}

function applyTheme(theme: 'system' | 'light' | 'dark') {
  try {
    localStorage.setItem('theme', theme)
  } catch {
    /* ignore storage errors */
  }
  const isDark =
    theme === 'dark' ||
    (theme === 'system' &&
      window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', isDark)
}
