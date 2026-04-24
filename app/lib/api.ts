import type {
  BackupInfo,
  DiagnosticsInfo,
  ElectronAPI,
  ImportMode,
  ImportPreview,
  ImportSummary,
  IpcResult,
  Prompt,
  PromptFilters,
  PromptInput,
  Settings,
  AttachmentStatus
} from './types'

function bridge(): ElectronAPI {
  if (typeof window === 'undefined' || !window.electronAPI) {
    throw new Error('Electron bridge unavailable — this UI must run inside the Electron shell.')
  }
  return window.electronAPI
}

export function isElectron(): boolean {
  return typeof window !== 'undefined' && Boolean(window.electronAPI)
}

async function unwrap<T>(p: Promise<IpcResult<T>>): Promise<T> {
  const r = await p
  if (!r.success) throw new Error(r.error)
  return r.data
}

export const api = {
  prompts: {
    list: (filters?: PromptFilters): Promise<Prompt[]> =>
      unwrap(bridge().prompts.list(filters)),
    get: (id: string): Promise<Prompt | null> =>
      unwrap(bridge().prompts.get(id)),
    create: (input: PromptInput): Promise<Prompt> =>
      unwrap(bridge().prompts.create(input)),
    update: (id: string, input: PromptInput): Promise<Prompt> =>
      unwrap(bridge().prompts.update(id, input)),
    remove: (id: string): Promise<true> => unwrap(bridge().prompts.remove(id)),
    duplicate: (id: string): Promise<Prompt> =>
      unwrap(bridge().prompts.duplicate(id))
  },
  categories: {
    list: (): Promise<string[]> => unwrap(bridge().categories.list())
  },
  tags: {
    list: (): Promise<Array<{ name: string; count: number }>> =>
      unwrap(bridge().tags.list()),
    rename: (oldName: string, newName: string): Promise<true> =>
      unwrap(bridge().tags.rename(oldName, newName)),
    remove: (name: string): Promise<true> => unwrap(bridge().tags.remove(name)),
    merge: (sources: string[], target: string): Promise<true> =>
      unwrap(bridge().tags.merge(sources, target))
  },
  fs: {
    exportJson: (): Promise<{ path: string; count: number }> =>
      unwrap(bridge().fs.exportJson()),
    exportMarkdown: (id: string): Promise<{ path: string }> =>
      unwrap(bridge().fs.exportMarkdown(id)),
    exportMarkdownFolder: (): Promise<{
      folder: string
      count: number
      failed: string[]
    }> => unwrap(bridge().fs.exportMarkdownFolder()),
    importJsonPreview: (): Promise<{
      filePath: string
      preview: ImportPreview
      prompts: PromptInput[]
    }> => unwrap(bridge().fs.importJsonPreview()),
    importCommit: (
      prompts: PromptInput[],
      mode: ImportMode
    ): Promise<ImportSummary> => unwrap(bridge().fs.importCommit(prompts, mode)),
    importMarkdownFolder: (): Promise<ImportSummary> =>
      unwrap(bridge().fs.importMarkdownFolder()),
    attachFile: (): Promise<string[]> => unwrap(bridge().fs.attachFile()),
    openAttachment: (p: string): Promise<true> =>
      unwrap(bridge().fs.openAttachment(p)),
    revealAttachment: (p: string): Promise<true> =>
      unwrap(bridge().fs.revealAttachment(p)),
    statAttachments: (paths: string[]): Promise<AttachmentStatus[]> =>
      unwrap(bridge().fs.statAttachments(paths)),
    selectBackupFolder: (): Promise<string | null> =>
      unwrap(bridge().fs.selectBackupFolder()),
    runBackupNow: (): Promise<BackupInfo> => unwrap(bridge().fs.runBackupNow()),
    testWrite: (): Promise<{
      folder: string
      filePath: string
      bytes: number
    }> => unwrap(bridge().fs.testWrite())
  },
  clipboard: {
    write: (text: string): Promise<true> =>
      unwrap(bridge().clipboard.write(text))
  },
  settings: {
    all: (): Promise<Settings> => unwrap(bridge().settings.all()),
    patch: (p: Partial<Settings>): Promise<Settings> =>
      unwrap(bridge().settings.patch(p))
  },
  diag: {
    info: (): Promise<DiagnosticsInfo> => unwrap(bridge().diag.info()),
    openDbFolder: (): Promise<true> => unwrap(bridge().diag.openDbFolder()),
    exportReport: (): Promise<{ path: string }> =>
      unwrap(bridge().diag.exportReport())
  },
  system: {
    onThemeChanged: (
      handler: (payload: { theme: 'light' | 'dark' }) => void
    ): (() => void) => bridge().system.onThemeChanged(handler),
    onMenu: (
      channel:
        | 'new-prompt'
        | 'duplicate-prompt'
        | 'focus-search'
        | 'settings'
        | 'force-backup',
      handler: () => void
    ): (() => void) => bridge().system.onMenu(channel, handler)
  }
}

export function tagColor(name: string): { bg: string; fg: string; ring: string } {
  let hash = 0
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i)
    hash |= 0
  }
  const hue = Math.abs(hash) % 360
  return {
    bg: `hsl(${hue} 75% 92%)`,
    fg: `hsl(${hue} 65% 28%)`,
    ring: `hsl(${hue} 65% 60%)`
  }
}

export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  const value = bytes / Math.pow(1024, i)
  return `${value.toFixed(value >= 100 ? 0 : value >= 10 ? 1 : 2)} ${units[i]}`
}

export function formatDate(ts: number | null | undefined): string {
  if (!ts) return '—'
  return new Date(ts).toLocaleString()
}

export function formatRelative(ts: number): string {
  const diff = Date.now() - ts
  const abs = Math.abs(diff)
  const min = 60_000
  const hour = 60 * min
  const day = 24 * hour
  if (abs < min) return 'just now'
  if (abs < hour) return `${Math.round(abs / min)}m ago`
  if (abs < day) return `${Math.round(abs / hour)}h ago`
  if (abs < 7 * day) return `${Math.round(abs / day)}d ago`
  return new Date(ts).toLocaleDateString()
}
