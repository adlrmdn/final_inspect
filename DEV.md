# Developer Guide

## Prerequisites
- Node.js (v18+)
- Rust (latest stable)
- Android Studio / NDK (for Android builds)

## Running Locally

### Windows Desktop (Recommended for rapid UI dev)
```bash
npm install
npm run tauri dev
```
This boots the Vite dev server and opens the native Windows Tauri window with hot-reloading enabled.

### Android Mobile (For device testing)
```bash
npm run tauri android dev
```
Make sure you have an Android emulator running or a physical device connected via ADB.

## Building for Production
**Windows Standalone / Installer:**
```bash
npm run tauri build
```
Outputs to: `src-tauri/target/release/bundle/`

**Android APK:**
```bash
npm run tauri android build --apk
```

## Project Structure
- `src/`: React frontend (Pages, Components, Contexts).
- `src-tauri/src/`: Rust backend (Commands, SQLite setup).
- `src-tauri/gen/android/`: Auto-generated Android native bridge. Do not edit directly unless making deep gradle changes.
