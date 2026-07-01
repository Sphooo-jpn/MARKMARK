import './styles.css'
import { createEditor } from './editor.js'

const api = window.markmark

const editorHost = document.getElementById('editor')
const statusPath = document.getElementById('status-path')
const statusStats = document.getElementById('status-stats')
const statusTheme = document.getElementById('status-theme')

let editor = null
let currentPath = null
let baseline = '' // last saved markdown snapshot
let dirty = false

function basename(p) {
  if (!p) return null
  const parts = p.split(/[\\/]/)
  return parts[parts.length - 1]
}

function updateStatus() {
  const name = basename(currentPath) || 'untitled'
  statusPath.textContent = (dirty ? '● ' : '') + (currentPath || name)
  const md = editor ? editor.getMarkdown() : ''
  const chars = md.length
  const words = (md.trim().match(/\S+/g) || []).length
  statusStats.textContent = `${words} words · ${chars} chars`
  const title = `${dirty ? '* ' : ''}${name} — MARKMARK`
  document.title = title
  api.setTitle(title)
}

function setDirty(d) {
  dirty = d
  api.setDirty(d)
  updateStatus()
}

function onChange() {
  if (!editor) return
  setDirty(editor.getMarkdown() !== baseline)
}

async function mountContent(markdown) {
  if (editor) {
    await editor.destroy()
    editor = null
  }
  editor = await createEditor({ root: editorHost, markdown, onChange })
}

async function loadFile(path, content) {
  await mountContent(content)
  currentPath = path
  // Use the editor's normalized serialization as the clean baseline, so Crepe's
  // parse/serialize round-trip doesn't falsely flag an untouched document as dirty.
  baseline = editor.getMarkdown()
  setDirty(false)
  editorHost.scrollTop = 0
}

function confirmDiscard() {
  if (!dirty) return true
  return window.confirm('変更が保存されていません。破棄して続行しますか？')
}

async function doNew() {
  if (!confirmDiscard()) return
  await loadFile(null, '')
}

async function doOpen() {
  if (!confirmDiscard()) return
  const res = await api.openFile()
  if (res) await loadFile(res.path, res.content)
}

async function doSave() {
  if (!editor) return false
  const md = editor.getMarkdown()
  if (currentPath) {
    await api.saveFile(currentPath, md)
    baseline = md
    setDirty(false)
    return true
  }
  return doSaveAs()
}

async function doSaveAs() {
  if (!editor) return false
  const md = editor.getMarkdown()
  const suggested = basename(currentPath) || 'untitled.md'
  const path = await api.saveFileAs(md, suggested)
  if (!path) return false
  currentPath = path
  baseline = md
  setDirty(false)
  return true
}

function applyTheme(theme) {
  document.body.classList.toggle('theme-dark', theme === 'dark')
  localStorage.setItem('markmark-theme', theme)
}

function toggleTheme() {
  applyTheme(document.body.classList.contains('theme-dark') ? 'light' : 'dark')
}

api.onMenuAction(async (action) => {
  switch (action) {
    case 'new':
      await doNew()
      break
    case 'open':
      await doOpen()
      break
    case 'save':
      await doSave()
      break
    case 'save-as':
      await doSaveAs()
      break
    case 'toggle-theme':
      toggleTheme()
      break
    case 'save-and-close': {
      const ok = await doSave()
      if (ok) api.forceClose()
      break
    }
  }
})

api.onFileOpened(async ({ path, content }) => {
  if (!confirmDiscard()) return
  await loadFile(path, content)
})

statusTheme.addEventListener('click', toggleTheme)

// Resilient shortcuts (also covered by native menu accelerators).
window.addEventListener('keydown', (e) => {
  const mod = e.ctrlKey || e.metaKey
  if (!mod) return
  const k = e.key.toLowerCase()
  if (k === 's' && !e.shiftKey) {
    e.preventDefault()
    doSave()
  } else if (k === 's' && e.shiftKey) {
    e.preventDefault()
    doSaveAs()
  } else if (k === 'o') {
    e.preventDefault()
    doOpen()
  } else if (k === 'n') {
    e.preventDefault()
    doNew()
  } else if (k === 'd') {
    e.preventDefault()
    toggleTheme()
  }
})

function welcomeDoc() {
  return [
    '# MARKMARK へようこそ',
    '',
    'これは **インライン WYSIWYG** な Markdown エディタです。書いた記法がその場で描画されます。',
    '',
    '## できること',
    '',
    '- `Ctrl+S` 保存 / `Ctrl+O` 開く / `Ctrl+N` 新規 / `Ctrl+Shift+S` 名前を付けて保存',
    '- `Ctrl+D` でダーク / ライト切替',
    '- [x] チェックリスト',
    '- [ ] 表・コードブロックもそのまま編集',
    '',
    '| 機能 | 対応 |',
    '| --- | --- |',
    '| 見出し | ✓ |',
    '| 表 | ✓ |',
    '',
    '```js',
    "console.log('hello, MARKMARK')",
    '```',
    ''
  ].join('\n')
}

async function init() {
  applyTheme(localStorage.getItem('markmark-theme') || 'light')
  const launch = await api.getLaunchFile()
  if (launch) await loadFile(launch.path, launch.content)
  else await loadFile(null, welcomeDoc())
}

init()
