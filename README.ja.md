# 🖥️ cmux-windows

Windows向けターミナルエミュレータ — TextBox入力モード搭載、IME完全対応

[English](README.md) | 日本語

![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.7x-DEA584?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ 特徴

- **TextBox入力モード** — IME対応のテキスト入力。`Ctrl+Alt+T` でトグル切替
- **AI Agent検出** — Claude, GitHub Copilot, Cursor等のAIエージェントを自動検出し、完了時に通知
- **WebGLレンダラー** — 高速描画。非対応環境ではCanvasに自動フォールバック
- **タブ管理** — ドラッグ&ドロップによるタブの並び替えに対応
- **分割ビュー** — 横分割・縦分割でターミナルを自由にレイアウト
- **自動アップデート** — 新バージョンを自動検出してアップデート
- **Catppuccin Mocha テーマ** — 目に優しいカラースキーム

## ☕ サポート

継続的な開発のために、サポートいただけますと幸いです！

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/megumu)

## 📦 インストール

[GitHub Releases](https://github.com/Davinci-Meg/cmux-windows/releases) から最新のインストーラー（`.msi` / `.exe`）をダウンロードしてください。

## 🛠️ 開発環境セットアップ

### 前提条件

- [Node.js](https://nodejs.org/) (v18以上)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri v2 の前提条件](https://v2.tauri.app/start/prerequisites/)

### セットアップ

```bash
# リポジトリをクローン
git clone https://github.com/Davinci-Meg/cmux-windows.git
cd cmux-windows

# 依存パッケージのインストール
npm install

# 開発サーバーの起動
npm run tauri dev

# ビルド
npm run tauri build
```

## ⌨️ キーボードショートカット

| ショートカット | 動作 |
|---|---|
| `Ctrl+Alt+T` | TextBox入力モードのトグル |
| `Ctrl+Shift+T` | 新規タブ |
| `Ctrl+Shift+W` | タブ / ペインを閉じる |
| `Ctrl+Tab` | 次のタブへ |
| `Ctrl+Shift+Tab` | 前のタブへ |
| `Ctrl+PageDown` | 次のタブへ |
| `Ctrl+PageUp` | 前のタブへ |
| `Ctrl+,` | 設定を開く |
| `Ctrl+\` | 横分割 |
| `Ctrl+-` | 縦分割 |
| `Ctrl+]` | 次のペインへ移動 |
| `Ctrl+[` | 前のペインへ移動 |

## 🧩 技術スタック

| カテゴリ | 技術 |
|---|---|
| フレームワーク | Tauri v2 |
| フロントエンド | React 19 + TypeScript |
| バックエンド | Rust |
| ターミナル | xterm.js |
| レンダラー | WebGL（Canvas フォールバック） |
| テーマ | Catppuccin Mocha |
| ビルドツール | Vite |

## 📄 ライセンス

[MIT License](LICENSE)
