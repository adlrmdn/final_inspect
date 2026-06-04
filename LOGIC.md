# Application Logic & Algorithms

## Sync Lifecycle Logic
The application uses a discrete state machine for managing the lifecycle of an inspection report.

1. **Draft State:** Operator is currently filling the form. Auto-saves locally via `DatabaseService` to prevent data loss if the app or window is closed.
2. **Pending Sync State:** Operator clicks "Finalize". The record is locked from UI editing and moved to the sync queue.
3. **Synced State:** The background worker (`SyncEngine`) successfully POSTs the payload and receives a 200/201 HTTP code. The local record is marked as synced.

## Sequential Background Sync Loop (TypeScript)
The `SyncEngine` handles local state monitoring and pushes reports sequentially to prevent network choke:
```typescript
// Core sync sequence
async function synchronize() {
  if (!isOnline || isSyncing) return;
  isSyncing = true;
  
  const pendingReports = db.getPendingSyncReports();
  for (const report of pendingReports) {
    try {
      await api.post('/reports', report.payload);
      report.markSynced();
      db.saveReport(report);
    } catch (error) {
      console.error('Sync failed for report:', report.id, error);
      break; // Pause queue processing if server fails
    }
  }
  isSyncing = false;
}
```

## UI State Management
- **Sync Listener:** Components subscribe to network/sync updates via `SyncEngine.registerListener()`.
- **Flexible Chained Sizing:** The viewport height is constrained to `100vh` via continuous flexbox chaining (`min-height: 0; flex: 1;`), preventing parent container overflows and window scrollbars.
