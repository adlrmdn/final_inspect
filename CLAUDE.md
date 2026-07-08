# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Chimera QC Console — an offline-first Quality Control inspection system for manufacturing. Built as a Tauri v2 desktop app with a React 19 + TypeScript frontend. Operators perform QC inspections via dynamic forms, data persists locally, and auto-syncs to enterprise servers when online.

## Commands

```bash
npm run dev              # Vite dev server on http://localhost:1420
npm run build            # TypeScript check + Vite production build
npm run tauri dev        # Full Tauri desktop app with hot reload
npm run tauri build      # Production desktop bundle
```

No test runner or linter is configured. TypeScript strict mode (`noUnusedLocals`, `noUnusedParameters`, `noFallthroughCasesInSwitch`) is enforced via `tsc` during `npm run build`.

## Architecture

**Four layers:**

1. **Presentation** (`src/components/`, `src/components/workspace/`, `src/App.tsx`) — React 19 components. `App.tsx` is the root, managing view routing (`dashboard` | `form`), the Kaizen AI copilot panel, and voice recognition (Web Speech API). `Dashboard.tsx` shows template cards and a chat interface. `FormView.tsx` coordinates the modular Packaging QC Workspace by composing `FormHeader`, `WorkspaceControls`, `BentoInspectionCards`, `RightDefectPane`, and `ProjectSelectionDirectory` (all located under `src/components/workspace/`).

2. **Domain Models** (`src/models/`) — OOP classes with a state machine lifecycle:
   - `QCInspectionTemplate`: defines form schemas with typed fields (text, select, boolean, number) and validation logic.
   - `QCInspectionReport`: report lifecycle state machine: `draft` → `pending_sync` → `synced`. Reports are editable only in `draft`.

3. **Services** (`src/services/`) — All singletons via `getInstance()`:
   - `DatabaseService`: localStorage persistence under keys `chimera_qc_templates` and `chimera_qc_reports`. Seeds two default templates (fabric_v1, pack_v2).
   - `SyncEngine`: monitors `window.online`/`offline` events, sequentially syncs `pending_sync` reports. Uses listener pattern for UI updates.
   - `AIAgentService`: offline intent matcher for the Kaizen assistant. Parses text commands into actions (`navigate`, `fill`, `calculate`). Supports English + Indonesian keywords.

4. **Tauri Backend** (`src-tauri/`) — Rust backend shell connecting to PostgreSQL databases (VSM reference DB, QMS workspace DB, and RPA DB). Exposes Tauri commands for local SQLite and AWS PostgreSQL storage, Dynamics 365 OData synchronization, custom garment checklist placeholders, Universal RPA queue scheduling (invoice, deduction, and version-by-version chronological breakdowns), and `chat_logs` interaction logging.

**Data flow:** Form submit → `DatabaseService.saveReport()` (draft) → `finalize()` (pending_sync) → `SyncEngine.synchronize()` (synced when online, queued when offline). Dynamics 365 Baselines are downloaded from ERP OData directly into QMS. Completed projects schedule RPA jobs in the `rpa_queues` table.

## Key Patterns

- **Singleton services**: `DatabaseService`, `SyncEngine`, `AIAgentService` all use private constructors with static `getInstance()`.
- **State machine on reports**: Status transitions are enforced in `QCInspectionReport` methods (`finalize()`, `markSynced()`). Do not set `.status` directly.
- **Tauri detection**: Runtime check via `window.__TAURI_INTERNALS__` in `App.tsx`. Window controls (minimize/close) only render in Tauri context.
- **All styling in `App.css`**: Single CSS file with a custom design system using CSS variables. Key tokens: `--royal-blue` (primary), `--teal-blue` (success), `--deep-ocean` (text). Uses glassmorphism (`.bento-card`) and gradient buttons (`.btn-electric`).
- **Flexible Chained Height (No Clipping)**: In order to prevent vertical window scrollbars and bottom container clipping, the layout uses a continuous flexbox chain from `#root` -> `.hud-root` -> `.hud-workspace-container` -> `.hud-full-pane` -> `.dashboard-layout` -> `.kaizen-center-card` (all with `min-height: 0` or `flex: 1`). Any excess chat content scrolls strictly within the inner `.hud-local-chat-scroll`.
- **Visual remake & micro-interactions**: Hovering over `.operation-dock-card` triggers cursor spotlight glow masked inside border outline driven by React coordinates. Scanning activates `.hologram-scan-overlay` grid/laser sweeps. Voice commands spawn concentric `.mic-ripple-ring` pulses. New agent replies render inside `<TypewriterText>` at `20ms`/char.
- **No external routing library**: View switching is state-driven in `App.tsx` (`currentView` state).

## Tauri Configuration

- Dev server fixed to port 1420 (`vite.config.ts` `strictPort: true`)
- Tauri runs `npm run dev` as `beforeDevCommand` and `npm run build` as `beforeBuildCommand`
- Window launches fullscreen by default (`tauri.conf.json`)
- CSP is set to `null` (permissive)
