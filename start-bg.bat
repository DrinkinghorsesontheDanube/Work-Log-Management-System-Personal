@echo off
title 个人工作日志系统 - 后台启动
setlocal enabledelayedexpansion

:: 自动查找 node.exe
set "node_path="
where node >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    for /f "tokens=*" %%i in ('where node') do set "node_path=%%i" & goto :found
)
for %%p in (
    "C:\Program Files\nodejs\node.exe"
    "C:\Program Files (x86)\nodejs\node.exe"
    "%USERPROFILE%\AppData\Roaming\npm\node.exe"
    "%ProgramFiles%\nodejs\node.exe"
    "%ProgramFiles(x86)%\nodejs\node.exe"
) do (
    if exist "%%~p" set "node_path=%%~p" & goto :found
)
echo [ERROR] 未找到 Node.js，请先安装 Node.js
echo 下载地址: https://nodejs.org/
pause
exit /b

:found
:: 拼接 npm 路径
for %%i in ("%node_path%") do set "node_dir=%%~dpi"
set "npm_path=%node_dir%npm.cmd"
if not exist "%npm_path%" set "npm_path=%APPDATA%\npm\npm.cmd"
if not exist "%npm_path%" set "npm_path=npm"

set "backend_dir=%~dp0backend"
set "frontend_dir=%~dp0frontend"

echo [1/3] 启动后端服务...
start /min "WorkLog-Backend" cmd /c "cd /d "%backend_dir%" && "%node_path%" server.js"

echo [2/3] 启动前端服务...
start /min "WorkLog-Frontend" cmd /c "cd /d "%frontend_dir%" && "%npm_path%" run dev"

echo [3/3] 等待服务启动...
timeout /t 6 /nobreak >nul

echo 打开浏览器...
start http://localhost:10010

echo 服务已启动！访问地址: http://localhost:10010
exit /b
