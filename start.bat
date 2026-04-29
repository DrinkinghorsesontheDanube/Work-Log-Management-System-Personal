@echo off
title WorkLog System
cd /d "%~dp0"

echo ====================================
echo   Work Log Management System
echo ====================================
echo.
echo [1/2] Starting backend...
start "WorkLog-Backend" cmd /c "cd /d backend && node server.js"

echo [2/2] Starting frontend...
start "WorkLog-Frontend" cmd /c "cd /d frontend && npm run dev"

echo.
echo Waiting for services...
timeout /t 5 /nobreak >nul

echo Opening browser...
start http://localhost:10010

echo.
echo System started! Visit: http://localhost:10010
echo Close this window to stop.
echo.
pause
