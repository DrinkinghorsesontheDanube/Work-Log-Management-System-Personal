# WorkLog System - Uninstall Script
# Right-click -> Run with PowerShell

# Check admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting admin rights..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WorkLog System - Uninstall" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Stop running service
Write-Host "Stopping service..." -ForegroundColor Yellow
Get-Process node -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -match "serve.js" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Delete scheduled task
Write-Host "Removing auto-start..." -ForegroundColor Yellow

try {
    Unregister-ScheduledTask -TaskName "WorkLogSystem" -Confirm:$false -ErrorAction Stop
    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Uninstall Success!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Auto-start removed" -ForegroundColor White
    Write-Host "Service stopped" -ForegroundColor White
} catch {
    Write-Host ""
    Write-Host "Done (may not have been installed)" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"