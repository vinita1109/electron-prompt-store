'use client'

import { useEffect, useState } from 'react'
import { FolderOpen, FileDown, CheckCircle2, AlertTriangle, RefreshCw } from 'lucide-react'
import { api, formatBytes } from '../lib/api'
import type { DiagnosticsInfo } from '../lib/types'
import { useToast } from '../lib/store'

export function DiagnosticsPanel() {
  const [info, setInfo] = useState<DiagnosticsInfo | null>(null)
  const [loading, setLoading] = useState(false)
  const [writeTest, setWriteTest] = useState<
    | { status: 'idle' }
    | { status: 'ok'; folder: string; bytes: number }
    | { status: 'err'; error: string }
  >({ status: 'idle' })
  const toast = useToast()

  const refresh = async () => {
    setLoading(true)
    try {
      setInfo(await api.diag.info())
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Diagnostics failed',
        description: (e as Error).message
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  const openDb = async () => {
    try {
      await api.diag.openDbFolder()
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Could not open folder',
        description: (e as Error).message
      })
    }
  }

  const exportReport = async () => {
    try {
      const res = await api.diag.exportReport()
      toast.push({
        kind: 'success',
        title: 'Diagnostics exported',
        description: res.path
      })
    } catch (e) {
      toast.push({
        kind: 'error',
        title: 'Export failed',
        description: (e as Error).message
      })
    }
  }

  const testWrite = async () => {
    try {
      const res = await api.fs.testWrite()
      setWriteTest({ status: 'ok', folder: res.folder, bytes: res.bytes })
      toast.push({
        kind: 'success',
        title: 'Write test passed',
        description: res.folder
      })
    } catch (e) {
      const msg = (e as Error).message
      setWriteTest({ status: 'err', error: msg })
      toast.push({
        kind: 'error',
        title: 'Write test failed',
        description: msg
      })
    }
  }

  if (!info) {
    return (
      <div className="text-sm text-surface-500 dark:text-surface-300 py-6 text-center">
        {loading ? 'Loading diagnostics…' : 'No diagnostics available.'}
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <section>
        <HeaderRow title="App">
          <button type="button" onClick={refresh} className="btn-ghost !text-xs">
            <RefreshCw className="h-3.5 w-3.5" /> Refresh
          </button>
        </HeaderRow>
        <Grid>
          <Info label="App version" value={info.appVersion} mono />
          <Info label="Electron" value={info.electronVersion} mono />
          <Info label="Node" value={info.nodeVersion} mono />
          <Info label="Chrome" value={info.chromeVersion} mono />
          <Info label="Platform" value={`${info.platform} ${info.arch}`} mono />
        </Grid>
      </section>

      <section>
        <HeaderRow title="Database">
          <button type="button" onClick={openDb} className="btn-ghost !text-xs">
            <FolderOpen className="h-3.5 w-3.5" /> Reveal
          </button>
        </HeaderRow>
        <Grid>
          <Info label="File" value={info.database.path} mono full />
          <Info
            label="Size"
            value={formatBytes(info.database.sizeBytes)}
            mono
          />
          <Info
            label="Prompts"
            value={String(info.database.promptsCount)}
            mono
          />
          <Info label="Tags" value={String(info.database.tagsCount)} mono />
          <Info
            label="Schema version"
            value={String(info.database.schemaVersion)}
            mono
          />
        </Grid>
      </section>

      <section>
        <HeaderRow title="Paths" />
        <Grid>
          <Info label="User data" value={info.paths.userData} mono full />
          <Info label="Documents" value={info.paths.documents} mono full />
          <Info label="Downloads" value={info.paths.downloads} mono full />
          <Info label="Temp" value={info.paths.temp} mono full />
          <Info label="Home" value={info.paths.home} mono full />
        </Grid>
      </section>

      <section>
        <HeaderRow title="Actions" />
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={exportReport} className="btn-secondary">
            <FileDown className="h-3.5 w-3.5" /> Export diagnostics report
          </button>
          <button type="button" onClick={testWrite} className="btn-secondary">
            Test write permissions
          </button>
        </div>
        {writeTest.status === 'ok' && (
          <div className="mt-2 rounded-md bg-emerald-50 dark:bg-emerald-950/30 p-2 text-xs text-emerald-700 dark:text-emerald-300 flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>
              Wrote {formatBytes(writeTest.bytes)} to{' '}
              <span className="mono">{writeTest.folder}</span>
            </span>
          </div>
        )}
        {writeTest.status === 'err' && (
          <div className="mt-2 rounded-md bg-rose-50 dark:bg-rose-950/40 p-2 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" />
            <span>{writeTest.error}</span>
          </div>
        )}
      </section>
    </div>
  )
}

function HeaderRow({
  title,
  children
}: {
  title: string
  children?: React.ReactNode
}) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h3 className="text-xs font-semibold uppercase tracking-wider text-surface-500 dark:text-surface-300">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Grid({ children }: { children: React.ReactNode }) {
  return (
    <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5 text-xs">
      {children}
    </dl>
  )
}

function Info({
  label,
  value,
  mono,
  full
}: {
  label: string
  value: string
  mono?: boolean
  full?: boolean
}) {
  return (
    <div className={full ? 'sm:col-span-2' : ''}>
      <dt className="text-surface-400 dark:text-surface-300">{label}</dt>
      <dd
        className={`truncate ${mono ? 'mono' : ''} text-surface-900 dark:text-surface-100`}
        title={value}
      >
        {value || '—'}
      </dd>
    </div>
  )
}
