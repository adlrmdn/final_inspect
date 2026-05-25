# Data Models & Schemas

## Local SQLite Database
The local database acts as the offline cache. It contains two primary categories of data: **Reference Data** (read-only templates) and **Transactional Data** (user-generated inspections).

### Table: `templates`
Stores the predefined form structures fetched from the remote server.
- `id` (String, Primary Key)
- `title` (String)
- `schema` (JSONB / Text) - Defines the questions, types (boolean, number, text), and expected thresholds.
- `version` (Integer)
- `last_updated` (Timestamp)

### Table: `inspections`
Stores the actual QC reports filled out by the operator.
- `id` (String, Primary Key) - UUID generated locally.
- `template_id` (String, Foreign Key)
- `operator_id` (String)
- `payload` (JSONB / Text) - The specific answers provided by the user.
- `status` (Enum: `draft`, `pending_sync`, `synced`)
- `created_at` (Timestamp)

## JSON Schema Example (Form Payload)
```json
{
  "inspection_id": "uuid-1234",
  "template_id": "fabric_check_v1",
  "data": {
    "roll_id": "R-9921",
    "defect_count": 2,
    "visual_pass": true,
    "notes": "Minor edge fraying."
  }
}
```
