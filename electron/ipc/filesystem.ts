import { ipcMain, dialog, shell, clipboard, BrowserWindow } from 'electron'
import fs from 'node:fs'
import fsp from 'node:fs/promises'
import path from 'node:path'
import matter from 'gray-matter'
import {
  getAllPromptsForExport,
  createPrompt,
  replaceAllPrompts,
  findPromptByTitle
} from '../db/database'
import { getSettingsStore } from './settings'
import type {
  AttachmentStatus,
  BackupInfo,
  ImportMode,
  ImportPreview,
  ImportSummary,
  IpcResult,
  Prompt,
  PromptInput
} from '../../shared/types'

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function fail(error: unknown): IpcResult<never> {
  const message = error instanceof Error ? error.message : String(error)
  return { success: false, error: message }
}

function slugify(input: string): string {
  return (
    input
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80) || 'prompt'
  )
}

function promptToMarkdown(p: Prompt): string {
  const front = matter.stringify(p.content, {
    title: p.title,
    description: p.description,
    category: p.category,
    model_target: p.modelTarget,
    tags: p.tags,
    is_favorite: p.isFavorite,
    created_at: new Date(p.createdAt).toISOString(),
    updated_at: new Date(p.updatedAt).toISOString()
  })
  return front
}

function markdownToPromptInput(raw: string): PromptInput {
  const parsed = matter(raw)
  const data = parsed.data as Record<string, unknown>
  const toArray = (v: unknown): string[] => {
    if (Array.isArray(v)) return v.filter((x) => typeof x === 'string')
    if (typeof v === 'string')
      return v
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
    return []
  }
  return {
    title: (typeof data.title === 'string' && data.title.trim()) || 'Untitled',
    content: parsed.content.trim(),
    description: typeof data.description === 'string' ? data.description : '',
    category: typeof data.category === 'string' ? data.category : 'Other',
    modelTarget: typeof data.model_target === 'string' ? data.model_target : 'Any',
    isFavorite: Boolean(data.is_favorite),
    tags: toArray(data.tags)
  }
}

async function writeBackup(folder: string): Promise<BackupInfo> {
  await fsp.mkdir(folder, { recursive: true })
  const payload = {
    version: 1,
    exportedAt: new Date().toISOString(),
    prompts: getAllPromptsForExport()
  }
  const stamp = new Date()
    .toISOString()
    .replace(/[:.]/g, '-')
    .replace('T', '_')
    .slice(0, 19)
  const filePath = path.join(folder, `prompt-library-backup_${stamp}.json`)
  const body = JSON.stringify(payload, null, 2)
  await fsp.writeFile(filePath, body, 'utf8')
  const stat = await fsp.stat(filePath)

  const entries = (await fsp.readdir(folder))
    .filter((n) => n.startsWith('prompt-library-backup_') && n.endsWith('.json'))
    .map((n) => path.join(folder, n))
    .sort()
  if (entries.length > 10) {
    const toDelete = entries.slice(0, entries.length - 10)
    for (const p of toDelete) {
      try {
        await fsp.unlink(p)
      } catch {
        /* ignore */
      }
    }
  }

  return { path: filePath, timestamp: Date.now(), bytes: stat.size }
}

export async function runAutoBackupIfEnabled(): Promise<void> {
  const store = getSettingsStore()
  if (!store.get('autoBackupEnabled')) return
  const folder = store.get('backupFolder')
  if (!folder) return
  try {
    const info = await writeBackup(folder)
    store.set('lastBackupAt', info.timestamp)
    store.set('lastBackupPath', info.path)
  } catch {
    /* backup failure is non-fatal; surfaced via diagnostics */
  }
}

export function registerFilesystemIpc(
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle(
    'fs:exportJson',
    async (): Promise<IpcResult<{ path: string; count: number }>> => {
      try {
        const win = getMainWindow()
        const store = getSettingsStore()
        const result = await dialog.showSaveDialog(win as Electron.BrowserWindow, {
          title: 'Export prompts as JSON',
          defaultPath: path.join(
            store.get('lastExportFolder') || app_documents(),
            `prompt-library_${new Date().toISOString().slice(0, 10)}.json`
          ),
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })
        if (result.canceled || !result.filePath) {
          return fail('Export cancelled')
        }
        const prompts = getAllPromptsForExport()
        const payload = {
          version: 1,
          exportedAt: new Date().toISOString(),
          prompts
        }
        await fsp.writeFile(
          result.filePath,
          JSON.stringify(payload, null, 2),
          'utf8'
        )
        store.set('lastExportFolder', path.dirname(result.filePath))
        return ok({ path: result.filePath, count: prompts.length })
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:exportMarkdown',
    async (_e, promptId: string): Promise<IpcResult<{ path: string }>> => {
      try {
        const win = getMainWindow()
        const store = getSettingsStore()
        const all = getAllPromptsForExport()
        const p = all.find((x) => x.id === promptId)
        if (!p) return fail('Prompt not found')
        const result = await dialog.showSaveDialog(win as Electron.BrowserWindow, {
          title: 'Export prompt as Markdown',
          defaultPath: path.join(
            store.get('lastExportFolder') || app_documents(),
            `${slugify(p.title)}.md`
          ),
          filters: [{ name: 'Markdown', extensions: ['md'] }]
        })
        if (result.canceled || !result.filePath) return fail('Export cancelled')
        await fsp.writeFile(result.filePath, promptToMarkdown(p), 'utf8')
        store.set('lastExportFolder', path.dirname(result.filePath))
        return ok({ path: result.filePath })
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:exportMarkdownFolder',
    async (): Promise<
      IpcResult<{ folder: string; count: number; failed: string[] }>
    > => {
      try {
        const win = getMainWindow()
        const store = getSettingsStore()
        const result = await dialog.showOpenDialog(win as Electron.BrowserWindow, {
          title: 'Choose folder to export Markdown files into',
          defaultPath: store.get('lastExportFolder') || app_documents(),
          properties: ['openDirectory', 'createDirectory']
        })
        if (result.canceled || result.filePaths.length === 0) {
          return fail('Export cancelled')
        }
        const folder = result.filePaths[0]
        const prompts = getAllPromptsForExport()
        const failed: string[] = []
        const usedNames = new Set<string>()
        for (const p of prompts) {
          let base = slugify(p.title)
          let name = `${base}.md`
          let n = 1
          while (usedNames.has(name)) {
            name = `${base}-${n++}.md`
          }
          usedNames.add(name)
          const target = path.join(folder, name)
          try {
            await fsp.writeFile(target, promptToMarkdown(p), 'utf8')
          } catch (err) {
            const msg = err instanceof Error ? err.message : String(err)
            failed.push(`${p.title}: ${msg}`)
          }
        }
        store.set('lastExportFolder', folder)
        return ok({ folder, count: prompts.length - failed.length, failed })
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:importJsonPreview',
    async (): Promise<
      IpcResult<{ filePath: string; preview: ImportPreview; prompts: PromptInput[] }>
    > => {
      try {
        const win = getMainWindow()
        const store = getSettingsStore()
        const result = await dialog.showOpenDialog(win as Electron.BrowserWindow, {
          title: 'Import prompts from JSON',
          defaultPath: store.get('lastImportFolder') || app_documents(),
          filters: [{ name: 'JSON', extensions: ['json'] }],
          properties: ['openFile']
        })
        if (result.canceled || result.filePaths.length === 0) {
          return fail('Import cancelled')
        }
        const filePath = result.filePaths[0]
        const raw = await fsp.readFile(filePath, 'utf8')
        const parsed = JSON.parse(raw) as unknown
        const prompts = extractPromptsFromJson(parsed)

        const titles = prompts.map((p) => p.title)
        let duplicates = 0
        for (const title of titles) {
          if (findPromptByTitle(title)) duplicates += 1
        }
        store.set('lastImportFolder', path.dirname(filePath))

        return ok({
          filePath,
          preview: {
            total: prompts.length,
            newCount: prompts.length - duplicates,
            duplicateCount: duplicates,
            titles: titles.slice(0, 30)
          },
          prompts
        })
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:importCommit',
    async (
      _e,
      prompts: PromptInput[],
      mode: ImportMode
    ): Promise<IpcResult<ImportSummary>> => {
      try {
        const summary: ImportSummary = { imported: 0, skipped: 0, failed: [] }
        if (mode === 'replace') {
          replaceAllPrompts(prompts)
          summary.imported = prompts.length
        } else {
          for (const p of prompts) {
            try {
              if (findPromptByTitle(p.title)) {
                summary.skipped += 1
                continue
              }
              createPrompt(p)
              summary.imported += 1
            } catch (err) {
              summary.failed.push({
                title: p.title,
                error: err instanceof Error ? err.message : String(err)
              })
            }
          }
        }
        await runAutoBackupIfEnabled()
        return ok(summary)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:importMarkdownFolder',
    async (): Promise<IpcResult<ImportSummary>> => {
      try {
        const win = getMainWindow()
        const store = getSettingsStore()
        const result = await dialog.showOpenDialog(win as Electron.BrowserWindow, {
          title: 'Import Markdown files from folder',
          defaultPath: store.get('lastImportFolder') || app_documents(),
          properties: ['openDirectory']
        })
        if (result.canceled || result.filePaths.length === 0) {
          return fail('Import cancelled')
        }
        const folder = result.filePaths[0]
        const entries = await fsp.readdir(folder, { withFileTypes: true })
        const files = entries
          .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
          .map((e) => path.join(folder, e.name))

        const summary: ImportSummary = { imported: 0, skipped: 0, failed: [] }
        for (const file of files) {
          try {
            const raw = await fsp.readFile(file, 'utf8')
            const input = markdownToPromptInput(raw)
            if (findPromptByTitle(input.title)) {
              summary.skipped += 1
              continue
            }
            createPrompt(input)
            summary.imported += 1
          } catch (err) {
            summary.failed.push({
              file: path.basename(file),
              error: err instanceof Error ? err.message : String(err)
            })
          }
        }
        store.set('lastImportFolder', folder)
        await runAutoBackupIfEnabled()
        return ok(summary)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:attachFile',
    async (): Promise<IpcResult<string[]>> => {
      try {
        const win = getMainWindow()
        const result = await dialog.showOpenDialog(win as Electron.BrowserWindow, {
          title: 'Attach file(s)',
          properties: ['openFile', 'multiSelections']
        })
        if (result.canceled) return ok([])
        return ok(result.filePaths)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:openAttachment',
    async (_e, filePath: string): Promise<IpcResult<true>> => {
      try {
        const result = await shell.openPath(filePath)
        if (result && result.length > 0) {
          return fail(result)
        }
        return ok(true as const)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:revealAttachment',
    (_e, filePath: string): IpcResult<true> => {
      try {
        shell.showItemInFolder(filePath)
        return ok(true as const)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:statAttachments',
    async (
      _e,
      paths: string[]
    ): Promise<IpcResult<AttachmentStatus[]>> => {
      const out: AttachmentStatus[] = []
      for (const p of paths) {
        try {
          const st = await fsp.stat(p)
          out.push({
            path: p,
            exists: true,
            size: st.size,
            isDirectory: st.isDirectory()
          })
        } catch {
          out.push({ path: p, exists: false })
        }
      }
      return ok(out)
    }
  )

  ipcMain.handle(
    'fs:selectBackupFolder',
    async (): Promise<IpcResult<string | null>> => {
      try {
        const win = getMainWindow()
        const store = getSettingsStore()
        const result = await dialog.showOpenDialog(win as Electron.BrowserWindow, {
          title: 'Choose backup folder',
          defaultPath: store.get('backupFolder') || app_documents(),
          properties: ['openDirectory', 'createDirectory']
        })
        if (result.canceled || result.filePaths.length === 0) return ok(null)
        const folder = result.filePaths[0]
        store.set('backupFolder', folder)
        return ok(folder)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:runBackupNow',
    async (): Promise<IpcResult<BackupInfo>> => {
      try {
        const store = getSettingsStore()
        let folder = store.get('backupFolder')
        if (!folder) {
          const win = getMainWindow()
          const result = await dialog.showOpenDialog(win as Electron.BrowserWindow, {
            title: 'Choose backup folder',
            properties: ['openDirectory', 'createDirectory']
          })
          if (result.canceled || result.filePaths.length === 0) {
            return fail('Backup cancelled')
          }
          folder = result.filePaths[0]
          store.set('backupFolder', folder)
        }
        const info = await writeBackup(folder)
        store.set('lastBackupAt', info.timestamp)
        store.set('lastBackupPath', info.path)
        return ok(info)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'fs:testWrite',
    async (): Promise<
      IpcResult<{ folder: string; filePath: string; bytes: number }>
    > => {
      try {
        const win = getMainWindow()
        const result = await dialog.showOpenDialog(win as Electron.BrowserWindow, {
          title: 'Choose a folder to test write permissions',
          properties: ['openDirectory', 'createDirectory']
        })
        if (result.canceled || result.filePaths.length === 0) {
          return fail('Cancelled')
        }
        const folder = result.filePaths[0]
        const filePath = path.join(
          folder,
          `.prompt-library-write-test-${Date.now()}.tmp`
        )
        const body = `Prompt Library write test at ${new Date().toISOString()}\n`
        await fsp.writeFile(filePath, body, 'utf8')
        const stat = await fsp.stat(filePath)
        await fsp.unlink(filePath)
        return ok({ folder, filePath, bytes: stat.size })
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'clipboard:write',
    (_e, text: string): IpcResult<true> => {
      try {
        clipboard.writeText(text)
        return ok(true as const)
      } catch (e) {
        return fail(e)
      }
    }
  )
}

function app_documents(): string {
  const { app } = require('electron') as typeof import('electron')
  try {
    return app.getPath('documents')
  } catch {
    return app.getPath('home')
  }
}

function extractPromptsFromJson(raw: unknown): PromptInput[] {
  const out: PromptInput[] = []
  const toPrompt = (v: unknown): PromptInput | null => {
    if (!v || typeof v !== 'object') return null
    const o = v as Record<string, unknown>
    const title =
      typeof o.title === 'string' && o.title.trim() ? o.title : null
    const content = typeof o.content === 'string' ? o.content : ''
    if (!title) return null
    const tags = Array.isArray(o.tags)
      ? (o.tags.filter((t) => typeof t === 'string') as string[])
      : []
    const attachments = Array.isArray(o.attachmentPaths)
      ? (o.attachmentPaths.filter((p) => typeof p === 'string') as string[])
      : []
    return {
      title,
      content,
      description: typeof o.description === 'string' ? o.description : '',
      category: typeof o.category === 'string' ? o.category : 'Other',
      modelTarget:
        typeof o.modelTarget === 'string'
          ? o.modelTarget
          : typeof o.model_target === 'string'
            ? (o.model_target as string)
            : 'Any',
      isFavorite: Boolean(o.isFavorite ?? o.is_favorite),
      tags,
      attachmentPaths: attachments
    }
  }

  const candidates: unknown[] = Array.isArray(raw)
    ? raw
    : raw && typeof raw === 'object' && 'prompts' in (raw as Record<string, unknown>) &&
        Array.isArray((raw as Record<string, unknown>).prompts)
      ? ((raw as Record<string, unknown>).prompts as unknown[])
      : []

  for (const c of candidates) {
    const p = toPrompt(c)
    if (p) out.push(p)
  }
  return out
}

