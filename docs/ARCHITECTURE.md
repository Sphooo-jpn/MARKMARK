# MARKMARK — アーキテクチャ / 要件定義

MARKMARK は Markdown ファイルを **Typora 風のインライン WYSIWYG** で編集・保存できる
Windows デスクトップアプリ。`.md` に関連付けて「プログラムから開く」で起動できる。

## 1. 要件

### 機能要件
- **インライン WYSIWYG 編集**: 記法とプレビューが同一ペインで統合された編集体験（Typora 風）。
- **複数タブ**: 複数の Markdown を同時に開き、タブバーで切替。開く/新規は常に新しいタブ
  （既に開いているパスはそのタブにフォーカス）。ダブルクリックで開いた 2 個目以降の
  ファイルも既存ウィンドウの新しいタブに入る。Ctrl+T/Ctrl+W/Ctrl+Tab で操作。
- **ファイル操作**: 新規 / 開く / 保存(Ctrl+S) / 名前を付けて保存(Ctrl+Shift+S)。
- **UTF-8** で読み書き。改行は保持。
- **未保存状態(dirty)管理**: タブとタイトルバーに未保存マーク。dirty なタブを閉じる前に
  確認、dirty なタブが 1 つでもあればウィンドウを閉じる前に保存ダイアログ
  （「保存」は全 dirty タブを順に保存してから閉じる）。
- **WSL 上の .md も閲覧可**: `\\wsl.localhost\Ubuntu\...` (UNC) パスを直接開ける。
- **Windows ファイル関連付け**: インストーラで `.md` / `.markdown` を登録。
  ダブルクリック / 「プログラムから開く」で MARKMARK が起動し、そのファイルを開く。
- **GFM**: 表・チェックリスト・取り消し線・コードブロック(シンタックスハイライト)。
- **ダーク / ライトテーマ**切替。

### 非機能要件
- **完全オフライン動作**（外部ネットワーク不要）。
- **per-user インストール**（管理者権限/UAC 不要、HKCU に関連付け登録）。
- contextIsolation 有効・nodeIntegration 無効（セキュア既定）。

### スコープ外（現状）
- コード署名（証明書なし → SmartScreen 警告は想定内）。
- 複数ウィンドウ（将来拡張）。数式(KaTeX)/Mermaid（将来拡張）。

## 2. 技術スタック

| 層 | 採用 | 理由 |
|---|---|---|
| ランタイム | Electron | クロスプラットフォームなデスクトップ、Windows 関連付け対応 |
| ビルド | electron-vite | main/preload/renderer を Vite で束ね、HMR/最適化 |
| エディタ | Milkdown (Crepe) | ProseMirror ベース、**Markdown がソースオブトゥルース**で往復精度が高い。Crepe は Typora 風 UI を同梱 |
| パッケージング | electron-builder | NSIS インストーラ + `fileAssociations` で関連付けを宣言的に登録 |

## 3. プロセス構成

```
src/
  main/      … Main プロセス: ウィンドウ, メニュー, 単一インスタンス,
               起動引数からのファイルパス取得(argv.js), ファイル I/O(IPC), 閉じるガード
  preload/   … contextBridge で最小 API を renderer に公開
  renderer/  … タブ + Milkdown エディタ UI
    src/main.js      … ブートストラップ（実環境の配線のみ）
    src/app.js       … アプリ制御。api/エディタ工場/DOM/confirm/storage を注入して生成
    src/tab-store.js … タブ状態（id/パス/dirty/アクティブ/隣接選択）の純粋ロジック
    src/editor.js    … Crepe ラッパー。タブごとに 1 エディタインスタンス
```

- renderer はタブごとに editor-host(div) + Crepe インスタンスを保持し、表示切替は
  display 切替（スクロール位置は保存/復元）。undo 履歴もタブごとに独立。
- dirty は「保存時スナップショットとの差分」で判定し、main へはタブ集約値
  （どれか 1 つでも dirty か）を `state:dirty` で通知 → ウィンドウ閉じるガードに使用。

### データフロー（ファイルを開く）
1. `.md` をダブルクリック → OS が `MARKMARK.exe "C:\path\to\file.md"` を起動。
2. Main が `process.argv` からパスを抽出（起動時 / `second-instance` イベント時）。
3. Main が UTF-8 で読込み、`file:opened` で renderer に `{path, content}` を送信。
4. Renderer が**新しいタブ**に Milkdown を生成して流し込み（同じパスが開いていれば
   そのタブにフォーカス）、タイトル/タブバー/現在パスを更新。

### データフロー（保存）
1. Renderer が `crepe.getMarkdown()` で Markdown 文字列を取得。
2. `file:save`(path, content) を invoke → Main が書込み。
3. パス未確定なら `file:saveAs` で保存ダイアログ。

## 4. Windows 関連付けの要点
- electron-builder `fileAssociations` + NSIS(per-user) で ProgID を HKCU に登録。
- 「プログラムから開く」一覧に確実に出る。ただし **Windows 10/11 の仕様上、
  “常にこれで開く(既定)” はユーザーが一度選ぶ必要**がある（アプリ側から強制不可）。
- 単一インスタンス化: 2 個目の起動はロックで弾き、`second-instance` で
  既存ウィンドウにパスを渡して開く。

## 5. テスト
- **Vitest**（+ happy-dom）。renderer の中核 (`app.js`) は依存注入で構成してあり、
  Electron / Milkdown なしで実ロジックをそのまま実行できる。
- `tests/unit/` … `tab-store`（タブ状態）と `argv`（起動引数解析）の単体テスト。
- `tests/integration/` … `app.js` を fake IPC api / fake エディタ / happy-dom と結合し、
  タブの開閉・切替・保存・save-and-close を検証。
- `tests/regression/` … タブ導入前から存在する挙動（起動ファイル読込、welcome、
  dirty 表示、保存フロー、テーマ永続化、旧ショートカット）の回帰テスト。
- 手動 GUI 検証用に `MARKMARK_USER_DATA=<dir>` で userData（=単一インスタンスロック）を
  分離でき、インストール済み MARKMARK と並行起動できる。

## 6. ビルド/実行環境（このマシン固有）
- 開発は WSL(Ubuntu) 上で編集、**依存導入・ビルド・テストは Windows の Node**（`C:\Program Files\nodejs`）で実行。
  → esbuild/rollup/electron のバイナリを win32 に統一し、クロスビルド事故を回避。
- プロジェクトは `C:\Users\foodo\MARKMARK`（= `/mnt/c/Users/foodo/MARKMARK`）。
