# Features & Capabilities

## 1. Offline Synchronization Engine
- **Template Ingestion:** Ability to download multiple JSON-based QC templates while online.
- **Background Sync:** Automatically detects internet restoration and pushes `pending_sync` records sequentially.
- **Sync Dashboard:** A visual indicator showing how many items are waiting to sync, currently syncing, or failed.

## 2. Dynamic Form Rendering
- The UI dynamically generates input fields (toggles, text boxes, numeric spinners) based on the JSON schema defined in the `templates` table.
- Supports logic branching (e.g., "If 'Defect Found' is true, show 'Defect Description' text area").

## 3. Data Integrity & Validation
- **Local Validation:** Ensures required fields are filled and numbers are within expected bounds before allowing the user to "Save Offline".
- **Conflict Handling:** Because QC inspections are generally append-only (creating new records), conflict resolution is minimal. However, local UUIDs prevent duplicate submissions.

## 4. Hardware Integrations (Planned)
- **Barcode/QR Scanner:** Integration with Android intents to populate fields (like `roll_id`) quickly using the device's hardware scanner.
