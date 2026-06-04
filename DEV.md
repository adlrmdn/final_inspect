# Developer Guide

## Prerequisites
- Node.js (v18+)
- Rust (latest stable for Tauri v2 native desktop builds)

## Running Locally

### Windows Desktop (Recommended for rapid UI dev)
```bash
npm install
npm run tauri dev
```
This boots the Vite dev server and opens the native Windows Tauri window with hot-reloading enabled.

## Building for Production
**Windows Standalone / Installer:**
```bash
npm run tauri build
```
Outputs installer packages to: `src-tauri/target/release/bundle/`

## Project Structure
- `src/`: React frontend (Pages, Components, Contexts, Styles).
- `src-tauri/src/`: Rust backend (Minimal Tauri window wrapper shell).
