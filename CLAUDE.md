# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LAP (Local App Manager / LP Player) is a centralized dashboard for managing and running local development applications. Users register local projects, start/stop them with one click, and monitor terminal output and system resources in real-time via WebSocket. Built with React 18 + Vite frontend and Express + WebSocket backend.

## Development Commands

```bash
# Primary development (frontend on :5181 + API on :4243)
npm run dev:api        # or: npm start

# Frontend only
npm run dev

# API server only
npm run api            # node server.js

# Production build + serve
npm run prod           # builds then runs server.cjs on :4243

# Shell script alternative
./start.sh             # dev mode
./start.sh prod        # production mode

# Lint (zero warnings policy)
npm run lint           # eslint . --ext js,jsx --report-unused-disable-directives --max-warnings 0

# Build
npm run build
```

**No test script is configured in package.json.** Test files exist using Jest patterns (`src/utils/__tests__/`, `src/services/__tests__/`) but Jest is not installed as a dependency.

## Architecture

### Dual-Server Setup

- **`server.js`** (ESM) — Primary dev API server with WebSocket, process management, system monitoring on port 4243
- **`server.cjs`** (CJS) — Production server serving `dist/` + API routes on port 4243
- **`server/index.js`** — Legacy secondary server (port 3015) with checkout/ping APIs and its own `package.json`

### State Management — React Context (4 providers, nested in this order)

1. **ThemeProvider** — dark/light mode, sepia, hue rotation (sessionStorage)
2. **NotificationProvider** — toast notification queue
3. **ToolProvider** — tool CRUD, run/stop, triple-fallback persistence (global cache → localStorage `lap_tools` → REST API → `src/data/tools.json`)
4. **TerminalProvider** — WebSocket connection, terminal state, ANSI parsing

Each context has a corresponding hook in `src/hooks/` (e.g., `useTools()`, `useTheme()`). Components should import hooks, not contexts directly.

### Cross-Context Communication

`ToolContext` dispatches `CustomEvent('open-terminal')` which `TerminalContext` listens for. This is how running a tool triggers the terminal to open and subscribe via WebSocket.

### Data Flow for Running an App

ToolCard power knob → `runApp(toolId)` in ToolContext → dispatches `open-terminal` CustomEvent + calls `executeProcess()` REST API → server spawns child process → streams stdout/stderr via WebSocket → TerminalContext parses ANSI → TerminalWindow renders output

### API Layer

- Frontend connects to `http://{hostname}:4243` (hardcoded in multiple files)
- WebSocket at `ws://{hostname}:4243`
- Vite proxies `/api` → `localhost:4243` in dev
- `src/utils/processExecutor.js` is the client-side API utility for run/stop

### Key REST Endpoints

- `GET/POST /api/tools` — CRUD for tool definitions
- `POST /api/tools/run` — Start a process
- `POST /api/tools/stop` — Stop a process
- `POST /api/detect-environment` — Detect project environment from path
- `GET /api/system-stats` — CPU/memory stats

## Styling & Design System

- **Tailwind CSS** with custom design tokens: `tool-dark`, `tool-darker`, `tool-light`, `tool-accent`, `tool-border` (#bccc0f accent color)
- Dark/light mode via conditional class strings: `${isDarkMode ? '...' : '...'}`
- **Framer Motion** for all animations
- **@headlessui/react** for accessible modal dialogs
- Custom font: **Inconsolata** (monospace)

## Code Conventions

- Functional components only, with `React.memo()` on expensive components (Header, Footer, SystemMonitor, SearchBar, AppContent)
- PascalCase `.jsx` files for components, camelCase `.js` for utilities/hooks
- Components organized by feature domain in `src/components/` subdirectories
- Named exports for contexts/hooks, default exports for components
- ESM throughout except `server.cjs` (production) and `readmeParser.js` (CommonJS — mixed module system caveat)

## Tool Data Shape

Tools in `src/data/tools.json` have: `id`, `name`, `description`, `logoPath`, `category`, `tags[]`, `port`, `execution.rootPath`, `execution.command`, `execution.environment.activationCommand`, `execution.isRunning`, `execution.error`
