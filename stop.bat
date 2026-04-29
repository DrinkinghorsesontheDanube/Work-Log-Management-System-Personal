@echo off
title 关闭工作日志系统

echo 正在停止工作日志系统服务...
echo.

taskkill /f /fi "WINDOWTITLE eq WorkLog-Backend" /t >nul 2>nul
taskkill /f /fi "WINDOWTITLE eq WorkLog-Frontend" /t >nul 2>nul

echo 服务已停止，可以安全关闭窗口。
timeout /t 2 /nobreak >nul
