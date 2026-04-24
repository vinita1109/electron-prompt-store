import { ipcMain } from 'electron'
import {
  createPrompt,
  updatePrompt,
  deletePrompt,
  duplicatePrompt,
  getPrompt,
  listPrompts,
  listCategories,
  listTags,
  renameTag,
  deleteTag,
  mergeTags
} from '../db/database'
import { runAutoBackupIfEnabled } from './filesystem'
import type {
  IpcResult,
  Prompt,
  PromptFilters,
  PromptInput
} from '../../shared/types'

function ok<T>(data: T): IpcResult<T> {
  return { success: true, data }
}

function fail(error: unknown): IpcResult<never> {
  const message = error instanceof Error ? error.message : String(error)
  return { success: false, error: message }
}

export function registerPromptIpc(): void {
  ipcMain.handle(
    'prompts:list',
    (_e, filters: PromptFilters = {}): IpcResult<Prompt[]> => {
      try {
        return ok(listPrompts(filters ?? {}))
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'prompts:get',
    (_e, id: string): IpcResult<Prompt | null> => {
      try {
        return ok(getPrompt(id))
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'prompts:create',
    async (_e, input: PromptInput): Promise<IpcResult<Prompt>> => {
      try {
        const created = createPrompt(input)
        void runAutoBackupIfEnabled()
        return ok(created)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'prompts:update',
    async (_e, id: string, input: PromptInput): Promise<IpcResult<Prompt>> => {
      try {
        const updated = updatePrompt(id, input)
        void runAutoBackupIfEnabled()
        return ok(updated)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'prompts:delete',
    async (_e, id: string): Promise<IpcResult<true>> => {
      try {
        deletePrompt(id)
        void runAutoBackupIfEnabled()
        return ok(true as const)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'prompts:duplicate',
    async (_e, id: string): Promise<IpcResult<Prompt>> => {
      try {
        const dup = duplicatePrompt(id)
        void runAutoBackupIfEnabled()
        return ok(dup)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle('categories:list', (): IpcResult<string[]> => {
    try {
      return ok(listCategories())
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    'tags:list',
    (): IpcResult<Array<{ name: string; count: number }>> => {
      try {
        return ok(listTags())
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle(
    'tags:rename',
    (_e, oldName: string, newName: string): IpcResult<true> => {
      try {
        renameTag(oldName, newName)
        return ok(true as const)
      } catch (e) {
        return fail(e)
      }
    }
  )

  ipcMain.handle('tags:delete', (_e, name: string): IpcResult<true> => {
    try {
      deleteTag(name)
      return ok(true as const)
    } catch (e) {
      return fail(e)
    }
  })

  ipcMain.handle(
    'tags:merge',
    (_e, sources: string[], target: string): IpcResult<true> => {
      try {
        mergeTags(sources, target)
        return ok(true as const)
      } catch (e) {
        return fail(e)
      }
    }
  )
}
