import type {
  AttachmentStatus,
  BackupInfo,
  DiagnosticsInfo,
  ImportMode,
  ImportPreview,
  ImportSummary,
  IpcResult,
  Prompt,
  PromptFilters,
  PromptInput,
  Settings
} from '@/shared/types'

export type {
  AttachmentStatus,
  BackupInfo,
  DiagnosticsInfo,
  ImportMode,
  ImportPreview,
  ImportSummary,
  IpcResult,
  Prompt,
  PromptFilters,
  PromptInput,
  Settings
}

export interface ElectronAPI {
  prompts: {
    list: (filters?: PromptFilters) => Promise<IpcResult<Prompt[]>>
    get: (id: string) => Promise<IpcResult<Prompt | null>>
    create: (input: PromptInput) => Promise<IpcResult<Prompt>>
    update: (id: string, input: PromptInput) => Promise<IpcResult<Prompt>>
    remove: (id: string) => Promise<IpcResult<true>>
    duplicate: (id: string) => Promise<IpcResult<Prompt>>
  }
  categories: {
    list: () => Promise<IpcResult<string[]>>
  }
  tags: {
    list: () => Promise<IpcResult<Array<{ name: string; count: number }>>>
    rename: (oldName: string, newName: string) => Promise<IpcResult<true>>
    remove: (name: string) => Promise<IpcResult<true>>
    merge: (sources: string[], target: string) => Promise<IpcResult<true>>
  }
  fs: {
    exportJson: () => Promise<IpcResult<{ path: string; count: number }>>
    exportMarkdown: (id: string) => Promise<IpcResult<{ path: string }>>
    exportMarkdownFolder: () => Promise<
      IpcResult<{ folder: string; count: number; failed: string[] }>
    >
    importJsonPreview: () => Promise<
      IpcResult<{
        filePath: string
        preview: ImportPreview
        prompts: PromptInput[]
      }>
    >
    importCommit: (
      prompts: PromptInput[],
      mode: ImportMode
    ) => Promise<IpcResult<ImportSummary>>
    importMarkdownFolder: () => Promise<IpcResult<ImportSummary>>
    attachFile: () => Promise<IpcResult<string[]>>
    openAttachment: (p: string) => Promise<IpcResult<true>>
    revealAttachment: (p: string) => Promise<IpcResult<true>>
    statAttachments: (paths: string[]) => Promise<IpcResult<AttachmentStatus[]>>
    selectBackupFolder: () => Promise<IpcResult<string | null>>
    runBackupNow: () => Promise<IpcResult<BackupInfo>>
    testWrite: () => Promise<
      IpcResult<{ folder: string; filePath: string; bytes: number }>
    >
  }
  clipboard: { write: (text: string) => Promise<IpcResult<true>> }
  settings: {
    all: () => Promise<IpcResult<Settings>>
    get: <K extends keyof Settings>(key: K) => Promise<IpcResult<Settings[K]>>
    set: <K extends keyof Settings>(
      key: K,
      value: Settings[K]
    ) => Promise<IpcResult<true>>
    patch: (patch: Partial<Settings>) => Promise<IpcResult<Settings>>
  }
  diag: {
    info: () => Promise<IpcResult<DiagnosticsInfo>>
    openDbFolder: () => Promise<IpcResult<true>>
    exportReport: () => Promise<IpcResult<{ path: string }>>
  }
  system: {
    onThemeChanged: (
      handler: (payload: { theme: 'light' | 'dark' }) => void
    ) => () => void
    onMenu: (
      channel:
        | 'new-prompt'
        | 'duplicate-prompt'
        | 'focus-search'
        | 'settings'
        | 'force-backup',
      handler: () => void
    ) => () => void
  }
}

declare global {
  interface Window {
    electronAPI?: ElectronAPI
  }
}
