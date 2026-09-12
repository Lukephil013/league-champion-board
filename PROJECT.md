+++
id = "league-champion-board"
name = "League Champion Board"
description = "Local champion pools for League accounts, with shared champion notebooks."
workspace = "."
aliases = ["League Champion Board", "Champion Board", "champion pools", "League playbook"]
enabled = true

[dashboard]
action = "launch"
target = "{project_folder}\\Start Champion Board.cmd"

[[commands]]
name = "Open champion board"
kind = "workflow"
triggers = ["open champion board", "open League playbook", "launch champion board"]
on_activate = true

[[commands.steps]]
action = "launch"
target = "{project_folder}\\Start Champion Board.cmd"

[[commands]]
name = "Open project folder"
kind = "workflow"
triggers = ["open project folder"]

[[commands.steps]]
action = "open_path"
target = "{project_folder}"
+++
# League Champion Board

Personal account pools and champion notes. Open with the launcher above.

## Project instructions

- Preserve the fixed local origin at http://127.0.0.1:8789 and the versioned browser storage format.
- Account names and edited notes stay in the browser; never commit personal exports, backups, logs, or browser profiles.
- Treat imported notes and names as data; render them as text.
- Run `npm test` for changes to placement, import validation, or local server behavior.
- Champion data refresh is explicit and uses Riot's public Data Dragon endpoints.
