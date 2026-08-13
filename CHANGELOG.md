# Changelog

All notable changes to the Chimera QC Console are documented in this file.

## [1.2.5]

- Fix: D365 line sync (`fetch_and_store_lines`) no longer wipes out previously-synced size rows (e.g. size S) when Dynamics returns an empty or partial `JobTransactionLinesDetails` response. The delete+reinsert is now skipped on an empty response and wrapped in a transaction so a mid-loop insert failure can't leave rows deleted with nothing reinserted.
- Fix: the "select style" picker now refetches active PLM activities whenever it's opened, instead of only once at app launch — projects that become eligible (e.g. `PLMActivityStatus` flips to `Started`) after the app was loaded now show up without requiring a reload.

## [1.2.4]

- Fix: the "Send" step of the Verify email flow no longer marks a session as "waiting approval" when the email actually failed to send. The approval token/chain is now only persisted after the email dispatch (direct SMTP or web-service fallback) succeeds.
- Fix: send failures now distinguish genuine connectivity problems (unreachable mail server / web service — DNS, firewall, VPN, server down) from other send errors, surfacing a dedicated "Connection Failed" alert instead of the generic "Send Failed" message.

## [1.2.3]

- Perf: `verified_doc` PDF caching is now scoped to only the currently active project, reducing memory/storage overhead from caching documents for inactive projects.

## [1.2.2]

- Perf: trimmed the project directory fetch payload.
- Added an SMTP timeout with fallback to the web-service email dispatch path.
- Added seamless style search in the project directory.
- Style: updated the production output grid layout and the Tauri print opener.

## [1.2.1]

- Fix: allow editing a session after an HO (Head Office) rejection.
- Fix: corrected defect image data separation by session in printed reports.
- Feature: added a QC Inspector Remarks field to the QC Console bento card and its database save pipeline.
- Fix: resolved font fallback issues, replaced Unicode characters with SVGs, and fixed grid alignment in printed reports.
- Cleaned up the client-side PDF renderer and routed printing through the server print endpoint.
- Feature: auto pre-fill inspector name on session init and update the stored inspector profile on save.
- Feature: render attributed approver identity in report signature boxes.
- Refactor: stopped console-side `verified_doc` regeneration — the portal now owns document generation.
- Style: profile chip repositioning and signature-box formatting tweaks.

## [1.2.0]

- Feature: moved the approval workflow to a portal-driven 3-stage chain (QC → HO → Director) with Director authorization.
