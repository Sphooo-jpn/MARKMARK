// Shared test doubles: a fake preload API and a fake editor factory that honor
// the contracts of window.markmark / createEditor without Electron or Milkdown.
import { createApp } from '../../src/renderer/src/app.js'

export function createFakeApi({ launchFile = null } = {}) {
  const calls = { saveFile: [], saveFileAs: [], setDirty: [], setTitle: [], forceClose: 0 }
  let menuCb = null
  let fileOpenedCb = null
  let openFileResult = null
  const saveAsResults = []

  return {
    calls,
    // --- window.markmark contract ---
    getLaunchFile: async () => launchFile,
    openFile: async () => openFileResult,
    readFile: async (path) => ({ path, content: '' }),
    saveFile: async (path, content) => {
      calls.saveFile.push({ path, content })
      return true
    },
    saveFileAs: async (content, suggestedName) => {
      calls.saveFileAs.push({ content, suggestedName })
      return saveAsResults.length ? saveAsResults.shift() : null
    },
    setDirty: (dirty) => calls.setDirty.push(dirty),
    setTitle: (title) => calls.setTitle.push(title),
    forceClose: () => {
      calls.forceClose += 1
    },
    onFileOpened: (cb) => {
      fileOpenedCb = cb
      return () => {
        fileOpenedCb = null
      }
    },
    onMenuAction: (cb) => {
      menuCb = cb
      return () => {
        menuCb = null
      }
    },

    // --- test controls ---
    setOpenFileResult: (res) => {
      openFileResult = res
    },
    queueSaveAsResult: (...paths) => {
      saveAsResults.push(...paths)
    },
    emitFileOpened: (payload) => fileOpenedCb?.(payload),
    emitMenu: (action) => menuCb?.(action)
  }
}

export function createFakeEditorFactory() {
  const editors = []
  const factory = async ({ root, markdown, onChange }) => {
    const editor = {
      content: markdown ?? '',
      destroyed: false,
      root,
      getMarkdown() {
        return this.content
      },
      async destroy() {
        this.destroyed = true
      },
      // test helpers: simulate the user editing
      type(text) {
        this.content += text
        onChange?.()
      },
      setContent(text) {
        this.content = text
        onChange?.()
      }
    }
    editors.push(editor)
    return editor
  }
  factory.editors = editors
  return factory
}

export function setupDom() {
  document.body.innerHTML = `
    <div id="app">
      <nav id="tabbar"></nav>
      <div id="editor-area"></div>
      <footer id="statusbar">
        <span id="status-path"></span>
        <span id="status-stats"></span>
        <span id="status-theme">◐</span>
      </footer>
    </div>`
  return {
    tabbar: document.getElementById('tabbar'),
    editorArea: document.getElementById('editor-area'),
    statusPath: document.getElementById('status-path'),
    statusStats: document.getElementById('status-stats')
  }
}

export function createMemoryStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v))
  }
}

/** Assemble a full app instance wired to fakes (happy-dom environment required). */
export function buildApp({ launchFile = null, welcomeMarkdown = '# welcome' } = {}) {
  const api = createFakeApi({ launchFile })
  const editorFactory = createFakeEditorFactory()
  const elements = setupDom()
  const storage = createMemoryStorage()
  const confirmState = { result: true, calls: [] }
  const app = createApp({
    api,
    createEditor: editorFactory,
    elements,
    confirm: (message) => {
      confirmState.calls.push(message)
      return confirmState.result
    },
    storage,
    welcomeMarkdown
  })
  return { app, api, editorFactory, elements, storage, confirmState }
}

/** The editor instance backing the currently active tab. */
export function activeEditor(app) {
  return app.runtimes.get(app.store.getActiveId())?.editor ?? null
}

/** Minimal keydown-like event object for app.handleKeydown. */
export function key(k, { ctrl = true, shift = false } = {}) {
  return { key: k, ctrlKey: ctrl, metaKey: false, shiftKey: shift, preventDefault() {} }
}
