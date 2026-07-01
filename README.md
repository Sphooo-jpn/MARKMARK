# MARKMARK

**Typora 風のインライン WYSIWYG Markdown エディタ**（Windows デスクトップアプリ）。
Markdown を記法とプレビューが一体化した 1 ペインで編集し、そのまま `.md` に保存できます。
`.md` ファイルへの関連付けに対応し、「プログラムから開く」で MARKMARK を選べます。

![app icon](build/icon.png)

## 特徴

- 🖋 **インライン WYSIWYG 編集** — 書いた Markdown がその場で描画される（Milkdown / Crepe, ProseMirror ベース）
- 💾 **保存 / 名前を付けて保存** — UTF-8、Markdown をソースオブトゥルースとして高精度に往復
- 🔗 **Windows ファイル関連付け** — インストーラが `.md` / `.markdown` を登録（per-user, 管理者不要）
- 🐧 **WSL 上の `.md` も編集可** — `\\wsl.localhost\Ubuntu\...` を直接開ける
- ✅ **GFM** — 表・チェックリスト・取り消し線・コードブロック（シンタックスハイライト）
- 🌗 **ダーク / ライトテーマ**（`Ctrl+D`）
- 📴 **完全オフライン動作**（外部通信なし）

## キーボードショートカット

| 操作 | キー |
| --- | --- |
| 新規 | `Ctrl+N` |
| 開く | `Ctrl+O` |
| 保存 | `Ctrl+S` |
| 名前を付けて保存 | `Ctrl+Shift+S` |
| テーマ切替 | `Ctrl+D` |

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

アイコンの再生成（Pillow 必要）:

```bash
python3 scripts/make-icons.py   # build/icon.ico, build/md.ico を生成
```

## アーキテクチャ

`main`（ウィンドウ・メニュー・単一インスタンス・起動引数からのファイル取得・ファイル I/O）/
`preload`（contextBridge で最小 API 公開）/ `renderer`（Milkdown エディタ UI）の 3 層構成。
詳細は [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) を参照。

```
src/
  main/index.js       # Electron main
  preload/index.js    # contextBridge API
  renderer/
    index.html
    src/main.js        # アプリ制御（開く/保存/dirty/テーマ/ショートカット）
    src/editor.js      # Milkdown Crepe ラッパー
    src/styles.css     # アプリ chrome + ダークテーマ
build/                # electron-builder リソース（アイコン）
electron.vite.config.mjs
```

## 技術スタック

Electron · electron-vite · [Milkdown](https://milkdown.dev) (Crepe) · electron-builder (NSIS)

## ライセンス

MIT
