# Data Models & Schemas

## Local Persistence (LocalStorage Engine)
The local database acts as the offline cache. It is managed by `DatabaseService` using browser-safe `localStorage` keys. It stores **Reference Data** (read-only QC templates) and **Transactional Data** (completed/draft reports).

### Storage Key: `chimera_qc_templates`
Stores an array of predefined QC form schemas fetched or seeded at launch.
- `id` (String) - Unique identifier (e.g., `fabric_v1`, `pack_v2`).
- `title` (String) - Display title.
- `version` (String) - Template schema version.
- `description` (String) - Quick description.
- `fields` (Array) - Definitions of form questions:
  - `id` (String)
  - `label` (String)
  - `type` (`'text' | 'number' | 'select' | 'boolean'`)
  - `required` (Boolean)
  - `options` (Array of Strings, optional for select type)
  - `defaultValue` (Any)

### Storage Key: `chimera_qc_reports`
Stores an array of completed/draft QC inspection reports loaded dynamically via `QCInspectionReport`.
- `id` (String) - UUIDv4 generated locally.
- `templateId` (String) - References the parent template ID.
- `operatorId` (String) - Active operator name/ID.
- `payload` (JSON Object) - Specific user answers matched to the template's field IDs.
- `status` (`'draft' | 'pending_sync' | 'synced'`) - State machine sync lifecycle flags.
- `createdAt` (String) - ISODate string.

## JSON Schema Example (Form Payload)
```json
{
  "id": "c71e847d-8eb9-4081-9b6a-93e5a59c991b",
  "templateId": "fabric_v1",
  "operatorId": "KAIZEN_OPERATOR",
  "payload": {
    "roll_id": "BTC-101",
    "defect_count": 2,
    "width_variance": 1.25,
    "visual_pass": true,
    "notes": "Completed successfully."
  },
  "status": "pending_sync",
  "createdAt": "2026-05-25T09:44:00.000Z"
}
```
