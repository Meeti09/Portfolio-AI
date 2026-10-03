<#
.SYNOPSIS
    Creates the database, app user, schema and seed data.

.DESCRIPTION
    Needs a MySQL root password. Every statement runs in a single session so the
    @app_password variable set for 00_bootstrap.sql survives into the script
    that creates the user.

    WARNING: 00_bootstrap.sql DROPs the investment_engine database, so this
    destroys all existing data in it.

.PARAMETER AppPassword
    Password for the least-privilege 'inv_app' user. Must match DB_PASSWORD in
    backend\.env. Prompted for if omitted.

.PARAMETER DbRootUser
    MySQL administrative account. Defaults to root. On Aiven this is avnadmin.

.PARAMETER DbAppHost
    Host part of the 'inv_app' user. Keep 'localhost' for local MySQL; use '%'
    for a hosted database reached over the network (e.g. Aiven).

.EXAMPLE
    .\scripts\setup-database.ps1
.EXAMPLE
    .\scripts\setup-database.ps1 -MysqlHost <aiven-host> -MysqlPort 21399 -DbRootUser avnadmin -DbAppHost '%'
#>

[CmdletBinding()]
param(
    [string]$AppPassword,
    [string]$DbRootUser = 'root',
    [string]$DbAppHost = 'localhost',
    [string]$MysqlHost = 'localhost',
    [int]$MysqlPort = 3306
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$sqlDir = Join-Path $root 'backend\sql'

if (-not (Get-Command mysql -ErrorAction SilentlyContinue)) {
    throw 'The mysql client was not found on PATH.'
}

if (-not $AppPassword) {
    $secure = Read-Host -AsSecureString 'Password for the inv_app MySQL user'
    $AppPassword = [System.Net.NetworkCredential]::new('', $secure).Password
}
if ([string]::IsNullOrWhiteSpace($AppPassword)) {
    throw 'The app user password cannot be empty.'
}

$backendEnv = Join-Path $root 'backend\.env'
$isLocal = $MysqlHost -eq 'localhost' -or $MysqlHost -eq '127.0.0.1'
if ($isLocal -and (Test-Path $backendEnv)) {
    $configured = Get-Content $backendEnv |
        Where-Object { $_ -match '^DB_PASSWORD=' } |
        Select-Object -First 1
    if ($configured) {
        $fromEnv = ($configured -split '=', 2)[1].Trim()
        if ($fromEnv -and $fromEnv -ne $AppPassword) {
            Write-Warning 'The password you entered differs from DB_PASSWORD in backend\.env. Update that file or the API will fail to connect.'
        }
    }
} elseif (-not $isLocal) {
    Write-Warning 'Remote database: set DB_PASSWORD on Render to the password you just entered.'
}

$ordered = @('00_bootstrap.sql', '01_schema.sql', '02_seed.sql', '03_views.sql')
foreach ($file in $ordered) {
    $path = Join-Path $sqlDir $file
    if (-not (Test-Path $path)) {
        throw "Missing SQL file: $path"
    }
}

# Quote the session values for the SET statement, doubling single quotes.
$escapedPassword = $AppPassword.Replace("'", "''")
$escapedHost = $DbAppHost.Replace("'", "''")

Write-Host '==> Applying SQL (00_bootstrap -> 03_views)' -ForegroundColor Cyan
foreach ($file in $ordered) {
    $path = Join-Path $sqlDir $file
    Write-Host "    $file" -ForegroundColor DarkGray

    # Only 00_bootstrap needs the session variables; the rest are plain scripts.
    if ($file -eq '00_bootstrap.sql') {
        $command = "SET @app_password='$escapedPassword'; SET @app_user_host='$escapedHost'; SOURCE $($path -replace '\\','/');"
    } else {
        $command = "SOURCE $($path -replace '\\','/');"
    }

    & mysql "-h$MysqlHost" "-P$MysqlPort" "-u$DbRootUser" '-p' '-e' $command
    if ($LASTEXITCODE -ne 0) {
        throw "$file failed to apply."
    }
}

Write-Host ''
Write-Host 'Database ready.' -ForegroundColor Green
Write-Host 'Verify with the backend suite:' -ForegroundColor Green
Write-Host '  cd backend; .\.venv\Scripts\python.exe -m pytest tests\ -q'