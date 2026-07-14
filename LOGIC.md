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

## Calculation & Yield Rules
The Quality Control System enforces specific formalized equations for yield and reject tracking:

1. **Reject Produksi (Production Rejects)**:
   This represents the sum of all production-related reject categories:
   $$\text{reject\_produksi} = \text{reject\_cutting} + \text{reject\_sewing} + \text{reject\_finishing} + \text{reject\_printing} + \text{reject\_embro} + \text{reject\_washing}$$

2. **Total Reject Quantity (`total_reject_qty` / `reject_qty`)**:
   This is the total sum of all defect types and lost garments:
   $$\text{reject\_qty} = \text{reject\_produksi} + \text{reject\_bahan} + \text{btj} + \text{barang\_hilang}$$

## Data Sanitization Rules
To prevent Rust backend deserialization panic/errors (e.g. `invalid type: string "", expected f64` during Serde operations) when fields are left blank or filled with whitespaces, a strict sanitization layer is enforced:
1. **String Trimming**: Any text input field is trimmed of leading and trailing whitespaces.
2. **Numeric Coercion**: If a numeric input field (e.g., AQL, inspection quantity, or defect numbers) resolves to an empty string `""` or whitespace after trimming, it is coerced to `0` or `0.0` at the React state layer and the service integration layer before saving.
3. **Optional Database Fields**: Nullable database fields (e.g., `reject_bahan`) are set to `null` if empty, rather than an empty string.

## Print Signature Workflow
Section 5 (Conclusions) in the official printed report layout enforces a 5-column grid alignment matching corporate compliance standards:
- **Column 1**: Overall Inspection Result (Status block: `PASSED`, `FAILED`, `PENDING`)
- **Column 2**: `Inspected By` (Inspector role and name)
- **Column 3**: `Confirmed By` (Factory Representative role and name)
- **Column 4**: `Approved By` (MPG HO - MD Production role and name)
- **Column 5**: `Authorized By` (Director role)

*Note: To align with confidentiality and document standards, names are conditionally omitted from printing if no name data has been entered or signed in the database.*
