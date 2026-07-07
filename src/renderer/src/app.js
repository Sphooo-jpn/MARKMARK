// Renderer application controller: tab strip, per-tab editors, file actions,
// dirty tracking, theme and status bar.
//
// Every environment dependency (IPC api, editor factory, DOM elements, confirm,
// storage) is injected so the whole controller can run under a DOM emulator in
// tests, without Electron or Milkdown.
import { createTabStore, basename } from './tab-store.js'

/**
 * @param {{
 *   api: object,                       // window.markmark (preload bridge)
 *   createEditor: Function,            // ({root, markdown, onChange}) => Promise<{getMarkdown, destroy}>
 *   elements: {tabbar: HTMLElement, editorArea: HTMLElement, statusPath: HTMLElement, statusStats: HTMLElement},
 *   confirm: (message: string) => boolean,
 *   storage: {getItem: Function, setItem: Function},
 *   welcomeMarkdown?: string
 * }} deps
 */
export function createApp({ api, createEditor, elements, confirm, storage, welcomeMarkdown = '' }) {
  const { tabbar, editorArea, statusPath, statusStats } = elements
  const doc = tabbar.ownerDocument
  const store = createTabStore()
  /** Per-tab runtime: editor instance, host element, saved scroll, clean baseline. */
  const runtimes = new Map()

  // --- dirty tracking ---------------------------------------------------

  function syncDirty() {
    api.setDirty(store.anyDirty())
  }

  function onEditorChange(id) {
    const rt = runtimes.get(id)
    if (!rt) return // change event fired while the editor is still being mounted
    const changed = store.setDirty(id, rt.editor.getMarkdown() !== rt.baseline)
    if (changed) {
      syncDirty()
      renderTabs()
    }
    if (id === store.getActiveId()) updateStatus()
  }

  function markClean(id, markdown) {
    const rt = runtimes.get(id)
    if (rt) rt.baseline = markdown
    if (store.setDirty(id, false)) syncDirty()
    renderTabs()
    updateStatus()
  }

  // --- tabs ---------------------------------------------------------------

  /**
   * Open content in a new tab. If `path` is already open, just focus that tab
   * (the old single-document behavior of replacing the current file is gone).
   */
  async function openTab(path, content) {
    if (path) {
      const existing = store.findByPath(path)
      if (existing) {
        await activateTab(existing.id)
        return existing
      }
    }
    const tab = store.add({ path })
    const host = doc.createElement('div')
    host.className = 'editor-host'
    host.style.display = 'none'
    editorArea.appendChild(host)
    const editor = await createEditor({
      root: host,
      markdown: content ?? '',
      onChange: () => onEditorChange(tab.id)
    })
    // Use the editor's normalized serialization as the clean baseline, so Crepe's
    // parse/serialize round-trip doesn't falsely flag an untouched document as dirty.
    runtimes.set(tab.id, { editor, host, scrollTop: 0, baseline: editor.getMarkdown() })
    await activateTab(tab.id)
    return tab
  }

  async function activateTab(id) {
    if (!store.get(id)) return
    const prev = store.getActive()
    if (prev && prev.id !== id) {
      const prevRt = runtimes.get(prev.id)
      if (prevRt) {
        // display:none drops layout (and with it scrollTop), so stash it.
        prevRt.scrollTop = prevRt.host.scrollTop
        prevRt.host.style.display = 'none'
      }
    }
    store.activate(id)
    const rt = runtimes.get(id)
    if (rt) {
      rt.host.style.display = ''
      rt.host.scrollTop = rt.scrollTop
    }
    renderTabs()
    updateStatus()
  }

  /** Close a tab (confirming if dirty). The last tab is replaced by a fresh empty one. */
  async function closeTab(id) {
    const tab = store.get(id)
    if (!tab) return false
    if (tab.dirty && !confirm(`「${store.title(id)}」の変更が保存されていません。破棄して閉じますか？`)) {
      return false
    }
    const rt = runtimes.get(id)
    runtimes.delete(id)
    if (rt) {
      await rt.editor.destroy()
      rt.host.remove()
    }
    const nextActive = store.close(id)
    syncDirty()
    if (store.count() === 0) {
      await openTab(null, '')
    } else {
      await activateTab(nextActive)
    }
    return true
  }

  // --- save ---------------------------------------------------------------

  async function saveTab(id = store.getActiveId()) {
    const rt = runtimes.get(id)
    if (!rt) return false
    const tab = store.get(id)
    const md = rt.editor.getMarkdown()
    if (tab.path) {
      await api.saveFile(tab.path, md)
    } else {
      const path = await api.saveFileAs(md, `${store.title(id)}.md`)
      if (!path) return false
      store.setPath(id, path)
    }
    markClean(id, md)
    return true
  }

  async function saveTabAs(id = store.getActiveId()) {
    const rt = runtimes.get(id)
    if (!rt) return false
    const tab = store.get(id)
    const md = rt.editor.getMarkdown()
    const suggested = tab.path ? basename(tab.path) : `${store.title(id)}.md`
    const path = await api.saveFileAs(md, suggested)
    if (!path) return false
    store.setPath(id, path)
    markClean(id, md)
    return true
  }

  /** Save every dirty tab, then let main close the window. Any canceled dialog aborts. */
  async function saveAllAndClose() {
    for (const tab of store.listDirty()) {
      await activateTab(tab.id) // show which document the (possible) Save As dialog is for
      const ok = await saveTab(tab.id)
      if (!ok) return
    }
    api.forceClose()
  }

  // --- UI -------------------------------------------------------------------

  function renderTabs() {
    tabbar.textContent = ''
    for (const tab of store.list()) {
      const el = doc.createElement('div')
      el.className = 'tab' + (tab.id === store.getActiveId() ? ' tab-active' : '')
      el.dataset.tabId = String(tab.id)
      el.title = tab.path || store.title(tab.id)

      const label = doc.createElement('span')
      label.className = 'tab-label'
      label.textContent = (tab.dirty ? '● ' : '') + store.title(tab.id)
      el.appendChild(label)

      const close = doc.createElement('span')
      close.className = 'tab-close'
      close.textContent = '×'
      close.title = 'タブを閉じる (Ctrl+W)'
      close.addEventListener('click', (e) => {
        e.stopPropagation()
        closeTab(tab.id)
      })
      el.appendChild(close)

      el.addEventListener('click', () => activateTab(tab.id))
      el.addEventListener('auxclick', (e) => {
        if (e.button === 1) closeTab(tab.id)
      })
      tabbar.appendChild(el)
    }
    const plus = doc.createElement('div')
    plus.className = 'tab-new'
    plus.textContent = '+'
    plus.title = '新しいタブ (Ctrl+T)'
    plus.addEventListener('click', () => openTab(null, ''))
    tabbar.appendChild(plus)
  }

  function updateStatus() {
    const tab = store.getActive()
    const rt = tab && runtimes.get(tab.id)
    const name = tab ? store.title(tab.id) : 'untitled'
    statusPath.textContent = (tab?.dirty ? '● ' : '') + (tab?.path || name)
    const md = rt ? rt.editor.getMarkdown() : ''
    const words = (md.trim().match(/\S+/g) || []).length
    statusStats.textContent = `${words} words · ${md.length} chars`
    const title = `${tab?.dirty ? '* ' : ''}${name} — MARKMARK`
    doc.title = title
    api.setTitle(title)
  }

  // --- theme ------------------------------------------------------------------

  function applyTheme(theme) {
    doc.body.classList.toggle('theme-dark', theme === 'dark')
    storage.setItem('markmark-theme', theme)
  }

  function toggleTheme() {
    applyTheme(doc.body.classList.contains('theme-dark') ? 'light' : 'dark')
  }

  // --- entry points -------------------------------------------------------------

  async function handleMenuAction(action) {
    switch (action) {
      case 'new':
      case 'new-tab':
        await openTab(null, '')
        break
      case 'open': {
        const res = await api.openFile()
        if (res) await openTab(res.path, res.content)
        break
      }
      case 'save':
        await saveTab()
        break
      case 'save-as':
        await saveTabAs()
        break
      case 'close-tab':
        await closeTab(store.getActiveId())
        break
      case 'next-tab':
        await activateTab(store.nextId())
        break
      case 'prev-tab':
        await activateTab(store.prevId())
        break
      case 'toggle-theme':
        toggleTheme()
        break
      case 'save-and-close':
        await saveAllAndClose()
        break
    }
  }

  /** Fallback shortcuts (the native menu accelerators normally win). Returns true if handled. */
  function handleKeydown(e) {
    if (!(e.ctrlKey || e.metaKey)) return false
    const k = (e.key || '').toLowerCase()
    let handled = true
    if (k === 's' && e.shiftKey) saveTabAs()
    else if (k === 's') saveTab()
    else if (k === 'o') handleMenuAction('open')
    else if (k === 'n' || k === 't') openTab(null, '')
    else if (k === 'w') closeTab(store.getActiveId())
    else if (k === 'd') toggleTheme()
    else if (k === 'tab') handleMenuAction(e.shiftKey ? 'prev-tab' : 'next-tab')
    else if (k === 'pagedown') handleMenuAction('next-tab')
    else if (k === 'pageup') handleMenuAction('prev-tab')
    else handled = false
    if (handled) e.preventDefault()
    return handled
  }

  async function init() {
    applyTheme(storage.getItem('markmark-theme') || 'light')
    api.onMenuAction(handleMenuAction)
    // Files arriving from main (launch argument consumed late, second instance,
    // macOS open-file) each get their own tab — no discard prompt needed anymore.
    api.onFileOpened(({ path, content }) => openTab(path, content))
    const launch = await api.getLaunchFile()
    if (launch) await openTab(launch.path, launch.content)
    else await openTab(null, welcomeMarkdown)
  }

  return {
    init,
    openTab,
    closeTab,
    activateTab,
    saveTab,
    saveTabAs,
    handleMenuAction,
    handleKeydown,
    toggleTheme,
    // introspection (status bar wiring in main.js, assertions in tests)
    store,
    runtimes
  }
}
