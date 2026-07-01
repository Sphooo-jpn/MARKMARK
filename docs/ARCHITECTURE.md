# MARKMARK — アーキテクチャ / 要件定義

MARKMARK は Markdown ファイルを **Typora 風のインライン WYSIWYG** で編集・保存できる
Windows デスクトップアプリ。`.md` に関連付けて「プログラムから開く」で起動できる。

## 1. 要件

### 機能要件
- **インライン WYSIWYG 編集**: 記法とプレビューが同一ペインで統合された編集体験（Typora 風）。
- **ファイル操作**: 新規 / 開く / 保存(Ctrl+S) / 名前を付けて保存(Ctrl+Shift+S)。
- **UTF-8** で読み書き。改行は保持。
- **未保存状態(dirty)管理**: タイトルバーに `*`、閉じる/新規/開く前に確認ダイアログ。
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
- 複数タブ/複数ウィンドウ（将来拡張）。数式(KaTeX)/Mermaid（将来拡張）。

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
               起動引数からのファイルパス取得, ファイル I/O(IPC), dirty 管理
  preload/   … contextBridge で最小 API を renderer に公開
  renderer/  … Milkdown エディタ UI (index.html + src/)
```

### データフロー（ファイルを開く）
1. `.md` をダブルクリック → OS が `MARKMARK.exe "C:\path\to\file.md"` を起動。
2. Main が `process.argv` からパスを抽出（起動時 / `second-instance` イベント時）。
3. Main が UTF-8 で読込み、`file:opened` で renderer に `{path, content}` を送信。
4. Renderer が Milkdown に流し込み、タイトル/現在パスを更新。

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

## 5. ビルド/実行環境（このマシン固有）
- 開発は WSL(Ubuntu) 上で編集、**依存導入・ビルドは Windows の Node**（`C:\Program Files\nodejs`）で実行。
  → esbuild/rollup/electron のバイナリを win32 に統一し、クロスビルド事故を回避。
- プロジェクトは `C:\Users\foodo\MARKMARK`（= `/mnt/c/Users/foodo/MARKMARK`）。
