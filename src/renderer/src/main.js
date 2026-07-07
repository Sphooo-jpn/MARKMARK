// Bootstrap: wire the app controller to the real environment
// (styles, Milkdown editor factory, preload IPC bridge, browser DOM).
import './styles.css'
import { createEditor } from './editor.js'
import { createApp } from './app.js'

function welcomeDoc() {
  return [
    '# MARKMARK へようこそ',
    '',
    'これは **インライン WYSIWYG** な Markdown エディタです。書いた記法がその場で描画されます。',
    '',
    '## できること',
    '',
    '- `Ctrl+S` 保存 / `Ctrl+O` 開く / `Ctrl+N` 新規 / `Ctrl+Shift+S` 名前を付けて保存',
    '- `Ctrl+T` 新しいタブ / `Ctrl+W` タブを閉じる / `Ctrl+Tab` タブ切替',
    '- `Ctrl+D` でダーク / ライト切替',
    '- [x] チェックリスト',
    '- [ ] 表・コードブロックもそのまま編集',
    '',
    '| 機能 | 対応 |',
    '| --- | --- |',
    '| 見出し | ✓ |',
    '| 表 | ✓ |',
    '| タブ | ✓ |',
    '',
    '```js',
    "console.log('hello, MARKMARK')",
    '```',
    ''
  ].join('\n')
}

const app = createApp({
  api: window.markmark,
  createEditor,
  elements: {
    tabbar: document.getElementById('tabbar'),
    editorArea: document.getElementById('editor-area'),
    statusPath: document.getElementById('status-path'),
    statusStats: document.getElementById('status-stats')
  },
  confirm: (message) => window.confirm(message),
  storage: window.localStorage,
  welcomeMarkdown: welcomeDoc()
})

document.getElementById('status-theme').addEventListener('click', () => app.toggleTheme())
window.addEventListener('keydown', (e) => app.handleKeydown(e))

app.init()
