<#
.SYNOPSIS
    One-time setup for the investment portfolio app.

.DESCRIPTION
    Creates the backend virtualenv, installs Python and Node dependencies, and
    prepares local .env files. Database creation is NOT done here because it
    needs a MySQL root password: run scripts/setup-database.ps1 for that, or
    follow the README.

.EXAMPLE
    .\scripts\setup.ps1
#>

[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot

function Write-Step($message) {
    Write-Host "==> $message" -ForegroundColor Cyan
}

function Write-Ok($message) {
    Write-Host "    $message" -ForegroundColor Green
}

Write-Step 'Checking prerequisites'
foreach ($tool in @('python', 'node', 'npm')) {
    if (-not (Get-Command $tool -ErrorAction SilentlyContinue)) {
        throw "'$tool' was not found on PATH. Install it and re-run this script."
    }
}
Write-Ok 'python, node and npm are available'

# --- Backend ---------------------------------------------------------------
Write-Step 'Setting up the backend virtualenv'
$venv = Join-Path $root 'backend\.venv'
if (-not (Test-Path $venv)) {
    python -m venv $venv
    Write-Ok 'created backend\.venv'
} else {
    Write-Ok 'backend\.venv already exists'
}

$python = Join-Path $venv 'Scripts\python.exe'
Write-Step 'Installing backend dependencies'
& $python -m pip install --upgrade pip --quiet
& $python -m pip install -r (Join-Path $root 'backend\requirements.txt') --quiet
Write-Ok 'backend dependencies installed'

# --- Backend config --------------------------------------------------------
$backendEnv = Join-Path $root 'backend\.env'
if (Test-Path $backendEnv) {
    Write-Ok 'backend\.env already exists (left untouched)'
} else {
    Copy-Item (Join-Path $root 'backend\.env.example') $backendEnv
    Write-Ok 'created backend\.env from .env.example -- EDIT IT BEFORE RUNNING'
}

# --- Frontend --------------------------------------------------------------
Write-Step 'Installing frontend dependencies'
Push-Location (Join-Path $root 'frontend')
try {
    npm install --no-audit --no-fund
    Write-Ok 'frontend dependencies installed'
} finally {
    Pop-Location
}

$frontendEnv = Join-Path $root 'frontend\.env'
if (Test-Path $frontendEnv) {
    Write-Ok 'frontend\.env already exists (left untouched)'
} else {
    Copy-Item (Join-Path $root 'frontend\.env.example') $frontendEnv
    Write-Ok 'created frontend\.env from .env.example'
}

Write-Host ''
Write-Host 'Setup complete.' -ForegroundColor Green
Write-Host 'Next:' -ForegroundColor Green
Write-Host '  1. Set DB_PASSWORD and JWT_SECRET in backend\.env'
Write-Host '  2. Create the database:  .\scripts\setup-database.ps1'
Write-Host '  3. Start both services:  .\scripts\start.ps1'