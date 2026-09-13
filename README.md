# League Champion Board

A personal, local website for organizing champion pools across League accounts. A champion can belong to several accounts, while its notebook stays shared everywhere.

## Open the app

Requires **Node.js 22 or newer**. No npm dependencies, API key, account login, or build step.

On Windows, double-click **Start Champion Board.cmd**. It starts the server in the background and opens your default browser. Reopening the launcher reuses the running server.

To keep a Champion Board button on the taskbar, right-click **Install Taskbar Shortcut.ps1** and choose **Run with PowerShell** once. The installer builds a tiny local Windows launcher with the included gold-and-navy icon, starts it minimized, and adds it to Windows Startup. Clicking its taskbar button opens the board. Its notification-area menu can also open the board or exit the launcher. The launcher contains no network or account integration; it only calls the same local `launch.vbs` file.

Alternatively, run `npm start`, then open **http://127.0.0.1:8789**. Keep that exact address and browser profile: `localhost`, a different port, and another browser have separate storage. The launcher reports conflicts instead of switching ports. When started with `npm start`, press Ctrl+C to stop it. The background launcher process ends when Windows signs out or restarts; closing the browser leaves it running.

The included `PROJECT.md` registers the launcher with a compatible Center project hub.

## Organize your champions

- Choose an account from the left sidebar. Its champions appear under **ADC, Jungle, Mid, Top, and Support** headings. Champions without a role appear under **Unassigned**. On narrow screens, account navigation moves above the board.
- Add and name accounts. Use **Manage account** to rename it, change its order, edit its focus, or delete it.
- Search the full roster by champion name; aliases include **J4**, **Kha**, and **Wukong**.
- Open **Champion library**, or use a role's **+ Add** button to search the full roster and add directly into that role. Drag a placed portrait onto another role to change its role, onto an account in the sidebar to move accounts, or before a portrait to reorder.
- Use **+ Add** as the keyboard/touch alternative. A placed champion’s **•••** menu offers Set role, Move, Copy, reorder within its role, and Remove. Accounts cannot contain duplicate placements.
- Click a portrait or **Notes** to edit its shared notebook. The small gold corner mark indicates a nonempty notebook. Changes save automatically.
- Removing a placement or an entire account keeps every champion notebook. **Undo** reverses the last account/placement change without rolling back later note edits.
- Use an account’s **Edit account focus** action to describe its purpose. Champion menus include **Set role** and **Edit placement reminder** for account-specific context such as autofill or tentative picks. Those labels move/copy with the placement; shared notebooks remain unchanged.

The first launch starts with no account assignments and 14 concise notebooks from a jungle-pool discussion. Suggestions are labeled separately from observations; item ideas are experiments, not maintained build recommendations. Edited or cleared notes are never replaced by the starter notes.

## Saving and backups

Accounts, placements, champion notes, and journal entries are stored only in this browser profile’s local storage, under `league-champion-board:v1`. The key remains the same so existing boards upgrade in place; the data format is now version 2. The local server never receives them. Clearing site data, using a different browser/profile, or moving to a different address will not carry them over automatically.

Open the **Settings gear** at the bottom of the sidebar to use **Export backup** or **Import backup**. Export regularly, especially before clearing browser data. The preview lets you copy the JSON text or choose **Download JSON**. Keep the downloaded `league-board-YYYY-MM-DD.json` outside the repository, or inside the ignored `backups/` folder. **Import backup** validates the file and asks before replacing the board, including its journal. A failed import does not change existing data. Import also provides recovery if saved data could not be read. Existing version 1 backups remain compatible and start with an empty journal; new backups include dated entries, account focus, roles, and conditional reminders.

Refresh other open board tabs after upgrading. When space allows, the app retains one pre-upgrade snapshot in browser storage at `league-champion-board:before-v2`; regular JSON exports remain the portable backup.

If storage is full or unavailable, a red banner and **Not saved** indicator appear. Export before closing. Opening multiple tabs is supported; if an external change arrives while this tab has unsaved edits, saving pauses so you can export before reloading.

## Daily journal

Choose **General journal** in the sidebar, then **New entry**. Each entry has an editable date, optional title, and a free-form notebook. The date defaults to today in your local timezone. You can create multiple entries on the same day, revisit them from the newest-first list, and edit them at any time.

The journal is shared across all accounts. Entries save automatically as you type, and pending edits flush when switching views or leaving the page. Deletion asks for confirmation and offers **Undo**. Account and champion placement changes never delete journal entries. Journal contents stay local and are included in JSON backups.

## Champion data

The repository bundles all 173 champions and portraits from Riot Data Dragon **16.18.1**. The app works offline from those assets. **Refresh roster** explicitly downloads the latest available catalog and portraits from Riot’s public Data Dragon service; an incomplete update leaves the previous catalog active. Personal data is not sent to Riot.

Refreshed assets stay in the ignored `.catalog-cache/` directory. They are separate from browser data and are not pushed to GitHub. Roster refresh does not change notes or assignments. Data Dragon updates can lag game releases.

To deliberately update the bundled public roster as a developer, run `npm run catalog` with an internet connection, inspect the changes, then commit them.

## Development and verification

`npm test` runs Node’s built-in tests for placement behavior, backup validation, storage failure handling, and local server boundaries. `node --check dist/app.mjs` checks browser module syntax. There is no compilation step; `dist/` is authored source, not a generated build.

- `dist/`: interface, state logic, starter notes, bundled catalog and portraits.
- `server.mjs` / `catalog.mjs`: localhost-only static server and explicit roster updates.
- `launch.ps1` / `launch.vbs`: Windows background server launcher.
- `ChampionBoardLauncher.cs` / `Install Taskbar Shortcut.ps1`: source and installer for the taskbar launcher. The generated `.exe` stays local and is ignored by Git.

Only the `dist/` assets and champion portrait cache are served. Requests to private project files are rejected. The server binds to `127.0.0.1`, validates the host, and requires same-origin refresh requests. No telemetry, cloud sync, Riot account connection, or website hosting is included.

## Credits

Champion names, portraits, and game assets belong to Riot Games. Data source: [Riot Data Dragon documentation](https://developer.riotgames.com/docs/lol#data-dragon).

League Champion Board isn’t endorsed by Riot Games and doesn’t reflect the views or opinions of Riot Games or anyone officially involved in producing or managing League of Legends. League of Legends and Riot Games are trademarks or registered trademarks of Riot Games, Inc. League of Legends © Riot Games, Inc.
