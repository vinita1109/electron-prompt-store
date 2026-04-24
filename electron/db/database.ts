import Database from 'better-sqlite3'
import { app } from 'electron'
import path from 'node:path'
import fs from 'node:fs'
import { randomUUID } from 'node:crypto'
import {
  applyMigrations,
  getSchemaVersion
} from './migrations'
import { SEED_PROMPTS } from './seed'
import type {
  Prompt,
  PromptFilters,
  PromptInput
} from '../../shared/types'

let db: Database.Database | null = null
let dbPath = ''

interface PromptRow {
  id: string
  title: string
  content: string
  description: string
  category: string
  model_target: string
  is_favorite: number
  attachment_paths: string
  created_at: number
  updated_at: number
}

function rowToPrompt(row: PromptRow, tags: string[]): Prompt {
  let attachments: string[] = []
  try {
    const parsed = JSON.parse(row.attachment_paths)
    if (Array.isArray(parsed)) attachments = parsed.filter((p) => typeof p === 'string')
  } catch {
    attachments = []
  }
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    description: row.description,
    category: row.category,
    modelTarget: row.model_target,
    isFavorite: row.is_favorite === 1,
    attachmentPaths: attachments,
    tags,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

export function getDatabase(): Database.Database {
  if (!db) throw new Error('Database not initialized — call initDatabase() first')
  return db
}

export function getDatabasePath(): string {
  return dbPath
}

export function getDatabaseSize(): number {
  try {
    return fs.statSync(dbPath).size
  } catch {
    return 0
  }
}

export function initDatabase(): void {
  const userData = app.getPath('userData')
  fs.mkdirSync(userData, { recursive: true })
  dbPath = path.join(userData, 'prompt-library.sqlite')

  db = new Database(dbPath)
  db.pragma('journal_mode = WAL')
  db.pragma('foreign_keys = ON')

  const previousVersion = getSchemaVersion(db)
  applyMigrations(db)

  const countRow = db
    .prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM prompts')
    .get()
  const count = countRow?.c ?? 0

  if (previousVersion === 0 && count === 0) {
    seedDatabase()
  }
}

export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

function seedDatabase(): void {
  for (const input of SEED_PROMPTS) {
    createPrompt(input)
  }
}

function upsertTags(conn: Database.Database, tagNames: string[]): number[] {
  const cleaned = Array.from(
    new Set(
      tagNames
        .map((t) => t.trim())
        .filter((t) => t.length > 0 && t.length <= 48)
    )
  )
  if (cleaned.length === 0) return []

  const insert = conn.prepare('INSERT OR IGNORE INTO tags(name) VALUES(?)')
  const select = conn.prepare<[string], { id: number }>(
    'SELECT id FROM tags WHERE name = ? COLLATE NOCASE'
  )

  const ids: number[] = []
  for (const name of cleaned) {
    insert.run(name)
    const row = select.get(name)
    if (row) ids.push(row.id)
  }
  return ids
}

function getTagsForPrompt(conn: Database.Database, promptId: string): string[] {
  return conn
    .prepare<[string], { name: string }>(
      `SELECT t.name FROM tags t
       INNER JOIN prompt_tags pt ON pt.tag_id = t.id
       WHERE pt.prompt_id = ?
       ORDER BY t.name COLLATE NOCASE ASC`
    )
    .all(promptId)
    .map((r) => r.name)
}

function attachTagsToPrompt(
  conn: Database.Database,
  promptId: string,
  tagIds: number[]
): void {
  const link = conn.prepare(
    'INSERT OR IGNORE INTO prompt_tags(prompt_id, tag_id) VALUES(?, ?)'
  )
  for (const id of tagIds) link.run(promptId, id)
}

function detachAllTags(conn: Database.Database, promptId: string): void {
  conn.prepare('DELETE FROM prompt_tags WHERE prompt_id = ?').run(promptId)
}

function normalizeInput(input: PromptInput): Required<Omit<PromptInput, 'tags'>> & { tags: string[] } {
  return {
    title: (input.title ?? '').trim() || 'Untitled',
    content: input.content ?? '',
    description: input.description ?? '',
    category: input.category ?? 'Other',
    modelTarget: input.modelTarget ?? 'Any',
    isFavorite: Boolean(input.isFavorite),
    attachmentPaths: input.attachmentPaths ?? [],
    tags: input.tags ?? []
  }
}

export function createPrompt(input: PromptInput): Prompt {
  const conn = getDatabase()
  const now = Date.now()
  const id = randomUUID()
  const data = normalizeInput(input)

  const run = conn.transaction(() => {
    conn
      .prepare(
        `INSERT INTO prompts(id, title, content, description, category, model_target, is_favorite, attachment_paths, created_at, updated_at)
         VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        data.title,
        data.content,
        data.description,
        data.category,
        data.modelTarget,
        data.isFavorite ? 1 : 0,
        JSON.stringify(data.attachmentPaths),
        now,
        now
      )
    const tagIds = upsertTags(conn, data.tags)
    attachTagsToPrompt(conn, id, tagIds)
  })
  run()

  const created = getPrompt(id)
  if (!created) throw new Error('Failed to read back created prompt')
  return created
}

export function updatePrompt(id: string, input: PromptInput): Prompt {
  const conn = getDatabase()
  const existing = getPrompt(id)
  if (!existing) throw new Error(`Prompt not found: ${id}`)

  const now = Date.now()
  const data = normalizeInput(input)

  const run = conn.transaction(() => {
    conn
      .prepare(
        `UPDATE prompts
           SET title = ?, content = ?, description = ?, category = ?, model_target = ?,
               is_favorite = ?, attachment_paths = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        data.title,
        data.content,
        data.description,
        data.category,
        data.modelTarget,
        data.isFavorite ? 1 : 0,
        JSON.stringify(data.attachmentPaths),
        now,
        id
      )
    detachAllTags(conn, id)
    const tagIds = upsertTags(conn, data.tags)
    attachTagsToPrompt(conn, id, tagIds)
  })
  run()

  const updated = getPrompt(id)
  if (!updated) throw new Error('Failed to read back updated prompt')
  return updated
}

export function deletePrompt(id: string): void {
  const conn = getDatabase()
  conn.prepare('DELETE FROM prompts WHERE id = ?').run(id)
}

export function duplicatePrompt(id: string): Prompt {
  const existing = getPrompt(id)
  if (!existing) throw new Error(`Prompt not found: ${id}`)
  return createPrompt({
    title: `${existing.title} (copy)`,
    content: existing.content,
    description: existing.description,
    category: existing.category,
    modelTarget: existing.modelTarget,
    isFavorite: false,
    tags: existing.tags,
    attachmentPaths: existing.attachmentPaths
  })
}

export function getPrompt(id: string): Prompt | null {
  const conn = getDatabase()
  const row = conn
    .prepare<[string], PromptRow>('SELECT * FROM prompts WHERE id = ?')
    .get(id)
  if (!row) return null
  return rowToPrompt(row, getTagsForPrompt(conn, id))
}

export function listPrompts(filters: PromptFilters = {}): Prompt[] {
  const conn = getDatabase()
  const where: string[] = []
  const params: unknown[] = []

  if (filters.query && filters.query.trim().length > 0) {
    const q = `%${filters.query.trim().toLowerCase()}%`
    where.push(
      `(LOWER(p.title) LIKE ? OR LOWER(p.content) LIKE ? OR LOWER(p.description) LIKE ?
        OR EXISTS (
          SELECT 1 FROM prompt_tags pt
          INNER JOIN tags t ON t.id = pt.tag_id
          WHERE pt.prompt_id = p.id AND LOWER(t.name) LIKE ?
        ))`
    )
    params.push(q, q, q, q)
  }

  if (filters.categories && filters.categories.length > 0) {
    where.push(
      `p.category IN (${filters.categories.map(() => '?').join(',')})`
    )
    params.push(...filters.categories)
  }

  if (filters.modelTargets && filters.modelTargets.length > 0) {
    where.push(
      `p.model_target IN (${filters.modelTargets.map(() => '?').join(',')})`
    )
    params.push(...filters.modelTargets)
  }

  if (filters.favoritesOnly) {
    where.push('p.is_favorite = 1')
  }

  if (filters.tags && filters.tags.length > 0) {
    const placeholders = filters.tags.map(() => '?').join(',')
    where.push(
      `p.id IN (
        SELECT pt.prompt_id FROM prompt_tags pt
        INNER JOIN tags t ON t.id = pt.tag_id
        WHERE t.name IN (${placeholders}) COLLATE NOCASE
        GROUP BY pt.prompt_id
        HAVING COUNT(DISTINCT t.id) = ${filters.tags.length}
      )`
    )
    params.push(...filters.tags)
  }

  const sql = `
    SELECT p.* FROM prompts p
    ${where.length > 0 ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY p.is_favorite DESC, p.updated_at DESC
  `
  const rows = conn.prepare<unknown[], PromptRow>(sql).all(...params)

  const allTags = conn
    .prepare<[], { prompt_id: string; name: string }>(
      `SELECT pt.prompt_id, t.name
         FROM prompt_tags pt
         INNER JOIN tags t ON t.id = pt.tag_id`
    )
    .all()

  const tagsByPrompt = new Map<string, string[]>()
  for (const { prompt_id, name } of allTags) {
    const arr = tagsByPrompt.get(prompt_id) ?? []
    arr.push(name)
    tagsByPrompt.set(prompt_id, arr)
  }

  return rows.map((row) =>
    rowToPrompt(row, (tagsByPrompt.get(row.id) ?? []).sort())
  )
}

export function listCategories(): string[] {
  const conn = getDatabase()
  return conn
    .prepare<[], { category: string }>(
      'SELECT DISTINCT category FROM prompts ORDER BY category COLLATE NOCASE'
    )
    .all()
    .map((r) => r.category)
}

export function listTags(): Array<{ name: string; count: number }> {
  const conn = getDatabase()
  return conn
    .prepare<[], { name: string; count: number }>(
      `SELECT t.name AS name, COUNT(pt.prompt_id) AS count
         FROM tags t
         LEFT JOIN prompt_tags pt ON pt.tag_id = t.id
         GROUP BY t.id
         ORDER BY count DESC, t.name COLLATE NOCASE ASC`
    )
    .all()
}

export function renameTag(oldName: string, newName: string): void {
  const conn = getDatabase()
  const cleaned = newName.trim()
  if (cleaned.length === 0) throw new Error('Tag name cannot be empty')

  const run = conn.transaction(() => {
    const existing = conn
      .prepare<[string], { id: number }>(
        'SELECT id FROM tags WHERE name = ? COLLATE NOCASE'
      )
      .get(cleaned)

    if (existing) {
      const old = conn
        .prepare<[string], { id: number }>(
          'SELECT id FROM tags WHERE name = ? COLLATE NOCASE'
        )
        .get(oldName)
      if (old && old.id !== existing.id) {
        conn
          .prepare(
            'UPDATE OR IGNORE prompt_tags SET tag_id = ? WHERE tag_id = ?'
          )
          .run(existing.id, old.id)
        conn.prepare('DELETE FROM prompt_tags WHERE tag_id = ?').run(old.id)
        conn.prepare('DELETE FROM tags WHERE id = ?').run(old.id)
      }
    } else {
      conn
        .prepare('UPDATE tags SET name = ? WHERE name = ? COLLATE NOCASE')
        .run(cleaned, oldName)
    }
  })
  run()
}

export function deleteTag(name: string): void {
  const conn = getDatabase()
  conn.prepare('DELETE FROM tags WHERE name = ? COLLATE NOCASE').run(name)
}

export function mergeTags(sources: string[], target: string): void {
  const conn = getDatabase()
  const cleanedTarget = target.trim()
  if (cleanedTarget.length === 0) throw new Error('Target tag name cannot be empty')

  const run = conn.transaction(() => {
    conn.prepare('INSERT OR IGNORE INTO tags(name) VALUES(?)').run(cleanedTarget)
    const targetRow = conn
      .prepare<[string], { id: number }>(
        'SELECT id FROM tags WHERE name = ? COLLATE NOCASE'
      )
      .get(cleanedTarget)
    if (!targetRow) throw new Error('Target tag missing after insert')

    for (const src of sources) {
      if (src.toLowerCase() === cleanedTarget.toLowerCase()) continue
      const srcRow = conn
        .prepare<[string], { id: number }>(
          'SELECT id FROM tags WHERE name = ? COLLATE NOCASE'
        )
        .get(src)
      if (!srcRow) continue
      conn
        .prepare('UPDATE OR IGNORE prompt_tags SET tag_id = ? WHERE tag_id = ?')
        .run(targetRow.id, srcRow.id)
      conn.prepare('DELETE FROM prompt_tags WHERE tag_id = ?').run(srcRow.id)
      conn.prepare('DELETE FROM tags WHERE id = ?').run(srcRow.id)
    }
  })
  run()
}

export function replaceAllPrompts(prompts: PromptInput[]): number {
  const conn = getDatabase()
  const run = conn.transaction(() => {
    conn.prepare('DELETE FROM prompts').run()
    conn.prepare('DELETE FROM tags').run()
    for (const p of prompts) {
      createPrompt(p)
    }
  })
  run()
  return prompts.length
}

export function countPrompts(): number {
  const conn = getDatabase()
  const row = conn
    .prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM prompts')
    .get()
  return row?.c ?? 0
}

export function countTags(): number {
  const conn = getDatabase()
  const row = conn
    .prepare<[], { c: number }>('SELECT COUNT(*) AS c FROM tags')
    .get()
  return row?.c ?? 0
}

export function findPromptByTitle(title: string): Prompt | null {
  const conn = getDatabase()
  const row = conn
    .prepare<[string], PromptRow>(
      'SELECT * FROM prompts WHERE title = ? COLLATE NOCASE LIMIT 1'
    )
    .get(title)
  if (!row) return null
  return rowToPrompt(row, getTagsForPrompt(conn, row.id))
}

export function getAllPromptsForExport(): Prompt[] {
  return listPrompts()
}
