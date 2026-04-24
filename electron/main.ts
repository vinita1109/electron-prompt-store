import { app, BrowserWindow, Menu, nativeTheme, shell } from 'electron'
import path from 'node:path'
import { initDatabase, closeDatabase } from './db/database'
import { registerPromptIpc } from './ipc/prompts'
import { registerFilesystemIpc } from './ipc/filesystem'
import { registerSettingsIpc, initSettings, getSettingsStore } from './ipc/settings'
import { registerDiagnosticsIpc } from './ipc/diagnostics'
const isDev = process.env.IS_DEV === 'true' || !app.isPackaged
let mainWindow: BrowserWindow | null = null

function createWindow(): void {
  const store = getSettingsStore()
  const bounds = store.get('windowBounds')

  mainWindow = new BrowserWindow({
    x: bounds.x,
    y: bounds.y,
    width: bounds.width ?? 1280,
    height: bounds.height ?? 820,
    minWidth: 960,
    minHeight: 600,
    show: false,
    backgroundColor: nativeTheme.shouldUseDarkColors ? '#0b0b0e' : '#fafafa',
    title: 'Prompt Library',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      webSecurity: true
    }
  })

  if (isDev) {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools({ mode: 'detach' })
  } else {
    mainWindow.loadFile(path.join(app.getAppPath(), 'out', 'index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show()
  })

  const persistBounds = () => {
    if (!mainWindow || mainWindow.isDestroyed()) return
    const b = mainWindow.getBounds()
    store.set('windowBounds', {
      x: b.x,
      y: b.y,
      width: b.width,
      height: b.height
    })
  }
  mainWindow.on('resize', persistBounds)
  mainWindow.on('move', persistBounds)

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

function buildApplicationMenu(): void {
  const isMac = process.platform === 'darwin'
  const send = (channel: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel)
    }
  }

  const template: Electron.MenuItemConstructorOptions[] = [
    ...(isMac
      ? [
          {
            label: app.name,
            submenu: [
              { role: 'about' as const },
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => send('menu:settings')
              },
              { type: 'separator' as const },
              { role: 'services' as const },
              { type: 'separator' as const },
              { role: 'hide' as const },
              { role: 'hideOthers' as const },
              { role: 'unhide' as const },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ]
          }
        ]
      : []),
    {
      label: 'File',
      submenu: [
        {
          label: 'New Prompt',
          accelerator: 'CmdOrCtrl+N',
          click: () => send('menu:new-prompt')
        },
        {
          label: 'Duplicate Prompt',
          accelerator: 'CmdOrCtrl+D',
          click: () => send('menu:duplicate-prompt')
        },
        { type: 'separator' },
        {
          label: 'Force Backup',
          accelerator: 'CmdOrCtrl+S',
          click: () => send('menu:force-backup')
        },
        ...(isMac
          ? []
          : [
              { type: 'separator' as const },
              {
                label: 'Settings…',
                accelerator: 'CmdOrCtrl+,',
                click: () => send('menu:settings')
              },
              { type: 'separator' as const },
              { role: 'quit' as const }
            ])
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' },
        { type: 'separator' },
        {
          label: 'Find / Search',
          accelerator: 'CmdOrCtrl+K',
          click: () => send('menu:focus-search')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      role: 'window',
      submenu: isMac
        ? [
            { role: 'minimize' },
            { role: 'zoom' },
            { type: 'separator' },
            { role: 'front' }
          ]
        : [{ role: 'minimize' }, { role: 'close' }]
    }
  ]

  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

app.whenReady().then(() => {
  initSettings()
  initDatabase()
  registerPromptIpc()
  registerFilesystemIpc(() => mainWindow)
  registerSettingsIpc()
  registerDiagnosticsIpc(() => mainWindow)

  buildApplicationMenu()
  createWindow()

  nativeTheme.on('updated', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('system:theme-changed', {
        theme: nativeTheme.shouldUseDarkColors ? 'dark' : 'light'
      })
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  closeDatabase()
})

app.on('web-contents-created', (_event, contents) => {
  contents.on('will-navigate', (event, navigationUrl) => {
    try {
      const parsed = new URL(navigationUrl)
      if (isDev && parsed.origin === 'http://localhost:3000') return
      if (!isDev && parsed.protocol === 'file:') return
      event.preventDefault()
      shell.openExternal(navigationUrl)
    } catch {
      event.preventDefault()
    }
  })
})

