# Verification record

Verified on Windows with Node.js 25.9.0, September 12, 2026.

## Automated checks

All 24 Node tests pass. They cover copying and moving between accounts, duplicate rejection without source removal, ordering, backup round-trips, malformed imports, shared and unplaced note preservation, account focus and role/reminder metadata, simulated storage quota errors, local asset serving, blocked private paths and foreign origins, and an offline roster refresh retaining the existing catalog. Additional cases cover legacy migration, journal entries and date validation, role grouping, Ranked Solo history validation and aggregation, OP.GG Riot ID parsing, queue 420 request filtering, cached-match deduplication, local API-key/cache persistence, and the complete background refresh endpoint.

The browser modules pass Node's JavaScript syntax check. The bundled catalog contains 173 records with matching PNG portraits.

## Browser checks

Verified through the actual interface:

- Created accounts, renamed an account, and changed account order.
- Added Ashe from the full roster and reordered placements through the menu.
- Copied J4 to two accounts and edited/read the same notebook from both.
- Dragged Ashe between accounts and reversed the move with Undo.
- Deleted a test account with confirmation; champion notes remained.
- Exported a real JSON backup and restored its two accounts and 14 notebooks through Import.
- Reloaded the board with saved accounts and notes intact.
- Inspected the desktop layout and a 390 × 844 viewport, with no horizontal overflow or broken visible portraits.
- Opened the mobile notes drawer and dismissed it with Escape.

Storage quota failure and offline refresh preservation were exercised by automated fault tests, not by disabling the user's browser storage or network. Physical touchscreen hardware was not tested; the clickable alternatives and narrow layout were checked.

## Local launch

Stopped the development server and launched `Start Champion Board.cmd`. Verified the new background server's health response and log, with an empty startup-error log. The saved board remained available after the restart. The app always uses http://127.0.0.1:8789.

Personal browser state, exports, and runtime logs are excluded from the public source repository.

Account focus, role labels, and conditional placement reminders were also populated and verified through the browser controls. A before/after comparison confirmed existing shared notebooks were unchanged. Old version 1 backups remain compatible. File import was previously verified in the in-app browser; Chrome's extension requires file-URL access for automated file selection, so the subsequent account update used ordinary UI controls instead.

## Journal and account sidebar update

- Compared the real board's backup before and after migration: accounts, placement order, role/reminder metadata, and shared notebooks were unchanged. The journal started empty.
- Switched accounts through the sidebar and verified role headings and the selected account view.
- Created and edited dated journal entries, switched between entries and accounts, and reloaded with saved text intact.
- Deleted an entry with confirmation and restored it with Undo.
- Restored a version 2 backup containing journal entries and compared the complete exported state for equality. Rejected a backup with an impossible calendar date without changing any data.
- Used keyboard controls to open navigation, search the full library, add a champion into a chosen role, and reorder placements. Undo restored the original placements.
- Inspected the journal and account layout in the in-app browser, including a 390 × 844 journal viewport with no document-level horizontal overflow. Reset the viewport afterward.

The current in-app browser drag automation emitted drag-start/drag-over events with an accepted move target but ended without a drop event. Role placement logic is covered by unit tests and the UI alternatives passed; this update's physical mouse drop was not independently verified. Temporary event diagnostics and test journal entries were removed. Chrome's account data and rendered role structure were verified through the DOM; Chrome screenshot capture timed out, so visual inspection used the in-app browser.

## Champion card spacing

Verified the populated main account in Chrome after tightening its role grids. Account cards are 76 pixels wide with 50 × 50 portraits, compact name and action spacing, and no repeated role badge inside a role section. The five requested role headings remain in ADC, Jungle, Mid, Top, Support order. Placement reminders such as Jax's autofill note remain visible, and the populated page measured 1084 pixels tall at the checked desktop viewport.

## Compact layout and settings

Account portraits render at 50 × 50 pixels. The top bar and sidebar caption were removed, and the settings gear remains at the bottom-left of the desktop sidebar. On the same test board and desktop viewport, document height dropped from 1490 to 912 pixels. Checked the desktop layout and a 390 × 844 viewport without document-level horizontal overflow. Verified gear keyboard activation, Escape dismissal, export preview, import selection and replacement confirmation (cancelled), and opening champion notes. The exported board before and after these checks was identical. No saved-data schema changes were needed.

## Ranked Solo/Duo history

- Migrated the browser state to version 3 while retaining accounts, placements, notes, OP.GG links, and journal entries.
- Verified that only Match-v5 queue 420 is requested and that cached match IDs do not trigger repeated detail requests.
- Verified per-account and combined champion aggregation, win/loss totals, date coverage, malformed-history rejection, and legacy backup migration.
- Verified the same-origin API-key and refresh endpoints, private-file blocking, runtime-only secret/cache persistence, and an end-to-end mocked background refresh.
- Restarted the fixed-port server and confirmed `/api/health` reports version 2. Opened the Settings dialog in the in-app browser and visually checked the API-key field, disabled pre-setup update control, queue 420 explanation, backup controls, and local-storage status. The browser console had no warnings or errors.

A real Riot request was not made because no Riot API key was supplied. The mock uses the official Account-v1 and Match-v5 response shapes and exercises the complete local request, cache, aggregation, and browser-status path without storing a fake key in the project.
