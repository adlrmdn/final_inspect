# Chimera MES // Industrial Core
## Manufacturing Execution System (MES) Offline Quality Control Console

Welcome to the **Chimera MES Quality Control Console**—a state-of-the-art, high-fidelity offline-first enterprise web client designed using robust **Object-Oriented Programming (OOP)** patterns.

The console enables remote field engineers and line operators to run mission-critical quality control inspections inside an offline environment (running under the **Tauri v2** shell framework), automatically caching inspection reports locally in a robust database interface and synchronizing them sequentially to the master enterprise network whenever connection is restored.

---

## 1. Object-Oriented Domain Architecture

To prevent information dilution and keep code boundaries explicit, the application's runtime logic is structured around core **Domain Objects** and **Service providers**.

```mermaid
classDiagram
    class QCInspectionTemplate {
        +String id
        +String title
        +String version
        +String description
        +TemplateSchemaField[] fields
        +validate(payload) Object
    }
    class QCInspectionReport {
        +String id
        +String templateId
        +String operatorId
        +Object payload
        +SyncStatus status
        +Date createdAt
        +finalize() void
        +markSynced() void
        +isEditable() boolean
        +toJSON() Object
        +fromJSON(json) QCInspectionReport
    }
    class DatabaseService {
        -String STORAGE_KEY_TEMPLATES
        -String STORAGE_KEY_REPORTS
        +getInstance() DatabaseService
        +getTemplates() QCInspectionTemplate[]
        +getReports() QCInspectionReport[]
        +saveReport(report) void
    }
    class SyncEngine {
        -DatabaseService dbService
        -Boolean isSyncing
        -Boolean isOnline
        +getInstance() SyncEngine
        +registerListener(listener) Function
        +synchronize() Promise
        +autoSync() Promise
    }

    SyncEngine --> DatabaseService : Queries Pending
    QCInspectionReport --> SyncEngine : Managed by Queue
    QCInspectionTemplate --> DatabaseService : Cached schema
```

### Core Domain Models
- **`QCInspectionTemplate`** (`src/models/qc_template.ts`):
  Encapsulates a predefined quality inspection schema. It is responsible for dynamic validation of form payload responses.
- **`QCInspectionReport`** (`src/models/qc_report.ts`):
  Represents a filled-out inspection report. It holds operator observations, self-validates, and handles its own lifecycle states (`draft`, `pending_sync`, and `synced`).

### Singleton Service Providers
- **`DatabaseService`** (`src/services/database_service.ts`):
  Uses the Repository pattern to abstract SQLite database cache files (backed by localStorage in browser sandbox) to persist templates and reports offline.
- **`SyncEngine`** (`src/services/sync_engine.ts`):
  Coordinates network-state monitoring (`window.online`/`offline`), manages the synchronization queue, and sequential background REST submissions.

---

## 2. Sync Lifecycle & Logical Transitions

The synchronization queue uses a state machine to move transactional inspection reports through a strict operational pipeline:

```mermaid
stateDiagram-v2
    [*] --> Draft : Create Inspection
    Draft --> PendingSync : Commit Report (Operator)
    PendingSync --> Synced : SyncEngine POST Success (200 OK)
    Synced --> [*] : Prune Cache (Optional)
```

1. **Draft State:** The operator fills the form. Self-saved frequently.
2. **Pending Sync:** Locked from user modification, entered into the `SyncEngine` sequential queue.
3. **Synced State:** Successfully POSTed by the background service. Marked completed.

---

## 3. High-Level System Design

Chimera MES uses a decoupled offline-first architecture bridging native OS capabilities with a modern, high-performance UI:

*   **Presentation (React 19 + TypeScript):** Elegant mobile/desktop responsive Bento interface.
*   **Bridge (Tauri v2 Core - Rust):** Secure system broker mapping web calls to native file operations, DB bindings, and hardware intents.
*   **Offline Persistence (SQLite / LocalStorage):** Local cache preserving transactional and reference data.
*   **Enterprise Remote (Information Base API):** Master enterprise databases.

---

## 4. UI/UX Style Guide: Futuristic Industrial Design

To reduce operators' fatigue in high-stress assembly lines, Chimera MES adheres to a **Futuristic Industrial Delight** aesthetic:

*   **Palette:**
    *   *Azure White* (`#F5FCFF`) Background reduces strain.
    *   *Royal Blue* (`#3B82F6`) Active primary actions.
    *   *Teal Blue* (`#0D9488`) Success states.
    *   *Deep Ocean* (`#0F172A`) Clear headings and text.
*   **Layout:** Bento-Grid layouts with rounded margins (`24px`), soft glassmorphism shadows, and glowing active borders.
*   **Typography:** Modern `Outfit` brand typography alongside `Inter` interface body text.

---

## 5. Developer Guide & Operational Commands

### Prerequisites
- Node.js (v18+)
- Rust (latest stable for Tauri native desktop shell)

### Setup & Installation
Restore npm dependencies:
```bash
npm install
```

### Running Locally (Vite Web Environment)
To launch the rapid responsive web dev console inside your browser:
```bash
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

### Running Tauri Desktop Environment
To boot Vite inside the native desktop wrapper (Windows/macOS):
```bash
npm run tauri dev
```

### Building for Production
**Windows Standalone / Installer:**
```bash
npm run tauri build
```
Outputs build packages to: `src-tauri/target/release/bundle/`

---

*Chimera MES // Industrial Core // copyright © 2026*
