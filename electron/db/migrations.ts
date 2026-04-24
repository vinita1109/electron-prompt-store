import type Database from 'better-sqlite3'

export const CURRENT_SCHEMA_VERSION = 1

interface Migration {
  version: number
  up: (db: Database.Database) => void
}

const migrations: Migration[] = [
  {
    version: 1,
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS prompts (
          id TEXT PRIMARY KEY,
          title TEXT NOT NULL,
          content TEXT NOT NULL,
          description TEXT NOT NULL DEFAULT '',
          category TEXT NOT NULL DEFAULT 'Other',
          model_target TEXT NOT NULL DEFAULT 'Any',
          is_favorite INTEGER NOT NULL DEFAULT 0,
          attachment_paths TEXT NOT NULL DEFAULT '[]',
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );

        CREATE TABLE IF NOT EXISTS tags (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL UNIQUE COLLATE NOCASE
        );

        CREATE TABLE IF NOT EXISTS prompt_tags (
          prompt_id TEXT NOT NULL REFERENCES prompts(id) ON DELETE CASCADE,
          tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
          PRIMARY KEY (prompt_id, tag_id)
        );

        CREATE INDEX IF NOT EXISTS idx_prompts_category ON prompts(category);
        CREATE INDEX IF NOT EXISTS idx_prompts_favorite ON prompts(is_favorite);
        CREATE INDEX IF NOT EXISTS idx_prompts_updated ON prompts(updated_at DESC);
        CREATE INDEX IF NOT EXISTS idx_prompt_tags_tag ON prompt_tags(tag_id);
      `)
    }
  }
]

export function applyMigrations(db: Database.Database): number {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _meta (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `)

  const currentRow = db
    .prepare<[string], { value: string }>(
      'SELECT value FROM _meta WHERE key = ?'
    )
    .get('schema_version')

  const current = currentRow ? parseInt(currentRow.value, 10) : 0

  const pending = migrations.filter((m) => m.version > current)
  if (pending.length === 0) return current

  const setVersion = db.prepare(
    'INSERT INTO _meta(key, value) VALUES(?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
  )

  const runAll = db.transaction(() => {
    for (const migration of pending) {
      migration.up(db)
      setVersion.run('schema_version', String(migration.version))
    }
  })
  runAll()

  return CURRENT_SCHEMA_VERSION
}

export function getSchemaVersion(db: Database.Database): number {
  try {
    const row = db
      .prepare<[string], { value: string }>(
        'SELECT value FROM _meta WHERE key = ?'
      )
      .get('schema_version')
    return row ? parseInt(row.value, 10) : 0
  } catch {
    return 0
  }
}
