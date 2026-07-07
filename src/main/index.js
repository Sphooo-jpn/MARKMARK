import { app, BrowserWindow, ipcMain, dialog, Menu, shell } from 'electron'
import { join } from 'path'
import { readFile, writeFile } from 'fs/promises'
import { existsSync } from 'fs'
import { findFilePathInArgv } from './argv.js'

const isDev = !app.isPackaged

/** @type {BrowserWindow | null} */
let mainWindow = null
/** File path passed at launch (double-click / "open with"), consumed by renderer on ready. */
let pendingFilePath = null
/** Renderer-reported unsaved state (any dirty tab), used to guard window close. */
let isDirty = false
/** Set true while we programmatically force-close after the save dialog. */
let forceClose = false

const argvEnv = { isDev, exists: existsSync }

async function readMarkdownFile(filePath) {
  const content = await readFile(filePath, 'utf8')
  return { path: filePath, content }
}

/** Push an opened file to the renderer (used at launch and for second-instance). */
async function openFileInRenderer(filePath) {
  if (!mainWindow) return
  try {
    const payload = await readMarkdownFile(filePath)
    mainWindow.webContents.send('file:opened', payload)
  } catch (err) {
    dialog.showErrorBox('ファイルを開けませんでした', `${filePath}\n\n${err.message}`)
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1000,
    height: 720,
    minWidth: 480,
    minHeight: 320,
    backgroundColor: '#ffffff',
    title: 'MARKMARK',
    autoHideMenuBar: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  // Load renderer: dev server in development, built file in production.
  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Guard against closing with unsaved changes.
  mainWindow.on('close', (e) => {
    if (isDirty && !forceClose) {
      e.preventDefault()
      promptSaveBeforeClose()
    }
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })

  // Open external links in the default browser instead of inside the app.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url.startsWith('http://') || url.startsWith('https://')) {
      shell.openExternal(url)
    }
    return { action: 'deny' }
  })
}

async function promptSaveBeforeClose() {
  const { response } = await dialog.showMessageBox(mainWindow, {
    type: 'warning',
    buttons: ['保存', '保存しない', 'キャンセル'],
    defaultId: 0,
    cancelId: 2,
    message: '変更が保存されていません',
    detail: '未保存のタブがあります。閉じる前に保存しますか？'
  })
  if (response === 2) return // cancel
  if (response === 1) {
    // discard
    forceClose = true
    mainWindow.close()
    return
  }
  // save: ask renderer to save, then close
  mainWindow.webContents.send('menu:action', 'save-and-close')
}

// ---------------------------------------------------------------------------
// Menu
// ---------------------------------------------------------------------------
function buildMenu() {
  const send = (action) => () => mainWindow?.webContents.send('menu:action', action)
  const template = [
    {
      label: 'ファイル',
      submenu: [
        { label: '新規タブ', accelerator: 'CmdOrCtrl+N', click: send('new') },
        { label: '開く…（新しいタブ）', accelerator: 'CmdOrCtrl+O', click: send('open') },
        { type: 'separator' },
        { label: '保存', accelerator: 'CmdOrCtrl+S', click: send('save') },
        { label: '名前を付けて保存…', accelerator: 'CmdOrCtrl+Shift+S', click: send('save-as') },
        { type: 'separator' },
        { role: 'quit', label: '終了' }
      ]
    },
    {
      label: 'タブ',
      submenu: [
        { label: '新しいタブ', accelerator: 'CmdOrCtrl+T', click: send('new-tab') },
        { label: 'タブを閉じる', accelerator: 'CmdOrCtrl+W', click: send('close-tab') },
        { type: 'separator' },
        { label: '次のタブ', accelerator: 'Control+Tab', click: send('next-tab') },
        { label: '前のタブ', accelerator: 'Control+Shift+Tab', click: send('prev-tab') }
      ]
    },
    {
      label: '編集',
      submenu: [
        { role: 'undo', label: '元に戻す' },
        { role: 'redo', label: 'やり直し' },
        { type: 'separator' },
        { role: 'cut', label: '切り取り' },
        { role: 'copy', label: 'コピー' },
        { role: 'paste', label: '貼り付け' },
        { role: 'selectAll', label: 'すべて選択' }
      ]
    },
    {
      label: '表示',
      submenu: [
        { label: 'テーマ切替(ダーク/ライト)', accelerator: 'CmdOrCtrl+D', click: send('toggle-theme') },
        { type: 'separator' },
        { role: 'resetZoom', label: 'ズームをリセット' },
        { role: 'zoomIn', label: '拡大' },
        { role: 'zoomOut', label: '縮小' },
        { type: 'separator' },
        { role: 'togglefullscreen', label: '全画面表示' },
        ...(isDev ? [{ role: 'toggleDevTools', label: 'デベロッパーツール' }] : [])
      ]
    },
    {
      label: 'ヘルプ',
      submenu: [
        {
          label: 'MARKMARK について',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'MARKMARK について',
              message: 'MARKMARK',
              detail: `Typora風インラインWYSIWYG Markdownエディタ\nバージョン ${app.getVersion()}\nElectron ${process.versions.electron}`
            })
          }
        }
      ]
    }
  ]
  Menu.setApplicationMenu(Menu.buildFromTemplate(template))
}

// ---------------------------------------------------------------------------
// IPC handlers
// ---------------------------------------------------------------------------
function registerIpc() {
  // Renderer asks for the file (if any) MARKMARK was launched with.
  ipcMain.handle('app:get-launch-file', async () => {
    if (!pendingFilePath) return null
    const p = pendingFilePath
    pendingFilePath = null
    try {
      return await readMarkdownFile(p)
    } catch {
      return null
    }
  })

  // Open dialog -> returns {path, content} or null.
  ipcMain.handle('file:open', async () => {
    const { canceled, filePaths } = await dialog.showOpenDialog(mainWindow, {
      title: 'Markdown を開く',
      properties: ['openFile'],
      filters: [
        { name: 'Markdown', extensions: ['md', 'markdown', 'mdown', 'mkd'] },
        { name: 'すべてのファイル', extensions: ['*'] }
      ]
    })
    if (canceled || filePaths.length === 0) return null
    return readMarkdownFile(filePaths[0])
  })

  // Read a specific path (e.g. drag & drop).
  ipcMain.handle('file:read', async (_e, filePath) => {
    return readMarkdownFile(filePath)
  })

  // Save to a known path.
  ipcMain.handle('file:save', async (_e, filePath, content) => {
    await writeFile(filePath, content, 'utf8')
    return true
  })

  // Save As dialog -> writes and returns the chosen path, or null if canceled.
  ipcMain.handle('file:save-as', async (_e, content, suggestedName) => {
    const { canceled, filePath } = await dialog.showSaveDialog(mainWindow, {
      title: '名前を付けて保存',
      defaultPath: suggestedName || 'untitled.md',
      filters: [{ name: 'Markdown', extensions: ['md'] }]
    })
    if (canceled || !filePath) return null
    await writeFile(filePath, content, 'utf8')
    return filePath
  })

  // Renderer reports its dirty state (drives the close guard).
  ipcMain.on('state:dirty', (_e, dirty) => {
    isDirty = !!dirty
  })

  // Renderer reports the window title.
  ipcMain.on('state:title', (_e, title) => {
    if (mainWindow) mainWindow.setTitle(title || 'MARKMARK')
  })

  // Renderer confirms save-and-close finished (or a hard close requested).
  ipcMain.on('window:force-close', () => {
    forceClose = true
    mainWindow?.close()
  })
}

// ---------------------------------------------------------------------------
// App lifecycle + single instance
// ---------------------------------------------------------------------------
// Isolated userData (separate single-instance lock) so a test/dev instance can
// run alongside an installed MARKMARK: MARKMARK_USER_DATA=<dir>.
if (process.env.MARKMARK_USER_DATA) {
  app.setPath('userData', process.env.MARKMARK_USER_DATA)
}
const gotLock = app.requestSingleInstanceLock()
if (!gotLock) {
  app.quit()
} else {
  app.on('second-instance', (_event, argv) => {
    // Another instance was launched (e.g. user double-clicked another .md).
    const filePath = findFilePathInArgv(argv, argvEnv)
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore()
      mainWindow.focus()
      if (filePath) openFileInRenderer(filePath)
    }
  })

  // macOS: file opened via Finder / dock.
  app.on('open-file', (event, filePath) => {
    event.preventDefault()
    if (mainWindow) openFileInRenderer(filePath)
    else pendingFilePath = filePath
  })

  app.whenReady().then(() => {
    pendingFilePath = findFilePathInArgv(process.argv, argvEnv)
    registerIpc()
    buildMenu()
    createWindow()

    app.on('activate', () => {
      if (BrowserWindow.getAllWindows().length === 0) createWindow()
    })
  })

  app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') app.quit()
  })
}
