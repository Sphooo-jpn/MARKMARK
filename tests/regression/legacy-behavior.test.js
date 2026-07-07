// @vitest-environment happy-dom
// Regression: every documented pre-tab behavior must survive the tab refactor.
// (Launch-file loading, welcome doc, save flows, dirty tracking, title, theme.)
import { describe, it, expect } from 'vitest'
import { buildApp, activeEditor, key } from '../helpers/fakes.js'

describe('regression: launch behavior', () => {
  it('loads the file MARKMARK was launched with and shows it clean', async () => {
    const launchFile = { path: 'C:\\docs\\launch.md', content: '# Launch' }
    const { app, api, elements } = buildApp({ launchFile })
    await app.init()

    expect(activeEditor(app).content).toBe('# Launch')
    expect(app.store.getActive().path).toBe('C:\\docs\\launch.md')
    expect(app.store.getActive().dirty).toBe(false)
    expect(elements.statusPath.textContent).toBe('C:\\docs\\launch.md')
    expect(api.calls.setTitle.at(-1)).toBe('launch.md — MARKMARK')
  })

  it('shows the welcome document when launched without a file', async () => {
    const { app, api } = buildApp({ welcomeMarkdown: '# MARKMARK へようこそ' })
    await app.init()

    expect(activeEditor(app).content).toContain('# MARKMARK へようこそ')
    expect(app.store.getActive().path).toBeNull()
    expect(api.calls.setTitle.at(-1)).toBe('untitled — MARKMARK')
  })
})

describe('regression: dirty tracking and title', () => {
  it('editing marks the document dirty: * in title, ● in status, main notified', async () => {
    const { app, api, elements } = buildApp({
      launchFile: { path: 'C:\\docs\\a.md', content: '# A' }
    })
    await app.init()

    activeEditor(app).type(' more')

    expect(api.calls.setDirty.at(-1)).toBe(true)
    expect(api.calls.setTitle.at(-1)).toBe('* a.md — MARKMARK')
    expect(elements.statusPath.textContent).toBe('● C:\\docs\\a.md')
  })

  it('reverting to the baseline clears the dirty flag', async () => {
    const { app, api } = buildApp({ launchFile: { path: 'C:\\docs\\a.md', content: '# A' } })
    await app.init()

    activeEditor(app).setContent('# A changed')
    expect(api.calls.setDirty.at(-1)).toBe(true)
    activeEditor(app).setContent('# A')
    expect(api.calls.setDirty.at(-1)).toBe(false)
  })

  it('shows word and character counts in the status bar', async () => {
    const { app, elements } = buildApp({
      launchFile: { path: 'C:\\docs\\a.md', content: 'hello world' }
    })
    await app.init()
    expect(elements.statusStats.textContent).toBe('2 words · 11 chars')
  })
})

describe('regression: saving', () => {
  it('Ctrl+S saves to the known path and cleans the document', async () => {
    const { app, api } = buildApp({ launchFile: { path: 'C:\\docs\\a.md', content: '# A' } })
    await app.init()
    activeEditor(app).type(' v2')

    app.handleKeydown(key('s'))
    await Promise.resolve()
    await Promise.resolve()

    expect(api.calls.saveFile).toEqual([{ path: 'C:\\docs\\a.md', content: '# A v2' }])
    expect(api.calls.setDirty.at(-1)).toBe(false)
    expect(api.calls.setTitle.at(-1)).toBe('a.md — MARKMARK')
  })

  it('Ctrl+Shift+S (Save As) suggests the current basename', async () => {
    const { app, api } = buildApp({ launchFile: { path: 'C:\\docs\\a.md', content: '# A' } })
    await app.init()
    api.queueSaveAsResult('C:\\docs\\copy.md')

    await app.saveTabAs()

    expect(api.calls.saveFileAs[0].suggestedName).toBe('a.md')
    expect(app.store.getActive().path).toBe('C:\\docs\\copy.md')
  })

  it('saving an untitled document falls back to Save As with untitled.md', async () => {
    const { app, api } = buildApp()
    await app.init()
    activeEditor(app).type('text')
    api.queueSaveAsResult('C:\\docs\\saved.md')

    await app.saveTab()

    expect(api.calls.saveFileAs[0].suggestedName).toBe('untitled.md')
    expect(api.calls.saveFile).toHaveLength(0)
  })

  it("main's save-and-close request still saves and then force-closes", async () => {
    const { app, api } = buildApp({ launchFile: { path: 'C:\\docs\\a.md', content: '# A' } })
    await app.init()
    activeEditor(app).type('!')

    await api.emitMenu('save-and-close')

    expect(api.calls.saveFile).toHaveLength(1)
    expect(api.calls.forceClose).toBe(1)
  })
})

describe('regression: menu actions and theme', () => {
  it("menu 'new' still produces an empty untitled document", async () => {
    const { app, api } = buildApp({ launchFile: { path: 'C:\\docs\\a.md', content: '# A' } })
    await app.init()

    await api.emitMenu('new')

    expect(app.store.getActive().path).toBeNull()
    expect(activeEditor(app).content).toBe('')
  })

  it("menu 'open' loads the picked file", async () => {
    const { app, api } = buildApp()
    await app.init()
    api.setOpenFileResult({ path: 'C:\\docs\\picked.md', content: '# Picked' })

    await api.emitMenu('open')

    expect(activeEditor(app).content).toBe('# Picked')
    expect(app.store.getActive().path).toBe('C:\\docs\\picked.md')
  })

  it('theme toggle flips the body class and persists the choice', async () => {
    const { app, storage } = buildApp()
    await app.init()
    expect(document.body.classList.contains('theme-dark')).toBe(false)

    app.toggleTheme()
    expect(document.body.classList.contains('theme-dark')).toBe(true)
    expect(storage.getItem('markmark-theme')).toBe('dark')

    app.handleKeydown(key('d')) // Ctrl+D
    expect(document.body.classList.contains('theme-dark')).toBe(false)
    expect(storage.getItem('markmark-theme')).toBe('light')
  })

  it('restores the persisted theme at startup', async () => {
    const { app, storage } = buildApp()
    storage.setItem('markmark-theme', 'dark')
    await app.init()
    expect(document.body.classList.contains('theme-dark')).toBe(true)
  })

  it('legacy shortcuts Ctrl+O / Ctrl+N are still handled', async () => {
    const { app, api } = buildApp()
    await app.init()
    api.setOpenFileResult({ path: 'C:\\docs\\o.md', content: 'o' })

    expect(app.handleKeydown(key('o'))).toBe(true)
    await Promise.resolve()
    await Promise.resolve()
    expect(app.store.findByPath('C:\\docs\\o.md')).not.toBeNull()

    expect(app.handleKeydown(key('n'))).toBe(true)
    await Promise.resolve()
    expect(app.store.count()).toBe(3)
  })
})
