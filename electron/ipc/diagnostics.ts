import { ipcMain, dialog, shell, app, BrowserWindow } from 'electron'
import fsp from 'node:fs/promises'
import path from 'node:path'
import {
  getDatabasePath,
  getDatabaseSize,
  countPrompts,
  countTags
} from '../db/database'
import { getSchemaVersion } from '../db/migrations'
import { getDatabase } from '../db/database'
import type { DiagnosticsInfo, IpcResult } from '../../shared/types'

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function fail(error: unknown): IpcResult<never> {
  const message = error instanceof Error ? error.message : String(error)
  return { success: false, error: message }
}

function safePath(name: Parameters<typeof app.getPath>[0]): string {
  try {
    return app.getPath(name)
  } catch {
    return ''
  }
}

export function buildDiagnostics(): DiagnosticsInfo {
  return {
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? '',
    nodeVersion: process.versions.node,
    chromeVersion: process.versions.chrome ?? '',
    platform: process.platform,
    arch: process.arch,
    paths: {
      userData: safePath('userData'),
      documents: safePath('documents'),
      downloads: safePath('downloads'),
      temp: safePath('temp'),
      appData: safePath('appData'),
      home: safePath('home')
    },
    database: {
      path: getDatabasePath(),
      sizeBytes: getDatabaseSize(),
      promptsCount: countPrompts(),
      tagsCount: countTags(),
      schemaVersion: getSchemaVersion(getDatabase())
    }
  }
}

export function registerDiagnosticsIpc(
  getMainWindow: () => BrowserWindow | null
): void {
  ipcMain.handle('diag:info', (): IpcResult<DiagnosticsInfo> => {
    try {
      return ok(buildDiagnostics())
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle('diag:openDbFolder', (): IpcResult<true> => {
    try {
      shell.showItemInFolder(getDatabasePath())
      return ok(true as const)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    'diag:exportReport',
    async (): Promise<IpcResult<{ path: string }>> => {
      try {
        const win = getMainWindow()
        const defaultName = `prompt-library-diagnostics_${new Date()
          .toISOString()
          .slice(0, 10)}.json`
        const result = await dialog.showSaveDialog(win ?? undefined!, {
          title: 'Export diagnostics report',
          defaultPath: path.join(safePath('documents'), defaultName),
          filters: [{ name: 'JSON', extensions: ['json'] }]
        })
        if (result.canceled || !result.filePath) return fail('Cancelled')
        const info = buildDiagnostics()
        await fsp.writeFile(
          result.filePath,
          JSON.stringify(info, null, 2),
          'utf8'
        )
        return ok({ path: result.filePath })
      } catch (e) {
        return fail(e)
      }
    }
  )
}
