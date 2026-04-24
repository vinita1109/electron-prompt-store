import { contextBridge, ipcRenderer } from 'electron'
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
} from '../shared/types'

type Invoke = <T>(channel: string, ...args: unknown[]) => Promise<IpcResult<T>>
const invoke: Invoke = (channel, ...args) =>
  ipcRenderer.invoke(channel, ...args) as Promise<IpcResult<never>>

const api = {
  prompts: {
    list: (filters?: PromptFilters) => invoke<Prompt[]>('prompts:list', filters ?? {}),
    get: (id: string) => invoke<Prompt | null>('prompts:get', id),
    create: (input: PromptInput) => invoke<Prompt>('prompts:create', input),
    update: (id: string, input: PromptInput) => invoke<Prompt>('prompts:update', id, input),
    remove: (id: string) => invoke<true>('prompts:delete', id),
    duplicate: (id: string) => invoke<Prompt>('prompts:duplicate', id)
  },
  categories: {
    list: () => invoke<string[]>('categories:list')
  },
  tags: {
    list: () => invoke<Array<{ name: string; count: number }>>('tags:list'),
    rename: (oldName: string, newName: string) =>
      invoke<true>('tags:rename', oldName, newName),
    remove: (name: string) => invoke<true>('tags:delete', name),
    merge: (sources: string[], target: string) =>
      invoke<true>('tags:merge', sources, target)
  },
  fs: {
    exportJson: () => invoke<{ path: string; count: number }>('fs:exportJson'),
    exportMarkdown: (id: string) =>
      invoke<{ path: string }>('fs:exportMarkdown', id),
    exportMarkdownFolder: () =>
      invoke<{ folder: string; count: number; failed: string[] }>(
        'fs:exportMarkdownFolder'
      ),
    importJsonPreview: () =>
      invoke<{
        filePath: string
        preview: ImportPreview
        prompts: PromptInput[]
      }>('fs:importJsonPreview'),
    importCommit: (prompts: PromptInput[], mode: ImportMode) =>
      invoke<ImportSummary>('fs:importCommit', prompts, mode),
    importMarkdownFolder: () => invoke<ImportSummary>('fs:importMarkdownFolder'),
    attachFile: () => invoke<string[]>('fs:attachFile'),
    openAttachment: (p: string) => invoke<true>('fs:openAttachment', p),
    revealAttachment: (p: string) => invoke<true>('fs:revealAttachment', p),
    statAttachments: (paths: string[]) =>
      invoke<AttachmentStatus[]>('fs:statAttachments', paths),
    selectBackupFolder: () => invoke<string | null>('fs:selectBackupFolder'),
    runBackupNow: () => invoke<BackupInfo>('fs:runBackupNow'),
    testWrite: () =>
      invoke<{ folder: string; filePath: string; bytes: number }>('fs:testWrite')
  },
  clipboard: {
    write: (text: string) => invoke<true>('clipboard:write', text)
  },
  settings: {
    all: () => invoke<Settings>('settings:all'),
    get: <K extends keyof Settings>(key: K) => invoke<Settings[K]>('settings:get', key),
    set: <K extends keyof Settings>(key: K, value: Settings[K]) =>
      invoke<true>('settings:set', key, value),
    patch: (patch: Partial<Settings>) => invoke<Settings>('settings:patch', patch)
  },
  diag: {
    info: () => invoke<DiagnosticsInfo>('diag:info'),
    openDbFolder: () => invoke<true>('diag:openDbFolder'),
    exportReport: () => invoke<{ path: string }>('diag:exportReport')
  },
  system: {
    onThemeChanged: (handler: (payload: { theme: 'light' | 'dark' }) => void) => {
      const listener = (_: Electron.IpcRendererEvent, payload: { theme: 'light' | 'dark' }) =>
        handler(payload)
      ipcRenderer.on('system:theme-changed', listener)
      return () => ipcRenderer.removeListener('system:theme-changed', listener)
    },
    onMenu: (
      channel:
        | 'new-prompt'
        | 'duplicate-prompt'
        | 'focus-search'
        | 'settings'
        | 'force-backup',
      handler: () => void
    ) => {
      const key = `menu:${channel}`
      const listener = () => handler()
      ipcRenderer.on(key, listener)
      return () => ipcRenderer.removeListener(key, listener)
    }
  }
}

export type ElectronAPI = typeof api

contextBridge.exposeInMainWorld('electronAPI', api)
