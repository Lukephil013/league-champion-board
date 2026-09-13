$ErrorActionPreference = 'Stop'

$boardShortcutName = 'Champion Board.lnk'
$boardStartMenu = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs'
$boardStartup = Join-Path $env:APPDATA 'Microsoft\Windows\Start Menu\Programs\Startup'
$boardStartShortcut = Join-Path $boardStartMenu $boardShortcutName
$boardStartupShortcut = Join-Path $boardStartup 'Champion Board Taskbar.lnk'
$boardOldTaskbarShortcut = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar\Champion Board.lnk'
$boardLauncherSource = Join-Path $PSScriptRoot 'ChampionBoardLauncher.cs'
$boardLauncher = Join-Path $PSScriptRoot 'LeagueChampionBoardTaskbar.exe'
$boardIcon = Join-Path $PSScriptRoot 'Champion Board.ico'

if (-not (Test-Path -LiteralPath (Join-Path $PSScriptRoot 'launch.vbs'))) { throw 'launch.vbs is missing from the Champion Board folder.' }
if (-not (Test-Path -LiteralPath $boardLauncherSource)) { throw 'ChampionBoardLauncher.cs is missing from the Champion Board folder.' }
if (-not (Test-Path -LiteralPath $boardIcon)) { throw 'Champion Board.ico is missing from the Champion Board folder.' }

$boardCompiler = @(
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework64\v4.0.30319\csc.exe'),
    (Join-Path $env:WINDIR 'Microsoft.NET\Framework\v4.0.30319\csc.exe')
) | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1

if (-not $boardCompiler) { throw 'The Windows C# compiler is unavailable.' }

Get-Process -Name 'LeagueChampionBoardTaskbar' -ErrorAction SilentlyContinue | Stop-Process -Force
& $boardCompiler /nologo /target:winexe /reference:System.Drawing.dll /reference:System.Windows.Forms.dll "/win32icon:$boardIcon" "/out:$boardLauncher" $boardLauncherSource
if ($LASTEXITCODE -ne 0 -or -not (Test-Path -LiteralPath $boardLauncher)) {
    throw 'The Champion Board taskbar launcher could not be built.'
}

$boardShell = New-Object -ComObject WScript.Shell
foreach ($boardShortcut in @($boardStartShortcut, $boardStartupShortcut)) {
    $boardLink = $boardShell.CreateShortcut($boardShortcut)
    $boardLink.TargetPath = $boardLauncher
    $boardLink.Arguments = ''
    $boardLink.WorkingDirectory = $PSScriptRoot
    $boardLink.IconLocation = $boardIcon + ',0'
    $boardLink.Description = 'Open the local League Champion Board'
    $boardLink.Save()
}

# Remove the earlier non-working pinned-folder shortcut created by older versions
# of this installer. The native launcher keeps a real button on the taskbar.
if (Test-Path -LiteralPath $boardOldTaskbarShortcut) {
    Remove-Item -LiteralPath $boardOldTaskbarShortcut -Force
}

Start-Process -FilePath $boardLauncher -WorkingDirectory $PSScriptRoot
Start-Sleep -Milliseconds 700

$boardProcess = Get-Process -Name 'LeagueChampionBoardTaskbar' -ErrorAction SilentlyContinue | Select-Object -First 1
if (-not $boardProcess) { throw 'The Champion Board taskbar launcher did not start.' }

Write-Host "Champion Board taskbar launcher is running (PID $($boardProcess.Id))."
