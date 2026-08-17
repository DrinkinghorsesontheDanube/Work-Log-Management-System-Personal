# WorkLog System - Install Script
# Right-click -> Run with PowerShell

# Check admin rights
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Requesting admin rights..." -ForegroundColor Yellow
    Start-Process powershell.exe -ArgumentList "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$frontendDir = Join-Path $PSScriptRoot "frontend"
$vbsPath = Join-Path $frontendDir "start-silent.vbs"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  WorkLog System - Install" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Create scheduled task
Write-Host "Configuring auto-start..." -ForegroundColor Yellow

$action = New-ScheduledTaskAction -Execute "wscript.exe" -Argument "`"$vbsPath`""
$trigger = New-ScheduledTaskTrigger -AtLogOn
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable

try {
    Unregister-ScheduledTask -TaskName "WorkLogSystem" -Confirm:$false -ErrorAction SilentlyContinue
    Register-ScheduledTask -TaskName "WorkLogSystem" -Action $action -Trigger $trigger -Settings $settings -Description "WorkLog System Auto Start" -RunLevel Highest -Force | Out-Null

    Write-Host ""
    Write-Host "========================================" -ForegroundColor Green
    Write-Host "  Install Success!" -ForegroundColor Green
    Write-Host "========================================" -ForegroundColor Green
    Write-Host ""
    Write-Host "Auto-start configured" -ForegroundColor White
    Write-Host ""
    $url = "http://localhost:4173"
    Write-Host "Access URL: $url" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  1. System will auto-start on Windows login" -ForegroundColor White
    Write-Host "  2. Runs silently in background" -ForegroundColor White
    Write-Host "  3. Open browser to access the URL above" -ForegroundColor White
    Write-Host ""

    $choice = Read-Host "Start now? (Y/N)"
    if ($choice -eq "Y" -or $choice -eq "y") {
        Write-Host ""
        Write-Host "Starting service..." -ForegroundColor Yellow
        Start-Process wscript.exe -ArgumentList "`"$vbsPath`""
        Start-Sleep -Seconds 2
        Write-Host "Service started, opening browser..." -ForegroundColor Green
        Start-Process $url
    }
} catch {
    Write-Host ""
    Write-Host "Install failed: $_" -ForegroundColor Red
    Write-Host "Please run as administrator" -ForegroundColor Yellow
}

Write-Host ""
Read-Host "Press Enter to exit"