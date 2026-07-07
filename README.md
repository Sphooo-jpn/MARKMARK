# MARKMARK

**Typora 風のインライン WYSIWYG Markdown エディタ**（Windows デスクトップアプリ）。
Markdown を記法とプレビューが一体化した 1 ペインで編集し、そのまま `.md` に保存できます。
`.md` ファイルへの関連付けに対応し、「プログラムから開く」で MARKMARK を選べます。

![app icon](build/icon.png)

## 特徴

- 🖋 **インライン WYSIWYG 編集** — 書いた Markdown がその場で描画される（Milkdown / Crepe, ProseMirror ベース）
- 🗂 **タブ** — 複数の Markdown を同時に開ける。別の `.md` を開いても前のファイルを閉じる必要なし（ダブルクリックで開いた 2 個目以降も既存ウィンドウの新しいタブに）
- 💾 **保存 / 名前を付けて保存** — UTF-8、Markdown をソースオブトゥルースとして高精度に往復
- 🔗 **Windows ファイル関連付け** — インストーラが `.md` / `.markdown` を登録（per-user, 管理者不要）
- 🐧 **WSL 上の `.md` も編集可** — `\\wsl.localhost\Ubuntu\...` を直接開ける
- ✅ **GFM** — 表・チェックリスト・取り消し線・コードブロック（シンタックスハイライト）
- 🌗 **ダーク / ライトテーマ**（`Ctrl+D`）
- 📴 **完全オフライン動作**（外部通信なし）

## キーボードショートカット

| 操作 | キー |
| --- | --- |
| 新規（新しいタブ） | `Ctrl+N` |
| 開く（新しいタブ） | `Ctrl+O` |
| 保存 | `Ctrl+S` |
| 名前を付けて保存 | `Ctrl+Shift+S` |
| 新しいタブ | `Ctrl+T` |
| タブを閉じる | `Ctrl+W` |
| 次のタブ / 前のタブ | `Ctrl+Tab` / `Ctrl+Shift+Tab` |
| テーマ切替 | `Ctrl+D` |

タブバーのファイル名クリックで切替、`×`（または中クリック）で閉じる、`+` で新しいタブ。
未保存のタブは `●` 付きで表示され、閉じる際に確認ダイアログが出ます。

## インストール（利用者向け）

1. [Releases](../../releases) から `MARKMARK-Setup-<version>.exe` をダウンロード。
2. 実行するとユーザー領域（`%LOCALAPPDATA%\Programs\MARKMARK`）に**管理者権限なし**でインストールされます。
   - 未署名のため初回に SmartScreen 警告が出ます → 「詳細情報」→「実行」。
3. `.md` を右クリック →「プログラムから開く」→ **MARKMARK**。
   - 常に MARKMARK で開きたい場合は「プログラムから開く」→「別のプログラムを選択」→ MARKMARK →「常時」を選択。
     （Windows 10/11 の仕様上、“既定アプリ”はユーザーが一度選ぶ必要があります。）

## 開発（ビルド）

前提: **Windows 側の Node.js**（`node`/`npm`）。WSL で編集する場合もビルドは Windows 側で実行します
（esbuild/rollup/electron のバイナリを win32 に統一するため）。

```powershell
npm install          # 依存導入
npm run dev          # 開発起動（electron-vite, HMR）
npm run build        # main/preload/renderer をビルド (out/)
npm run dist         # NSIS インストーラを生成 (dist/MARKMARK-Setup-*.exe)
```

### テスト

Vitest（+ happy-dom）。renderer は依存注入で組んであり、Electron/Milkdown なしで
タブ・保存・dirty 管理のロジックをそのまま実行してテストします。

```powershell
npm test                  # 全テスト
npm run test:unit         # 単体: tab-store（タブ状態）, argv（起動引数解析）
npm run test:integration  # 結合: appコントローラ + fake IPC/エディタでタブ動作を検証
npm run test:regression   # 回帰: タブ導入前からの既存挙動（起動読込/保存/dirty/テーマ）
```

インストール済み MARKMARK と並行して検証インスタンスを起動したい場合は
`MARKMARK_USER_DATA=<dir>` で userData（単一インスタンスロック）を分離できます。

アイコンの再生成（Pillow 必要）:

```bash
python3 scripts/make-icons.py   # build/icon.ico, build/md.ico を生成
```

## アーキテクチャ

`main`（ウィンドウ・メニュー・単一インスタンス・起動引数からのファイル取得・ファイル I/O）/
`preload`（contextBridge で最小 API 公開）/ `renderer`（タブ + Milkdown エディタ UI）の 3 層構成。
詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照。

```
src/
  main/index.js       # Electron main（ウィンドウ/メニュー/IPC/閉じるガード）
  main/argv.js        # 起動引数から .md パスを抽出（純粋ロジック）
  preload/index.js    # contextBridge API
  renderer/
    index.html
    src/main.js        # ブートストラップ（実環境の配線のみ）
    src/app.js         # アプリ制御（タブ/開く/保存/dirty/テーマ）— 依存注入でテスト可能
    src/tab-store.js   # タブ状態管理（純粋ロジック）
    src/editor.js      # Milkdown Crepe ラッパー（タブごとに1インスタンス）
    src/styles.css     # アプリ chrome（タブバー含む）+ ダークテーマ
tests/
  unit/               # tab-store, argv
  integration/        # app + fake IPC/エディタ
  regression/         # タブ導入前の既存挙動
build/                # electron-builder リソース（アイコン）
electron.vite.config.mjs
```

## 技術スタック

Electron · electron-vite · [Milkdown](https://milkdown.dev) (Crepe) · electron-builder (NSIS) · Vitest

## ライセンス

MIT
