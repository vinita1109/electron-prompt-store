# Prompt Library

A developer-focused desktop app for storing, searching, and versioning AI prompts. Built on **Next.js 14 (App Router) + Electron + better-sqlite3** with full local file-system access — native dialogs, Finder/Explorer integration, attachment references, folder-based Markdown import/export, and auto-backup.

This app is the second stage of a proven Next.js → Electron pipeline. The first stage (the PoC) validated Next/Electron/IPC; this one stress-tests:

- Native module compilation (better-sqlite3) via `@electron/rebuild`
- Reading/writing arbitrary OS files outside any sandbox
- Native save/open/directory dialogs in real workflows
- `shell.openPath` + `shell.showItemInFolder` integration
- OS permission model (macOS Gatekeeper for ~/Documents, etc.)
- `asarUnpack` so native modules work inside packaged installers
- Absolute path persistence across restarts

---

## Prerequisites

- **Node.js 18+** (20 LTS recommended)
- **npm 9+**
- Native toolchain for compiling `better-sqlite3`:
  - **macOS**: Xcode Command Line Tools — `xcode-select --install`
  - **Windows**: Visual Studio Build Tools with the "Desktop development with C++" workload and Python 3.x. The one-shot installer `npm install --global windows-build-tools` is deprecated; install Build Tools directly from Microsoft.
  - **Linux**: `build-essential`, `python3`

## Setup

```bash
npm install
```

`postinstall` runs `electron-rebuild -f -w better-sqlite3` to compile the native binding against Electron's Node ABI. First install takes a few minutes; subsequent installs are fast. If rebuild fails, see **Troubleshooting** below.

## Development

```bash
npm run dev
```

Runs three processes in parallel:

- `dev:next` — Next.js dev server on `http://localhost:3000`
- `watch:electron` — `tsc --watch` for `electron/**` → `dist-electron/`
- `dev:electron` — waits for port 3000 and the compiled main process, then launches Electron

DevTools auto-open (detached). Restart the whole dev session to pick up main-process code changes.

## Build installers

### macOS (.dmg, x64 + arm64)

```bash
npm run package:mac
```

### Windows (.exe, NSIS installer, x64)

```bash
npm run package:win
```

> Windows installers must be built **on Windows** (or a Windows CI runner). `electron-builder` does not cross-compile Windows NSIS reliably from macOS.

### Both

```bash
npm run package:all
```

### Output location

```
dist/
├── Prompt Library-0.1.0-arm64.dmg
├── Prompt Library-0.1.0.dmg
└── Prompt Library Setup 0.1.0.exe
```

---

## File-system behavior

### Where the SQLite DB lives

- **macOS**: `~/Library/Application Support/Prompt Library/prompt-library.sqlite`
- **Windows**: `%APPDATA%\Prompt Library\prompt-library.sqlite`
- **Linux**: `~/.config/Prompt Library/prompt-library.sqlite`

Always resolved via `app.getPath('userData')` — never hard-coded. WAL mode is enabled for durability.

Settings (theme, auto-backup config, last-used paths, window bounds) are stored in a separate `settings.json` in the same folder by `electron-store`.

### Attachments are references, not copies

When you attach a file to a prompt, the app stores the **absolute path** to the original file in the database. It does NOT copy the file into app storage.

- If you move or delete the original, the attachment shows a warning badge and becomes un-openable.
- This is intentional: attachments are meant to reference working files in your projects (sample outputs, spec docs, screenshots), not duplicate them.
- If you want portable attachments, copy the files into a folder you control and attach the new path.

### Backups are written to a user-chosen folder

Auto-backup and on-demand backup never write inside the app. You pick a folder in Settings → Backups. Backup files:

- Named `prompt-library-backup_YYYY-MM-DD_HH-mm-ss.json`
- Rotated: only the most recent **10** are kept per folder.
- Each file is a standalone JSON dump containing every prompt — no ties to the DB, so a backup can be imported on any machine.

### Export targets

- **All as JSON** — save dialog, writes one JSON file.
- **Single prompt as Markdown** — save dialog, writes `.md` with YAML frontmatter.
- **All as Markdown files** — directory picker, writes one `.md` per prompt into the chosen folder. Filenames are slugified from titles and deduplicated automatically.

### Import sources

- **From JSON file** — open dialog filtered to `.json`. Shows a preview modal with per-title counts and offers:
  - **Merge** — skip rows whose title already exists (case-insensitive).
  - **Replace All** — destructive; deletes every existing prompt and tag before importing. Requires explicit confirmation.
- **From Markdown folder** — directory picker. Scans for `.md` files, parses YAML frontmatter (`title`, `description`, `category`, `model_target`, `tags`, `is_favorite`), imports each with merge-by-title semantics. Per-file errors are reported in the summary.

### OS permission prompts

#### macOS

The first time the app writes to `~/Documents`, `~/Desktop`, or `~/Downloads` (via export, backup, or the write-permissions test), macOS will show a **"Prompt Library would like to access files in your Documents folder"** dialog. **Click Allow** — the setting is remembered. If you deny and want to reconsider, grant access later under **System Settings → Privacy & Security → Files and Folders**.

Saving anywhere else works without a prompt.

#### Windows

Standard user folders (Documents, Desktop, Downloads, `%USERPROFILE%\*`) have no prompts. Writing under `C:\Program Files\` or other admin-only locations will fail with an EACCES error; choose a user-writable folder instead. The UI surfaces the exact OS error message in the failure toast.

---

## Architecture summary

```
┌──────────────────┐   contextBridge   ┌──────────────────┐
│  Next.js (out/)  │ ◄────────────────► │  Electron main   │
│  renderer        │     IPC invoke     │  process         │
└──────────────────┘                    └──────────────────┘
                                                │
                                                ▼
                                   ┌────────────────────────┐
                                   │  better-sqlite3 (sync) │
                                   │  electron-store        │
                                   │  fs / dialog / shell   │
                                   └────────────────────────┘
```

- `next.config.js` sets `output: 'export'` and `assetPrefix: './'` so the built renderer in `out/` loads cleanly from `file://`.
- The TypeScript main process compiles to `dist-electron/` via `electron/tsconfig.json`. The compiled `main.js` is `package.json.main`.
- `electron/preload.ts` exposes `window.electronAPI` via `contextBridge`. The renderer never imports Node modules directly.
- All IPC handlers return `{ success: true, data } | { success: false, error }` — no exceptions cross the IPC boundary.
- `asarUnpack` is set for `better-sqlite3` so the native `.node` binary can be loaded from the packaged app.

### Project structure

```
.
├── app/                               # Next.js App Router
│   ├── components/                    # UI (Sidebar, PromptList, PromptEditor, …)
│   ├── lib/                           # api, types, toast store
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── electron/                          # Main-process TypeScript (compiled to dist-electron/)
│   ├── db/
│   │   ├── database.ts                # better-sqlite3 connection + queries
│   │   ├── migrations.ts              # versioned schema
│   │   └── seed.ts                    # 5 example prompts on first run
│   ├── ipc/
│   │   ├── prompts.ts                 # CRUD handlers
│   │   ├── filesystem.ts              # dialogs, exports, imports, attachments, backups
│   │   ├── settings.ts                # electron-store bridge
│   │   └── diagnostics.ts             # paths, db info, write tests
│   ├── main.ts                        # window, menu, app lifecycle
│   ├── preload.ts                     # contextBridge API
│   └── tsconfig.json                  # CJS target → dist-electron/
├── shared/
│   └── types.ts                       # Types used by both main and renderer
├── next.config.js
├── package.json                       # scripts + electron-builder config
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.json                      # Next.js/renderer TS config
├── .gitignore
└── README.md
```

### Keyboard shortcuts

| Shortcut          | Action                        |
| ----------------- | ----------------------------- |
| `Cmd/Ctrl + N`    | New prompt                    |
| `Cmd/Ctrl + K`    | Focus search                  |
| `Cmd/Ctrl + D`    | Duplicate selected prompt     |
| `Cmd/Ctrl + S`    | Force backup now              |
| `Cmd/Ctrl + ,`    | Open Settings                 |

---

## Running unsigned builds

### macOS "App is damaged" / Gatekeeper

```bash
xattr -cr "/Applications/Prompt Library.app"
```

Or on first launch: **right-click → Open** (don't double-click), then click **Open** in the prompt.

### Windows SmartScreen

On first run: **"Windows protected your PC"** → click **More info** → **Run anyway**. Subsequent runs go straight through.

---

## Troubleshooting

### `better-sqlite3` errors at runtime

Symptom: `Error: Cannot find module '…/better_sqlite3.node'` or similar.

The native binary was compiled against the wrong Node ABI. Rebuild:

```bash
npm run rebuild
```

If that still fails, nuke and retry:

```bash
rm -rf node_modules package-lock.json
npm install
```

### `electron-rebuild` fails during install

Usually a missing C++ toolchain.

- **Windows**: install **Visual Studio Build Tools 2022** with the **Desktop development with C++** workload, then restart the terminal. Confirm Python 3 is on PATH (`python --version`).
- **macOS**: `xcode-select --install`, then retry.
- **Linux**: `sudo apt install build-essential python3` (Debian/Ubuntu) or equivalent.

Then:

```bash
npm run rebuild
```

### Blank white window when launching the packaged app

The `out/` directory was missing when `electron-builder` ran. Run a full build explicitly:

```bash
npm run build:next
npm run build:electron
ls out/index.html    # must exist
npm run package:mac  # (or :win)
```

### `electron` launches before the dev server is ready

`wait-on tcp:3000` returned before Next.js finished its first compile. Reload the window with `Cmd/Ctrl+R` or restart `npm run dev`.

### Port 3000 is already in use

```bash
# macOS / Linux
lsof -ti:3000 | xargs kill -9

# Windows PowerShell
Get-NetTCPConnection -LocalPort 3000 |
  Select-Object -ExpandProperty OwningProcess |
  ForEach-Object { Stop-Process -Id $_ -Force }
```

Or change the port in `package.json` (`dev:next`, `dev:electron`) and the `loadURL` target in `electron/main.ts`.

### `electron-builder` reports missing icons

This PoC ships no custom icons; default placeholders are used and a warning is emitted. To add icons, drop `build/icon.icns` (macOS) and `build/icon.ico` (Windows) at the repo root. `directories.buildResources` is already set to `build`.

### macOS code-signing errors

`"identity": null` is set under `build.mac` to force unsigned builds. If you changed it and don't have a Developer ID, revert or prefix with:

```bash
CSC_IDENTITY_AUTO_DISCOVERY=false npm run package:mac
```

### Attachments show warning badges

The original file was moved, renamed, or deleted. The app stores absolute paths, not copies — restore the file to its original path, or remove the attachment from the prompt and re-attach at the new location.

### Import from JSON says "0 prompts"

The file is not in an expected shape. The importer accepts either:

```json
{ "version": 1, "prompts": [ { "title": "…", "content": "…" } ] }
```

or a bare array:

```json
[ { "title": "…", "content": "…" } ]
```

Minimum required fields per entry: `title` (non-empty string) and `content` (string).
