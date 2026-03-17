# 🖥️ cmux-windows

A terminal emulator for Windows — with TextBox input mode and full IME support

English | [日本語](README.ja.md)

![Tauri v2](https://img.shields.io/badge/Tauri-v2-24C8D8?logo=tauri&logoColor=white)
![React 19](https://img.shields.io/badge/React-19-61DAFB?logo=react&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?logo=typescript&logoColor=white)
![Rust](https://img.shields.io/badge/Rust-1.7x-DEA584?logo=rust&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green)

## ✨ Features

- **TextBox Input Mode** — Text input with full IME support. Toggle with `Ctrl+Alt+T`
- **AI Agent Detection** — Automatically detects AI agents (Claude, GitHub Copilot, Cursor, etc.) and notifies on completion
- **WebGL Renderer** — High-performance rendering with automatic Canvas fallback
- **Tab Management** — Drag & drop tab reordering
- **Split View** — Freely layout terminals with horizontal and vertical splits
- **Auto Update** — Automatically detects and installs new versions
- **Catppuccin Mocha Theme** — An eye-friendly color scheme

## ☕ Support

Your support helps keep this project going!

[![Buy Me A Coffee](https://img.shields.io/badge/Buy%20Me%20A%20Coffee-FFDD00?logo=buy-me-a-coffee&logoColor=black)](https://buymeacoffee.com/megumu)

## 📦 Installation

Download the latest installer (`.msi` / `.exe`) from [GitHub Releases](https://github.com/Davinci-Meg/cmux-windows/releases).

## 🛠️ Development Setup

### Prerequisites

- [Node.js](https://nodejs.org/) (v18 or later)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri v2 Prerequisites](https://v2.tauri.app/start/prerequisites/)

### Setup

```bash
# Clone the repository
git clone https://github.com/Davinci-Meg/cmux-windows.git
cd cmux-windows

# Install dependencies
npm install

# Start the development server
npm run tauri dev

# Build
npm run tauri build
```

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|---|---|
| `Ctrl+Alt+T` | Toggle TextBox input mode |
| `Ctrl+Shift+T` | New tab |
| `Ctrl+Shift+W` | Close tab / pane |
| `Ctrl+Tab` | Next tab |
| `Ctrl+Shift+Tab` | Previous tab |
| `Ctrl+PageDown` | Next tab |
| `Ctrl+PageUp` | Previous tab |
| `Ctrl+,` | Open settings |
| `Ctrl+\` | Horizontal split |
| `Ctrl+-` | Vertical split |
| `Ctrl+]` | Next pane |
| `Ctrl+[` | Previous pane |

## 🧩 Tech Stack

| Category | Technology |
|---|---|
| Framework | Tauri v2 |
| Frontend | React 19 + TypeScript |
| Backend | Rust |
| Terminal | xterm.js |
| Renderer | WebGL (Canvas fallback) |
| Theme | Catppuccin Mocha |
| Build Tool | Vite |

## 📄 License

[MIT License](LICENSE)
