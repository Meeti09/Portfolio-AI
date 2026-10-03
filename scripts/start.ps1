<#
.SYNOPSIS
    Runs the backend API and the frontend dev server together.

.DESCRIPTION
    Starts uvicorn on port 8000 and Vite on 5173, and shuts both down together
    on Ctrl+C so you never leave an orphaned process holding a port.

.EXAMPLE
    .\scripts\start.ps1
#>

[CmdletBinding()]
param(
    [int]$ApiPort = 8000,
    [int]$WebPort = 5173,
    [switch]$ApiOnly,
    [switch]$WebOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

$apiPython = Join-Path $root 'backend\.venv\Scripts\python.exe'
if (-not (Test-Path $apiPython)) {
    throw 'Backend virtualenv not found. Run .\scripts\setup.ps1 first.'
}
if (-not (Test-Path (Join-Path $root 'backend\.env'))) {
    throw 'backend\.env not found. Run .\scripts\setup.ps1 first.'
}

$jobs = @()

function Start-Api {
    Write-Host "==> API      http://localhost:$ApiPort" -ForegroundColor Cyan
    Push-Location (Join-Path $root 'backend')
    try {
        $script:jobs += Start-Job -Name api -ScriptBlock {
            param($dir, $port)
            Set-Location $dir
            & '.\.venv\Scripts\python.exe' -m uvicorn app.main:app --reload --port $port
        } -ArgumentList (Get-Location).Path, $ApiPort
    } finally {
        Pop-Location
    }
}

function Start-Web {
    Write-Host "==> Frontend http://localhost:$WebPort" -ForegroundColor Cyan
    Push-Location (Join-Path $root 'frontend')
    try {
        $script:jobs += Start-Job -Name web -ScriptBlock {
            param($dir, $port)
            Set-Location $dir
            & npm run dev -- --port $port
        } -ArgumentList (Get-Location).Path, $WebPort
    } finally {
        Pop-Location
    }
}

try {
    if (-not $WebOnly) { Start-Api }
    if (-not $ApiOnly) { Start-Web }

    Write-Host ''
    Write-Host 'Both services are starting. Press Ctrl+C to stop.' -ForegroundColor Green

    while ($jobs | Where-Object { $_.State -eq 'Running' }) {
        Start-Sleep -Seconds 2

        foreach ($job in $jobs) {
            if ($job.State -ne 'Running') {
                Write-Host ""
                Write-Host "$($job.Name) exited with state $($job.State)." -ForegroundColor Yellow
                Receive-Job $job
                throw "$($job.Name) stopped unexpectedly."
            }
        }
    }
} finally {
    Write-Host 'Stopping services...' -ForegroundColor Yellow
    $jobs | Stop-Job -ErrorAction SilentlyContinue
    $jobs | Remove-Job -Force -ErrorAction SilentlyContinue
}