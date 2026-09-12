# Verification record

Verified on Windows with Node.js 25.9.0, September 12, 2026.

## Automated checks

All 12 Node tests pass. They cover copying and moving between accounts, duplicate rejection without source removal, ordering, backup round-trips, malformed imports, shared and unplaced note preservation, account focus and role/reminder metadata, simulated storage quota errors, local asset serving, blocked private paths and foreign origins, and an offline refresh retaining the existing roster.

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
