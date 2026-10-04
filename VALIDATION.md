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

## Aurora practice (September 29, 2026)

All 30 tests pass, including six new simulation tests covering the exact Q cast delay, outbound/return speeds, E resolution time, successful leading versus aiming at the old position, continuous collision detection, maximum range, prevention of overlapping casts, and agreement across different render intervals. Browser modules pass syntax checks.

The in-app browser verified the new sidebar view, keyboard Q/E casts against a stationary target with successful hit feedback, Q return scoring, difficulty changes, random-juke movement, lead-guide display, and pause controls. The arena and feedback were visually inspected at the normal desktop viewport. A 390 × 844 viewport had no horizontal overflow; the viewport override was reset afterward. Physical touchscreen hardware was not tested. This drill uses the timings supplied by the user and explicitly labels its simplified geometry and return rules.

### Controllable Aurora and overlapping casts

All 36 tests pass. New coverage verifies independent Q/E windups, casting E while Q is already flying, 350-unit/second click movement and arena boundaries, stopping, movement paused only during windup, shots anchored at their cast location, Q homing toward a moving Aurora, and E resolving before its backward hop. The in-app browser showed “Q + E casting” followed by both hits. Right-clicking moved the drawn character to the selected position; clicking a new aim point, stopping, and casting Q/E again worked from that new location. No API key or account connection is needed for practice. Independent overlapping windups and the hop distance remain explicitly labeled training approximations.

### Initial Q cast only

Removed the returning Q projectile and return-hit counter at the user's request. All 36 tests pass, including Q ending at 900 units after 0.8125 seconds, becoming available again immediately, and never creating a return projectile or second score when Aurora moves. Q/E overlap and movement coverage still pass. The browser module passes its syntax check.

### Aurora CS punish drill (September 29, 2026)

The earlier player-to-minion melee order was replaced with an enemy champion that waits for an allied minion to reach last-hit health, walks into melee range, winds up, last-hits, and retreats. Q/E hits during the approach or windup count as CS punishes. All 36 automated checks pass, including the CS cycle, hit timing, outbound-only Q, overlapping Q/E, and the rest of the board. The local browser visibly showed the enemy approaching a selected low-health minion, and the full arena fit in the checked desktop viewport. Minion health loss and enemy behavior remain practice approximations.

### Per-account role order (October 2, 2026)

All 38 automated checks pass. The new tests cover per-account role order, unchanged champion placements and notes, backup round trips, and rejection of malformed role orders. In the in-app browser, dragging Jungle above ADC changed only the selected QA account; Undo restored the original order. The up/down button also changed the order, which survived a reload. A second QA account retained its own ADC-first order. The test account was restored to its original order after verification.

### Champion pages and matchup notebooks (October 4, 2026)

All 41 automated checks pass. New coverage verifies version 1–3 migration to version 4, directional champion/opponent notebooks, blank and unknown-champion notes, preservation across placement changes, and malformed matchup rejection without mutation. Browser checks created Vex vs. Yasuo through the searchable picker using the keyboard, edited its text, switched to general notes, used browser Back, and reloaded the direct matchup URL with the text intact. Choosing an existing opponent reopened its notebook; deleting and Undo restored the text.

The browser export preview contained the matchup notes. Restoring that JSON through the file picker produced an identical exported board; an invalid numeric matchup note was rejected and the exported board stayed identical. The automation did not receive a download event for the existing blob-download control, so the preview JSON was saved locally for the import check. Desktop and 390 × 844 views were inspected with no document-level horizontal overflow; the viewport was reset afterward. The original QA board was restored and compared exactly, and no personal Chrome board data was edited.
