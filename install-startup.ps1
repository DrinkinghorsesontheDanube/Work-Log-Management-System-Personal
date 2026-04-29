# 一键安装开机自启 - 右键"以 PowerShell 运行"

$projectDir = "d:\04-当前任务\99-其他\99-代码测试\Work Log Management System-Personal"
$taskName = "WorkLogSystem"
$backendCmd = "cd /d `"$projectDir\backend`" && node server.js"
$frontendCmd = "cd /d `"$projectDir\frontend`" && npm run dev"

Write-Host "=====================================" -ForegroundColor Cyan
Write-Host "  个人工作日志系统 - 开机自启安装" -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan
Write-Host ""

# 检查是否以管理员运行
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "请右键选择「以 PowerShell 管理员身份运行」！" -ForegroundColor Red
    pause
    exit
}

# 生成启动脚本
$scriptContent = @"
@echo off
title WorkLog-System

:: 启动后端
start "WorkLog-Backend" cmd /c "cd /d `"$projectDir\backend`" && node server.js"

:: 启动前端
start "WorkLog-Frontend" cmd /c "cd /d `"$projectDir\frontend`" && npm run dev"

:: 等一会后打开浏览器
timeout /t 5 /nobreak >nul
start http://localhost:10010
"@

$scriptPath = "$projectDir\startup.bat"
Set-Content -Path $scriptPath -Value $scriptContent -Force

# 用 Task Scheduler 创建开机自启任务（隐藏窗口）
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c start /min `"$scriptPath`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Priority 4

try {
    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
    Write-Host "[✔] 开机自启任务已创建！" -ForegroundColor Green

    # 启动任务测试
    Start-ScheduledTask -TaskName $taskName
    Write-Host "[✔] 服务已启动！" -ForegroundColor Green
    Write-Host ""
    Write-Host "  访问地址: http://localhost:10010" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  如需卸载开机自启，再次运行本脚本选择卸载即可。" -ForegroundColor Yellow
} catch {
    Write-Host "[✘] 创建失败: $_" -ForegroundColor Red
    pause
    exit
}

pause
