# Usage: .\run.ps1 <portfolio-slug> <meta-ads command...>
# Example: .\run.ps1 akshay-paliwal status 12345
# Example: .\run.ps1 client-acme create --config configs/acme.yaml --dry-run
#
# The slug must match a file in accounts\<slug>.env

param(
    [Parameter(Mandatory)][string]$Portfolio,
    [Parameter(ValueFromRemainingArguments)][string[]]$CmdArgs
)

$envFile = Join-Path $PSScriptRoot "accounts\$Portfolio.env"

if (-not (Test-Path $envFile)) {
    Write-Host "No credentials file found: $envFile" -ForegroundColor Red
    Write-Host ""
    Write-Host "Available portfolios:" -ForegroundColor Yellow
    Get-ChildItem "$PSScriptRoot\accounts\*.env" |
        Where-Object { $_.Name -notlike '_*' } |
        ForEach-Object { Write-Host "  $($_.BaseName)" }
    exit 1
}

# Load all vars from portfolio env file
Get-Content $envFile | ForEach-Object {
    if ($_ -match '^\s*([^#][^=]+)=(.*)$') {
        [System.Environment]::SetEnvironmentVariable($matches[1].Trim(), $matches[2].Trim(), 'Process')
    }
}

Write-Host "Portfolio : $Portfolio" -ForegroundColor Cyan
Write-Host "API ver   : $env:META_API_VERSION" -ForegroundColor Cyan
Write-Host ""

meta-ads @CmdArgs
