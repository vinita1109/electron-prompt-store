'use client'

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from 'react'
import {
  Plus,
  Download,
  Upload,
  CheckCircle2,
  AlertCircle,
  Info,
  X,
  Settings as SettingsIcon
} from 'lucide-react'
import { Sidebar } from './components/Sidebar'
import { PromptList } from './components/PromptList'
import { PromptEditor } from './components/PromptEditor'
import { SearchBar } from './components/SearchBar'
import { SettingsModal } from './components/SettingsModal'
import { ImportModal } from './components/ImportModal'
import { api, isElectron } from './lib/api'
import { ToastContext, newToastId } from './lib/store'
import type { Toast, ToastInput } from './lib/store'
import type {
  Prompt,
  PromptFilters,
  Settings
} from './lib/types'

export default function Page() {
  const [ready, setReady] = useState(false)
  const [electronReady, setElectronReady] = useState(false)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [filters, setFilters] = useState<PromptFilters>({
    query: '',
    categories: [],
    tags: [],
    modelTargets: [],
    favoritesOnly: false
  })
  const [tags, setTags] = useState<Array<{ name: string; count: number }>>([])
  const [categories, setCategories] = useState<string[]>([])
  const [settings, setSettings] = useState<Settings | null>(null)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)

  const pushToast = useCallback((t: ToastInput) => {
    const toast: Toast = { id: newToastId(), ...t }
    setToasts((prev) => [...prev, toast])
    setTimeout(() => {
      setToasts((prev) => prev.filter((x) => x.id !== toast.id))
    }, t.kind === 'error' ? 6000 : 4000)
  }, [])

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  const refreshPrompts = useCallback(
    async (withFilters?: PromptFilters) => {
      try {
        const list = await api.prompts.list(withFilters ?? filters)
        setPrompts(list)
        return list
      } catch (e) {
        pushToast({
          kind: 'error',
          title: 'Could not load prompts',
          description: (e as Error).message
        })
        return []
      }
    },
    [filters, pushToast]
  )

  const refreshTags = useCallback(async () => {
    try {
      setTags(await api.tags.list())
    } catch {
      /* non-fatal */
    }
  }, [])

  const refreshCategories = useCallback(async () => {
    try {
      setCategories(await api.categories.list())
    } catch {
      /* non-fatal */
    }
  }, [])

  const refreshSettings = useCallback(async () => {
    try {
      setSettings(await api.settings.all())
    } catch {
      /* non-fatal */
    }
  }, [])

  useEffect(() => {
    if (!isElectron()) {
      setReady(true)
      return
    }
    setElectronReady(true)
    Promise.all([
      refreshPrompts({ query: '' }),
      refreshTags(),
      refreshCategories(),
      refreshSettings()
    ]).finally(() => setReady(true))

    const offTheme = api.system.onThemeChanged(() => {
      const stored =
        (typeof localStorage !== 'undefined' && localStorage.getItem('theme')) ||
        'system'
      if (stored === 'system') {
        const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
        document.documentElement.classList.toggle('dark', isDark)
      }
    })
    return () => {
      offTheme()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!electronReady) return
    const timeout = setTimeout(() => {
      refreshPrompts(filters)
    }, 80)
    return () => clearTimeout(timeout)
  }, [filters, electronReady, refreshPrompts])

  const handleCreate = useCallback(() => {
    setSelectedId(null)
  }, [])

  const handleDuplicateSelected = useCallback(async () => {
    if (!selectedId) return
    try {
      const dup = await api.prompts.duplicate(selectedId)
      await refreshPrompts()
      await refreshTags()
      setSelectedId(dup.id)
      pushToast({
        kind: 'success',
        title: 'Duplicated',
        description: dup.title
      })
    } catch (e) {
      pushToast({
        kind: 'error',
        title: 'Duplicate failed',
        description: (e as Error).message
      })
    }
  }, [pushToast, refreshPrompts, refreshTags, selectedId])

  const handleForceBackup = useCallback(async () => {
    try {
      const info = await api.fs.runBackupNow()
      await refreshSettings()
      pushToast({
        kind: 'success',
        title: 'Backup written',
        description: info.path
      })
    } catch (e) {
      pushToast({
        kind: 'error',
        title: 'Backup failed',
        description: (e as Error).message
      })
    }
  }, [pushToast, refreshSettings])

  useEffect(() => {
    if (!electronReady) return
    const offNew = api.system.onMenu('new-prompt', handleCreate)
    const offDup = api.system.onMenu('duplicate-prompt', handleDuplicateSelected)
    const offSearch = api.system.onMenu('focus-search', () =>
      searchRef.current?.focus()
    )
    const offSettings = api.system.onMenu('settings', () => setSettingsOpen(true))
    const offBackup = api.system.onMenu('force-backup', handleForceBackup)
    return () => {
      offNew()
      offDup()
      offSearch()
      offSettings()
      offBackup()
    }
  }, [electronReady, handleCreate, handleDuplicateSelected, handleForceBackup])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const mod = e.metaKey || e.ctrlKey
      if (!mod) return
      const key = e.key.toLowerCase()
      if (key === 'n') {
        e.preventDefault()
        handleCreate()
      } else if (key === 'k') {
        e.preventDefault()
        searchRef.current?.focus()
      } else if (key === 'd') {
        const target = e.target as HTMLElement | null
        if (
          target &&
          (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')
        )
          return
        e.preventDefault()
        handleDuplicateSelected()
      } else if (key === 's') {
        e.preventDefault()
        handleForceBackup()
      } else if (key === ',') {
        e.preventDefault()
        setSettingsOpen(true)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleCreate, handleDuplicateSelected, handleForceBackup])

  const selectedPrompt = useMemo(
    () => prompts.find((p) => p.id === selectedId) ?? null,
    [prompts, selectedId]
  )

  const allTagNames = useMemo(() => tags.map((t) => t.name), [tags])

  const favoritesCount = useMemo(
    () => prompts.filter((p) => p.isFavorite).length,
    [prompts]
  )

  const doExportJson = async () => {
    try {
      const res = await api.fs.exportJson()
      pushToast({
        kind: 'success',
        title: `Exported ${res.count} prompts`,
        description: res.path
      })
    } catch (e) {
      pushToast({
        kind: 'error',
        title: 'Export failed',
        description: (e as Error).message
      })
    }
  }

  const doExportMarkdownFolder = async () => {
    try {
      const res = await api.fs.exportMarkdownFolder()
      pushToast({
        kind: 'success',
        title: `Wrote ${res.count} Markdown files`,
        description: res.folder
      })
    } catch (e) {
      pushToast({
        kind: 'error',
        title: 'Export failed',
        description: (e as Error).message
      })
    }
  }

  const onSaved = async (saved: Prompt) => {
    await Promise.all([refreshPrompts(), refreshTags(), refreshCategories()])
    setSelectedId(saved.id)
  }

  const onDeleted = async (id: string) => {
    await Promise.all([refreshPrompts(), refreshTags(), refreshCategories()])
    if (selectedId === id) setSelectedId(null)
  }

  const onDuplicated = async (dup: Prompt) => {
    await Promise.all([refreshPrompts(), refreshTags(), refreshCategories()])
    setSelectedId(dup.id)
  }

  if (!ready) {
    return (
      <div className="flex h-screen w-screen items-center justify-center text-sm text-surface-500 dark:text-surface-300">
        Loading…
      </div>
    )
  }

  if (!electronReady) {
    return (
      <div className="flex h-screen w-screen flex-col items-center justify-center gap-3 p-8 text-center">
        <AlertCircle className="h-8 w-8 text-amber-500" />
        <h1 className="text-lg font-semibold">Electron shell required</h1>
        <p className="max-w-md text-sm text-surface-500 dark:text-surface-300">
          This UI reads and writes prompts through Electron&apos;s IPC bridge. Run{' '}
          <code className="mono">npm run dev</code> instead of opening{' '}
          <code className="mono">http://localhost:3000</code> directly.
        </p>
      </div>
    )
  }

  return (
    <ToastContext.Provider value={{ push: pushToast }}>
      <div className="flex h-screen w-screen overflow-hidden">
        <Sidebar
          filters={filters}
          onChange={(patch) => setFilters((prev) => ({ ...prev, ...patch }))}
          tags={tags}
          categories={categories}
          onOpenSettings={() => setSettingsOpen(true)}
          totalCount={prompts.length}
          favoritesCount={favoritesCount}
        />

        <div className="flex h-full w-[380px] flex-col border-r border-surface-200 bg-surface-50/50 dark:border-surface-800 dark:bg-surface-900/40">
          <div className="space-y-2 border-b border-surface-200 p-3 dark:border-surface-800">
            <SearchBar
              ref={searchRef}
              value={filters.query ?? ''}
              onChange={(v) => setFilters((f) => ({ ...f, query: v }))}
            />
            <div className="flex items-center justify-between gap-2">
              <button type="button" onClick={handleCreate} className="btn-primary">
                <Plus className="h-3.5 w-3.5" /> New
              </button>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setImportOpen(true)}
                  className="btn-ghost !text-xs"
                  title="Import"
                >
                  <Upload className="h-3.5 w-3.5" /> Import
                </button>
                <div className="relative group">
                  <button
                    type="button"
                    onClick={doExportJson}
                    className="btn-ghost !text-xs"
                    title="Export all as JSON"
                  >
                    <Download className="h-3.5 w-3.5" /> Export
                  </button>
                  <div className="absolute right-0 top-full mt-1 hidden group-hover:block card p-1 shadow-lg z-10 min-w-[180px]">
                    <button
                      type="button"
                      onClick={doExportJson}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                    >
                      All as JSON…
                    </button>
                    <button
                      type="button"
                      onClick={doExportMarkdownFolder}
                      className="w-full text-left text-xs px-2 py-1 rounded hover:bg-surface-100 dark:hover:bg-surface-800"
                    >
                      All as Markdown files…
                    </button>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setSettingsOpen(true)}
                  className="btn-ghost !p-1.5"
                  aria-label="Settings"
                >
                  <SettingsIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          <PromptList
            prompts={prompts}
            selectedId={selectedId}
            onSelect={setSelectedId}
            searchActive={isFilterActive(filters)}
            onCreate={handleCreate}
          />
        </div>

        <main className="flex-1 overflow-hidden bg-white dark:bg-surface-950">
          <PromptEditor
            prompt={selectedPrompt}
            allTags={allTagNames}
            onSaved={onSaved}
            onDeleted={onDeleted}
            onDuplicated={onDuplicated}
          />
        </main>
      </div>

      <SettingsModal
        open={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onSettingsChanged={setSettings}
      />

      <ImportModal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        onImported={async () => {
          await Promise.all([
            refreshPrompts(),
            refreshTags(),
            refreshCategories()
          ])
        }}
      />

      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4">
        {toasts.map((t) => (
          <ToastView key={t.id} toast={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  )
}

function isFilterActive(f: PromptFilters): boolean {
  return Boolean(
    (f.query && f.query.length > 0) ||
      (f.categories && f.categories.length > 0) ||
      (f.tags && f.tags.length > 0) ||
      (f.modelTargets && f.modelTargets.length > 0) ||
      f.favoritesOnly
  )
}

function ToastView({
  toast,
  onDismiss
}: {
  toast: Toast
  onDismiss: () => void
}) {
  const Icon =
    toast.kind === 'success'
      ? CheckCircle2
      : toast.kind === 'error'
        ? AlertCircle
        : Info
  const tone =
    toast.kind === 'success'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/70 dark:text-emerald-100'
      : toast.kind === 'error'
        ? 'border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-900 dark:bg-rose-950/70 dark:text-rose-100'
        : 'border-indigo-200 bg-indigo-50 text-indigo-900 dark:border-indigo-900 dark:bg-indigo-950/70 dark:text-indigo-100'
  return (
    <div
      className={`pointer-events-auto flex max-w-lg items-start gap-2 rounded-md border px-3 py-2 shadow-lg ${tone}`}
    >
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <div className="flex-1 text-xs">
        <div className="font-semibold">{toast.title}</div>
        {toast.description && (
          <div className="mono mt-0.5 truncate opacity-80 max-w-[36rem]" title={toast.description}>
            {toast.description}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={onDismiss}
        className="opacity-60 hover:opacity-100"
        aria-label="Dismiss"
      >
        <X className="h-3.5 w-3.5" />
      </button>
    </div>
  )
}
