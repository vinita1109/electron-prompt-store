export const DEFAULT_CATEGORIES = [
  'LangChain',
  'LangGraph',
  'RAG',
  'System Design',
  'Agents',
  'Other'
] as const

export const DEFAULT_MODELS = ['GPT-4', 'Claude', 'Gemini', 'Any'] as const

export type Category = string
export type ModelTarget = string

export interface Prompt {
  id: string
  title: string
  content: string
  description: string
  category: Category
  modelTarget: ModelTarget
  isFavorite: boolean
  tags: string[]
  attachmentPaths: string[]
  createdAt: number
  updatedAt: number
}

export interface PromptInput {
  title: string
  content: string
  description?: string
  category?: Category
  modelTarget?: ModelTarget
  isFavorite?: boolean
  tags?: string[]
  attachmentPaths?: string[]
}

export interface PromptFilters {
  query?: string
  categories?: string[]
  tags?: string[]
  favoritesOnly?: boolean
  modelTargets?: string[]
}

export interface AttachmentStatus {
  path: string
  exists: boolean
  size?: number
  isDirectory?: boolean
}

export interface Settings {
  theme: 'light' | 'dark' | 'system'
  autoBackupEnabled: boolean
  backupFolder: string | null
  lastBackupAt: number | null
  lastBackupPath: string | null
  lastExportFolder: string | null
  lastImportFolder: string | null
  windowBounds: {
    x?: number
    y?: number
    width: number
    height: number
  }
}

export const DEFAULT_SETTINGS: Settings = {
  theme: 'system',
  autoBackupEnabled: false,
  backupFolder: null,
  lastBackupAt: null,
  lastBackupPath: null,
  lastExportFolder: null,
  lastImportFolder: null,
  windowBounds: { width: 1280, height: 820 }
}

export interface DiagnosticsInfo {
  appVersion: string
  electronVersion: string
  nodeVersion: string
  chromeVersion: string
  platform: NodeJS.Platform
  arch: string
  paths: {
    userData: string
    documents: string
    downloads: string
    temp: string
    appData: string
    home: string
  }
  database: {
    path: string
    sizeBytes: number
    promptsCount: number
    tagsCount: number
    schemaVersion: number
  }
}

export type IpcResult<T> =
  | { success: true; data: T }
  | { success: false; error: string }

export interface ImportPreview {
  total: number
  newCount: number
  duplicateCount: number
  titles: string[]
}

export type ImportMode = 'merge' | 'replace'

export interface ImportSummary {
  imported: number
  skipped: number
  failed: Array<{ file?: string; title?: string; error: string }>
}

export interface BackupInfo {
  path: string
  timestamp: number
  bytes: number
}
