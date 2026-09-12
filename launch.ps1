$ErrorActionPreference = 'Stop'
$boardUrl = 'http://127.0.0.1:8789'
try {
    $boardNode = (Get-Command node -ErrorAction Stop).Source
    $boardMajor = [int]((& $boardNode --version).TrimStart('v').Split('.')[0])
    if ($boardMajor -lt 22) { throw 'Champion Board needs Node.js 22 or newer. Install it from nodejs.org, then open the launcher again.' }
    $boardHealth = $null
    try { $boardHealth = Invoke-RestMethod -Uri "$boardUrl/api/health" -TimeoutSec 2 } catch {}
    if ($boardHealth -and $boardHealth.app -ne 'league-champion-board') { throw 'Another app is using port 8789. Close that app before opening Champion Board.' }
    if (-not $boardHealth) {
        $boardRuntime = Join-Path $PSScriptRoot '.runtime'
        New-Item -ItemType Directory -Path $boardRuntime -Force | Out-Null
        $boardProcess = Start-Process -FilePath $boardNode -ArgumentList @('server.mjs') -WorkingDirectory $PSScriptRoot -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $boardRuntime 'server.log') -RedirectStandardError (Join-Path $boardRuntime 'server-error.log')
        for ($boardTry = 0; $boardTry -lt 20; $boardTry++) {
            Start-Sleep -Milliseconds 300
            if ($boardProcess.HasExited) { throw 'Champion Board could not start. Port 8789 may be in use. See .runtime\server-error.log in the project folder.' }
            try { $boardHealth = Invoke-RestMethod -Uri "$boardUrl/api/health" -TimeoutSec 1 } catch {}
            if ($boardHealth.app -eq 'league-champion-board') { break }
        }
        if ($boardHealth.app -ne 'league-champion-board') { throw 'Champion Board did not respond. See .runtime\server-error.log in the project folder.' }
    }
    Start-Process $boardUrl
} catch {
    Add-Type -AssemblyName System.Windows.Forms
    [System.Windows.Forms.MessageBox]::Show($_.Exception.Message, 'Champion Board', 'OK', 'Error') | Out-Null
    exit 1
}
