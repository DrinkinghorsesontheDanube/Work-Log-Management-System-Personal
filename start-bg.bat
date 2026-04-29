@echo off
title WorkLog-System
setlocal enabledelayedexpansion

:: ===== Auto-detect node.exe =====
set "node_path="

:: Method 1: PATH
for /f "delims=" %%i in ('where node 2^>nul') do set "node_path=%%i" & goto :found

:: Method 2: Common paths
for %%p in (
    "C:\Program Files\nodejs\node.exe"
    "C:\Program Files (x86)\nodejs\node.exe"
    "%ProgramFiles%\nodejs\node.exe"
    "%ProgramFiles(x86)%\nodejs\node.exe"
) do (
    if exist "%%~p" set "node_path=%%~p" & goto :found
)

:: Method 3: Registry
for /f "skip=2 tokens=2*" %%a in ('reg query "HKLM\SOFTWARE\Node.js" /v InstallPath 2^>nul') do (
    if exist "%%b\node.exe" set "node_path=%%b\node.exe" & goto :found
)
for /f "skip=2 tokens=2*" %%a in ('reg query "HKCU\SOFTWARE\Node.js" /v InstallPath 2^>nul') do (
    if exist "%%b\node.exe" set "node_path=%%b\node.exe" & goto :found
)

echo [ERROR] Node.js not found. Please install from https://nodejs.org/
pause
exit /b 1

:found
for %%i in ("%node_path%") do set "node_dir=%%~dpi"
set "npm_cmd=%node_dir%npm.cmd"
if not exist "%npm_cmd%" set "npm_cmd=%APPDATA%\npm\npm.cmd"
if not exist "%npm_cmd%" set "npm_cmd=npm"

set "script_dir=%~dp0"
set "backend_dir=%script_dir%backend"
set "frontend_dir=%script_dir%frontend"

echo [1/3] Starting backend...
start /min "WorkLog-Backend" "%node_path%" "%backend_dir%\server.js"

echo [2/3] Starting frontend...
start /min "WorkLog-Frontend" cmd /c "cd /d "%frontend_dir%" && "%npm_cmd%" run dev"

echo [3/3] Waiting for services...
timeout /t 6 /nobreak >nul

echo Opening browser...
start http://localhost:10010

echo All services started! Visit: http://localhost:10010
exit /b 0
