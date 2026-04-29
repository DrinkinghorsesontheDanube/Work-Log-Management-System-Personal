@echo off
title 个人工作日志系统 - 后台启动

echo [1/3] 启动后端服务...
cd /d "d:\04-当前任务\99-其他\99-代码测试\Work Log Management System-Personal\backend"
start /min "WorkLog-Backend" node server.js

echo [2/3] 启动前端服务...
cd /d "d:\04-当前任务\99-其他\99-代码测试\Work Log Management System-Personal\frontend"
start /min "WorkLog-Frontend" npm run dev

echo [3/3] 等待服务启动...
timeout /t 6 /nobreak >nul

echo 打开浏览器...
start http://localhost:10010

echo 服务已启动，本窗口可最小化或关闭。
echo 访问地址: http://localhost:10010
echo.
