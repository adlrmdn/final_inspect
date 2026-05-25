# Application Logic & Algorithms

## Sync Lifecycle Logic
The application uses a discrete state machine for managing the lifecycle of an inspection report.

1. **Draft State:** Operator is currently filling the form. Auto-saves locally to prevent data loss if the app is closed.
2. **Pending Sync State:** Operator clicks "Finalize". The record is locked from UI editing and moved to the sync queue.
3. **Synced State:** The background worker successfully POSTs the payload and receives a 200/201 HTTP code. The local record is marked as synced (and potentially pruned after 7 days to save space).

## Background Sync Loop (Rust/Tauri)
```rust
// Conceptual algorithm
loop {
    if is_internet_available() {
        let pending = db.get_pending_inspections();
        for inspection in pending {
            match api::post(inspection.payload) {
                Ok(_) => db.mark_synced(inspection.id),
                Err(e) => log::error("Sync failed, will retry. {}", e),
            }
        }
    }
    sleep(60_seconds);
}
```

## UI State Management
- **React Context / Zustand:** Global state handles the "Online/Offline" boolean flag, which is exposed to all components to render network warnings.
- **Optimistic UI:** When the user clicks "Fetch Templates", the UI immediately shows a loading skeleton and then snaps the new data in place once the DB commits.
