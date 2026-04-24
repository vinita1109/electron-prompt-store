import { ipcMain } from 'electron'
import Store from 'electron-store'
import { DEFAULT_SETTINGS } from '../../shared/types'
import type { IpcResult, Settings } from '../../shared/types'

let store: Store<Settings> | null = null

export function initSettings(): Store<Settings> {
  if (store) return store
  store = new Store<Settings>({
    name: 'settings',
    defaults: DEFAULT_SETTINGS,
    clearInvalidConfig: true
  })
  return store
}

export function getSettingsStore(): Store<Settings> {
  if (!store) throw new Error('Settings store not initialized')
  return store
}

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function fail(error: unknown): IpcResult<never> {
  const message = error instanceof Error ? error.message : String(error)
  return { success: false, error: message }
}

export function registerSettingsIpc(): void {
  ipcMain.handle('settings:all', (): IpcResult<Settings> => {
    try {
      return ok(getSettingsStore().store)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    'settings:get',
    <K extends keyof Settings>(_e: Electron.IpcMainInvokeEvent, key: K): IpcResult<Settings[K]> => {
      try {
        return ok(getSettingsStore().get(key))
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'settings:set',
    <K extends keyof Settings>(
      _e: Electron.IpcMainInvokeEvent,
      key: K,
      value: Settings[K]
    ): IpcResult<true> => {
      try {
        getSettingsStore().set(key, value)
        return ok(true as const)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'settings:patch',
    (_e, patch: Partial<Settings>): IpcResult<Settings> => {
      try {
        const s = getSettingsStore()
        for (const [k, v] of Object.entries(patch)) {
          s.set(k as keyof Settings, v as Settings[keyof Settings])
        }
        return ok(s.store)
      } catch (e) {
        return fail(e)
      }
    }
  )
}
