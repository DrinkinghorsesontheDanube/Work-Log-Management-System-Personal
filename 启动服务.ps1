# WorkLog System - Start Service
$vbsPath = Join-Path $PSScriptRoot "frontend\start-silent.vbs"

Write-Host "Starting WorkLog System..." -ForegroundColor Yellow
Start-Process wscript.exe -ArgumentList "`"$vbsPath`""
Start-Sleep -Seconds 2

Write-Host "Service started" -ForegroundColor Green
$url = "http://localhost:4173"
Write-Host "Access URL: $url" -ForegroundColor Cyan
Start-Process $url