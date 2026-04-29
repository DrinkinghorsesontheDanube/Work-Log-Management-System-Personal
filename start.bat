@echo off
title 个人工作日志系统

echo ====================================
echo    个人工作日志管理系统 启动中...
echo ====================================
echo.

cd /d "%~dp0"

echo [1/3] 启动后端服务...
start "WorkLog-Backend" cmd /c "cd /d backend && node server.js"

echo [2/3] 启动前端服务...
start "WorkLog-Frontend" cmd /c "cd /d frontend && npm run dev"

timeout /t 3 /nobreak >nul

echo [3/3] 打开浏览器...
start http://localhost:10010

echo.
echo ====================================
echo    系统已启动！
echo    访问地址：http://localhost:10010
echo.
echo    关闭终端即停止服务
echo ====================================
echo.
pause
