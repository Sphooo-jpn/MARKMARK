// @vitest-environment happy-dom
// Integration: the app controller wired to fake IPC api + fake editors,
// exercising the new tab behavior end-to-end at the renderer level.
import { describe, it, expect } from 'vitest'
import { buildApp, activeEditor, key } from '../helpers/fakes.js'

describe('tabs: opening files', () => {
  it('opening a file adds a tab and keeps the previous document alive', async () => {
    const { app, api, editorFactory } = buildApp()
    await app.init() // welcome tab

    api.setOpenFileResult({ path: 'C:\\docs\\a.md', content: '# A' })
    await api.emitMenu('open')

    expect(app.store.count()).toBe(2)
    expect(app.store.getActive().path).toBe('C:\\docs\\a.md')
    // The old editor must NOT be destroyed — that was the pre-tab behavior.
    expect(editorFactory.editors[0].destroyed).toBe(false)
    expect(editorFactory.editors[0].content).toBe('# welcome')
    expect(activeEditor(app).content).toBe('# A')
  })

  it('opening an already-open path focuses its tab instead of duplicating', async () => {
    const { app, api, editorFactory } = buildApp()
    await app.init()
    await app.openTab('C:\\docs\\a.md', '# A')
    await app.openTab(null, '') // move focus elsewhere

    api.setOpenFileResult({ path: 'c:/docs/A.MD', content: 'ignored' })
    await api.emitMenu('open')

    expect(app.store.count()).toBe(3) // welcome + a.md + untitled — no 4th tab
    expect(app.store.getActive().path).toBe('C:\\docs\\a.md')
    expect(editorFactory.editors).toHaveLength(3)
  })

  it('files pushed from main (second instance) open in a new tab without any discard prompt', async () => {
    const { app, api, confirmState } = buildApp()
    await app.init()
    activeEditor(app).type('unsaved edits')

    await api.emitFileOpened({ path: 'C:\\docs\\b.md', content: '# B' })

    expect(confirmState.calls).toHaveLength(0)
    expect(app.store.count()).toBe(2)
    expect(app.store.getActive().path).toBe('C:\\docs\\b.md')
  })

  it('renders one strip entry per tab plus the new-tab button', async () => {
    const { app, elements } = buildApp()
    await app.init()
    await app.openTab('C:\\docs\\a.md', '# A')

    expect(elements.tabbar.querySelectorAll('.tab')).toHaveLength(2)
    expect(elements.tabbar.querySelectorAll('.tab-new')).toHaveLength(1)
    expect(elements.tabbar.querySelector('.tab-active .tab-label').textContent).toBe('a.md')
  })
})

describe('tabs: switching', () => {
  it('preserves per-tab content and dirty state across switches', async () => {
    const { app, api } = buildApp()
    await app.init()
    const welcome = app.store.getActiveId()
    const tabA = await app.openTab('C:\\docs\\a.md', '# A')

    activeEditor(app).type(' edited')
    expect(app.store.get(tabA.id).dirty).toBe(true)

    await app.activateTab(welcome)
    expect(activeEditor(app).content).toBe('# welcome')
    expect(app.store.getActive().dirty).toBe(false)

    await app.activateTab(tabA.id)
    expect(activeEditor(app).content).toBe('# A edited')
    expect(app.store.getActive().dirty).toBe(true)
    // main is told "some tab is dirty" for the close guard
    expect(api.calls.setDirty.at(-1)).toBe(true)
  })

  it('next-tab / prev-tab menu actions cycle through the strip', async () => {
    const { app, api } = buildApp()
    await app.init()
    const first = app.store.getActiveId()
    const second = (await app.openTab('C:\\docs\\a.md', '')).id

    await api.emitMenu('next-tab')
    expect(app.store.getActiveId()).toBe(first) // wraps
    await api.emitMenu('prev-tab')
    expect(app.store.getActiveId()).toBe(second)
  })

  it('clicking a strip entry activates that tab', async () => {
    const { app, elements } = buildApp()
    await app.init()
    const first = app.store.getActiveId()
    await app.openTab('C:\\docs\\a.md', '# A')

    elements.tabbar.querySelector(`[data-tab-id="${first}"]`).click()
    await Promise.resolve()
    expect(app.store.getActiveId()).toBe(first)
  })
})

describe('tabs: closing', () => {
  it('closes a clean tab without confirmation and destroys its editor', async () => {
    const { app, editorFactory, confirmState } = buildApp()
    await app.init()
    const tabA = await app.openTab('C:\\docs\\a.md', '# A')

    const closed = await app.closeTab(tabA.id)

    expect(closed).toBe(true)
    expect(confirmState.calls).toHaveLength(0)
    expect(app.store.count()).toBe(1)
    expect(editorFactory.editors[1].destroyed).toBe(true)
    expect(editorFactory.editors[1].root.isConnected).toBe(false)
  })

  it('asks before closing a dirty tab and keeps it when declined', async () => {
    const { app, confirmState } = buildApp()
    await app.init()
    const tabA = await app.openTab('C:\\docs\\a.md', '# A')
    activeEditor(app).type('!')

    confirmState.result = false
    expect(await app.closeTab(tabA.id)).toBe(false)
    expect(confirmState.calls).toHaveLength(1)
    expect(app.store.count()).toBe(2)

    confirmState.result = true
    expect(await app.closeTab(tabA.id)).toBe(true)
    expect(app.store.count()).toBe(1)
  })

  it('closing the last tab leaves a fresh empty tab', async () => {
    const { app } = buildApp()
    await app.init()
    const only = app.store.getActiveId()

    await app.closeTab(only)

    expect(app.store.count()).toBe(1)
    expect(app.store.getActive().path).toBeNull()
    expect(activeEditor(app).content).toBe('')
  })

  it('close via the strip × button', async () => {
    const { app, elements } = buildApp()
    await app.init()
    const tabA = await app.openTab('C:\\docs\\a.md', '# A')

    elements.tabbar
      .querySelector(`[data-tab-id="${tabA.id}"] .tab-close`)
      .click()
    await Promise.resolve()
    await Promise.resolve()
    expect(app.store.findByPath('C:\\docs\\a.md')).toBeNull()
  })
})

describe('tabs: saving', () => {
  it('Save As on an untitled tab assigns the chosen path and cleans the tab', async () => {
    const { app, api } = buildApp()
    await app.init()
    activeEditor(app).type('hello')
    api.queueSaveAsResult('C:\\docs\\new.md')

    expect(await app.saveTab()).toBe(true)

    expect(api.calls.saveFileAs[0].suggestedName).toBe('untitled.md')
    expect(app.store.getActive().path).toBe('C:\\docs\\new.md')
    expect(app.store.getActive().dirty).toBe(false)
    expect(api.calls.setDirty.at(-1)).toBe(false)
  })

  it('a canceled Save As leaves the tab dirty and reports failure', async () => {
    const { app, api } = buildApp()
    await app.init()
    activeEditor(app).type('hello')

    expect(await app.saveTab()).toBe(false) // fake returns null (canceled)
    expect(app.store.getActive().dirty).toBe(true)
    expect(api.calls.forceClose).toBe(0)
  })

  it('save-and-close saves every dirty tab, then force-closes the window', async () => {
    const { app, api } = buildApp()
    await app.init()
    activeEditor(app).type('welcome edited') // untitled, dirty
    const tabA = await app.openTab('C:\\docs\\a.md', '# A')
    activeEditor(app).type(' edited') // pathful, dirty
    api.queueSaveAsResult('C:\\docs\\welcome.md')

    await api.emitMenu('save-and-close')

    expect(api.calls.saveFileAs).toHaveLength(1) // the untitled tab
    expect(api.calls.saveFile).toEqual([{ path: 'C:\\docs\\a.md', content: '# A edited' }])
    expect(api.calls.forceClose).toBe(1)
    expect(app.store.get(tabA.id).dirty).toBe(false)
  })

  it('save-and-close aborts (window stays open) when a Save As dialog is canceled', async () => {
    const { app, api } = buildApp()
    await app.init()
    activeEditor(app).type('never saved') // untitled + canceled Save As

    await api.emitMenu('save-and-close')

    expect(api.calls.forceClose).toBe(0)
    expect(app.store.anyDirty()).toBe(true)
  })
})

describe('tabs: keyboard shortcuts', () => {
  it('Ctrl+T opens, Ctrl+W closes, Ctrl+Tab cycles', async () => {
    const { app } = buildApp()
    await app.init()

    expect(app.handleKeydown(key('t'))).toBe(true)
    await Promise.resolve()
    expect(app.store.count()).toBe(2)

    const before = app.store.getActiveId()
    expect(app.handleKeydown(key('Tab'))).toBe(true)
    await Promise.resolve()
    expect(app.store.getActiveId()).not.toBe(before)

    expect(app.handleKeydown(key('w'))).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(app.store.count()).toBe(1)
  })

  it('ignores plain keys without a modifier', async () => {
    const { app } = buildApp()
    await app.init()
    expect(app.handleKeydown(key('t', { ctrl: false }))).toBe(false)
    expect(app.store.count()).toBe(1)
  })
})
