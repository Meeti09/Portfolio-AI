<#
.SYNOPSIS
    Runs every check: backend tests, frontend types, lint, tests and build.

.EXAMPLE
    .\scripts\verify.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$failed = @()

function Invoke-Check($name, $directory, $command) {
    Write-Host ""
    Write-Host "==> $name" -ForegroundColor Cyan
    Push-Location $directory
    try {
        # Native tools (Vite, tsc, eslint) write warnings to stderr while still
        # exiting 0. With ErrorActionPreference='Stop' PowerShell turns that
        # stderr into a terminating error, so relax it here and judge success by
        # the exit code alone.
        $previous = $ErrorActionPreference
        $ErrorActionPreference = 'Continue'
        try {
            Invoke-Expression "$command 2>&1" | ForEach-Object {
                Write-Host "    $_" -ForegroundColor DarkGray
            }
        } finally {
            $ErrorActionPreference = $previous
        }

        if ($LASTEXITCODE -ne 0) {
            $script:failed += $name
            Write-Host "    FAILED: $name (exit $LASTEXITCODE)" -ForegroundColor Red
        } else {
            Write-Host "    ok: $name" -ForegroundColor Green
        }
    } catch {
        $script:failed += $name
        Write-Host "    FAILED: $name -- $($_.Exception.Message)" -ForegroundColor Red
    } finally {
        Pop-Location
    }
}

$backend = Join-Path $root 'backend'
$frontend = Join-Path $root 'frontend'

$python = '.\.venv\Scripts\python.exe'
if (-not (Test-Path (Join-Path $backend '.venv'))) {
    Write-Host 'Backend virtualenv missing. Run .\scripts\setup.ps1 first.' -ForegroundColor Red
    exit 1
}

Invoke-Check 'backend: pytest'   $backend  "$python -m pytest tests\ -q"
Invoke-Check 'frontend: tsc'     $frontend 'npx tsc --noEmit'
Invoke-Check 'frontend: lint'    $frontend 'npm run lint'
Invoke-Check 'frontend: test'    $frontend 'npm test -- --run'
Invoke-Check 'frontend: build'   $frontend 'npm run build'

Write-Host ""
if ($failed.Count -gt 0) {
    Write-Host "FAILED: $($failed -join ', ')" -ForegroundColor Red
    exit 1
}
Write-Host 'All checks passed.' -ForegroundColor Green