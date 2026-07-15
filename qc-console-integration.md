# QC Console ⇄ Vendor Portal — Integration Setup (handoff)

Single reference for the portal↔QC-Console integration: architecture, DB config,
schema, routes, the approval flow, and the fabric-lines publish/pull contract.
Send this to the console-side team/session. Portal side is implemented as of
**2026-07-06**; **console action items are in §8**.

---

## 1. Architecture
- **Integration method: shared database (Method B), NOT an API.** The portal and
  the QC Console (Tauri/Windows app, separate repo) talk through a shared
  PostgreSQL **QMS database** on the same AWS server.
- The **console generates the approval emails** (so the portal cannot HMAC-sign
  URLs). It writes a random-UUID bearer token onto its session row and puts it in
  the link; the portal validates the token and writes decisions back to rows the
  console polls (~8s).
- The portal is the **host/provider**: it renders the approval pages and now also
  **publishes fabric consumption data** the console pulls.

## 2. Connection config (portal side)
Connection name **`qms`** in `config/database.php`, driven by env:

```
QMS_DB_URL=            # optional full DSN; else the parts below
QMS_DB_HOST=
QMS_DB_PORT=5432
QMS_DB_DATABASE=qms
QMS_DB_USERNAME=
QMS_DB_PASSWORD=
# driver=pgsql, search_path=public, sslmode=prefer (hardcoded)
```
Base URL used in the console's links (`WEB_SERVICE_URL` on their side):
**`https://vendor-portal.megaperintis.co.id`**

## 3. Routes (portal endpoints the console links to)
| Route name | Method | Path | Purpose |
|---|---|---|---|
| `qc.approve` | GET | `/qc/approve/{token}` | Stage-1 factory/vendor confirm (writes signature) |
| `qc.reject` | GET | `/qc/reject/{token}` | Stage-1 reject |
| `qc.ho-approve` | GET | `/qc/ho-approve/{token}` | Stage-2 HO form (calc+approval) |
| `qc.ho-approve.submit` | POST | `/qc/ho-approve/{token}` | Stage-2 HO commit |
| `qc.ho-decline` | GET | `/qc/ho-decline/{token}` | Stage-2 HO reject |

All resolve the row via `approval_token` (uuid), `Str::isUuid()`-guarded → bad
token returns a friendly page, never a 500.

## 4. Approval flow & column ownership — `packaging_project_sessions`
Stage 1 (`approve`) writes the signature, then chains an email to the HO approver.
Stage 2 (`hoApprove`) publishes fabric lines (§5), writes deduction lines, then
the HO signature — all guarded, never fatal.

**Column ownership (do not violate):**
| Column | Owner | Notes |
|---|---|---|
| `factory_representative` | **Console** | inspector's manual name — portal NEVER writes it |
| `approval_signature` | Console (portal writes) | `Digitally Signed: <email> [UTC+07:00: …]` |
| `ho_approval_signature` | Console (portal writes) | `Digitally Signed:` / `Rejected:` prefix branches |
| `approval_token`, `approval_email`, `approved_by`, `approved_at`, `approval_source`, `approval_status` | **Portal** | added by portal migration `2026_07_01_000001`, nullable, guarded |

Console detects: approval via `approval_status='approved'` + `approval_signature`;
rejection via `approval_status='rejected'`; HO decision via the `ho_approval_signature` prefix.

## 5. Fabric-lines publish/pull — `packaging_project_fabric_lines`
**Why:** the cutting report (consumption figures) is ready BEFORE the console's
project exists. So the portal publishes; the console pulls by `production_group`.

**Portal migration `2026_07_06_000003`** (qms conn, guarded, additive) makes the
console's table publishable:
| Change | Detail |
|---|---|
| add `production_group` (indexed, nullable) | **the pull key** |
| add `overconsumption`, `fabric_price`, `deduction` (nullable) | figures it couldn't store before |
| **relax `project_id` → NULLABLE** | `ALTER … DROP NOT NULL` — lets a row be *staged* pre-project |

**Row lifecycle (portal writes via `SubconFabricLinePublisher::publish`):**
1. **Cutting approval** → upsert per fabric, key `(production_group, label)`,
   `project_id = NULL` (staged). `created_by = 'web_portal'`.
   `overconsumption`, `fabric_price`, and `deduction` are **already written here** —
   the cutting gate requires the approver to enter consumption figures before signing
   (`SubconConsumptionService::persist()` runs before `publish()`). `deduction` is 0
   when within the 3% tolerance, a positive IDR amount otherwise — never null after
   cutting approval completes.
2. **HO approval** → re-publish (figures may be revised) and **set `project_id`**.
   `project_id` is only ever SET, never nulled → a console-set value survives.
   HO does not create these figures — it only overwrites them with the final recomputed values.

**Console PDF implication:** fabric overconsumption deduction rows are visible in the
Stage-1 PDF (sent before cutting approval) if the portal has published already. They
are not a "final PDF only" feature. If the console wants Stage-1 PDFs to omit them,
that must be an explicit rendering rule, not an assumption that the columns are empty.

`retur_kain` (portal) → **`return_kain`** (QMS). NOT-NULL numerics coalesced to 0.

## 5a. Two distinct "deductions" — do not conflate

| | Source | Writer | When | Table |
|---|---|---|---|---|
| **Overconsumption charge** | calc engine: `max(0, actual − 1.03×plan) × qty × price` | `SubconFabricLinePublisher::publish()` | Cutting approval (revised at HO) | `packaging_project_fabric_lines.deduction` |
| **Ad-hoc / misc rows** | HO form "Add row" fields (label reprint, etc.) | `QcApprovalController::hoApprove` | HO only | `packaging_session_deduction_lines` (keyed by `session_id`) |

Console rendering correctly sources each from the right place:
- `fabricDeductionLines` ← `fabric_lines[].deduction` — shows from Stage-1 onward when `deduction > 0`
- `manualLines` ← `session.deduction_lines` — only present after HO approval

Do not assume `packaging_project_fabric_lines.deduction` is null at Stage 1 — it is computed and written at cutting approval.

## 6. Email routing (portal `Setting` keys)
- Stage-2 HO email recipients: `qc_ho_approver_email`, **empty-aware fallback** to
  `subcon_cutting_approver_email` (a blank saved value returns `''`, not a default).
- Editable in **Subcon Admin → Workflow settings** ("Final Email Address(es)").

## 7. Portal migrations to apply on the QMS DB
Run against the `qms` connection (portal already scopes them):
- `2026_07_01_000001_add_qc_approval_columns_to_packaging_sessions` — approval/token/audit cols.
- `2026_07_06_000003_add_publish_keys_to_packaging_fabric_lines` — publish keys + relax project_id.

Both are guarded (`hasColumn`/`hasTable`) and re-runnable.

## 8. ✅ Console-side action items
1. **Read fabric lines by production_group** when starting a packaging project:
   ```sql
   SELECT * FROM packaging_project_fabric_lines WHERE production_group = :pg;
   ```
2. **Adopt** them to your project so your existing read-by-`project_id` PDF path
   keeps working unchanged:
   ```sql
   UPDATE packaging_project_fabric_lines
   SET project_id = :project_id
   WHERE production_group = :pg AND project_id IS NULL;
   ```
3. Continue reading `overconsumption` / `fabric_price` / `deduction` if you want
   them on the QMS side (now available).
4. **⚠️ Deploy ordering:** the portal has STOPPED the old `project_id`-only insert
   at HO time. Ship this pull+adopt **before/with** the portal deploy, or fabric
   lines won't link to projects created in the gap.

## 9. Portal-side guarantees
- Every QMS write is `hasTable`/`hasColumn`-guarded + try/catch → a missing
  column/table or unreachable QMS is logged and skipped, never blocks an approval.
- Publishing runs before the HO signature so the console sees fabric lines by the
  time the signature triggers PDF regen.
- The portal creates **no** console-owned tables; it only adds guarded nullable
  columns to existing ones.

---

## 10. Director workflow (2026-07-14) — three-stage chain, portal-driven completion

**New chain:** QC (console) → Factory Rep (`qc.approve`) → **MD Production** (`qc.ho-approve`) → **Director** (`qc.director-approve`, NEW) — all keyed off the same `approval_token`.

| Event | Portal action |
|---|---|
| Factory Rep approves | refresh `verified_doc` (server-side PDF), chain MD Prod email |
| Factory Rep rejects | `approval_status='rejected'` + **reject-notif email to `inspector_email`** (back to QC) |
| MD Prod approves | refresh `verified_doc`, **queue `job_trans_raf` RPA**, clear stale director stamp, chain Director email |
| MD Prod rejects | `ho_approval_signature='Rejected:…'` + reject-notif to inspector (back to QC, full restart) |
| Director approves | write `director_approval_signature`, regen final 3-sig PDF → `verified_doc`, **queue `invoice` + `deduction` RPA** (deduction = Σ `fabric_lines.deduction` + Σ `deduction_lines.amount`, only when > 0), **set `packaging_projects.status='completed'`**, 4-party completion email (QC/Factory Rep/MD Prod/Director) with signed PDF attached |
| Director rejects | `director_approval_signature='Rejected:…'` **and clears `ho_approval_signature`** in one update → back to **MD Production only** (factory signature kept); MD Prod re-emailed with the reason. MD Prod re-approval clears the director stamp. |

**New QMS columns** on `packaging_project_sessions` (portal migration `2026_07_14_000001`, mirrored in console DDL):
- `director_approval_signature` — portal-written, same `Digitally Signed:`/`Rejected:` prefix contract as HO.
- `inspector_email` — console-written from the device profile popup (blocking at app start; localStorage `chimera_qc_inspector_profile`; passed via `save_session_approval_info`). Used for reject notifs + completion email.

**Console changes:** manual **Complete & Sync is removed** (completion is automatic at Director approval); the console **no longer queues or deletes** `invoice`/`deduction`/`job_trans_raf` on save (portal owns them; manual `trigger_partial_process_sync` remains). Console re-send (`save_session_approval_info`) resets ALL three signatures. PrintReport Box 4 (Authorized By / Director) now renders from `director_approval_signature`.

**Standard PDF:** the portal renders the same inspection report server-side (`QcReportPdfService` + `qc/pdf/inspection-report` DomPDF blade, structural port of PrintReport.tsx) and refreshes `verified_doc` at every signature milestone — the console app no longer needs to be open for the document to carry the latest signatures. RPA `signed_doc` payloads use this document.

**Settings:** `qc_director_approver_email` (Subcon Admin → Workflow, "Director Email Address(es)"), empty-aware fallback to `qc_ho_approver_email` → `subcon_cutting_approver_email`. Portal `rpa` DB connection via `RPA_DB_*` env.

**Director in-app tab (2026-07-14):** portal-side only — a `subcon_admin` account whose email is in `qc_director_approver_email` sees a separated "Director" tab (`/subcon/admin/director-approvals`) listing HO-signed sessions awaiting authorization; its buttons open the same token-based `qc.director-approve` / `qc.director-decline` forms, so the signature contract ('MPG Director') and routing are unchanged and the console needs nothing. Legacy projects already `completed` under the old two-stage flow are excluded from the tab and refused by the guard (re-authorizing would re-queue a real invoice RPA).

**Dynamic verified_doc (2026-07-15):** `packaging_projects.verified_doc` is now maintained EXCLUSIVELY by the portal after Verify → Send. The portal re-renders the report server-side and pushes it into the column at every workflow transition — stage-1 approve/reject, HO approve/decline, Director authorize/reject (a Director rejection re-renders so the cleared HO signature disappears from the document) — and on-demand whenever `GET /qc/document/{token}` serves it (Director-tab "Report" button; same token gate as the approval links). The console's HO-signature detection effect that regenerated + uploaded the PDF client-side was REMOVED (it raced the portal's render and could overwrite a 3-signature document with a 2-signature one); the console's only remaining write is the initial upload at Verify → Send so the first email has an attachment. The console preview iframe keeps reading `verified_doc` and therefore follows automatically.

**Attributed signatures (2026-07-15):** the `<who>` inside the signature contract may now be `Name <email>` instead of a role label. Attribution sources, in precedence order: the logged-in portal account (Director tab), else the `as` recipient marker on the per-recipient approval emails (HO + Director emails are now sent one message per approver, each link carrying `?as=<their email>`), else the legacy role label ('MPG HO - MD Production' / 'MPG Director') — so old links and scanner-stripped URLs degrade gracefully. The prefix/timestamp contract is unchanged. PrintReport (console) and the portal PDF both render each box as: badge (✓ Digitally Signed / Rejected), `(email)` when known, timestamp, then Name over the ROLE title — inspector name/email from the console profile popup, factory-rep name = the console-typed `factory_representative` with the approval email on the stamp.
