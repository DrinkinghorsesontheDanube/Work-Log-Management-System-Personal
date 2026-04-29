# 一键安装开机自启 - 右键"以 PowerShell 管理员身份运行"

$projectDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$taskName = "WorkLogSystem"
$startupBat = "$projectDir\start-bg.bat"

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

# 用 Task Scheduler 创建开机自启任务
# 使用 start-bg.bat（已内置自动查找 node 路径，稳定可靠）
$action = New-ScheduledTaskAction -Execute "cmd.exe" -Argument "/c start /min `"$startupBat`""
$trigger = New-ScheduledTaskTrigger -AtStartup
$principal = New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -StartWhenAvailable -Priority 4

try {
    # 清理旧任务
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false -ErrorAction SilentlyContinue

    Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $trigger -Principal $principal -Settings $settings -Force
    Write-Host "[✔] 开机自启任务已创建！" -ForegroundColor Green
    Write-Host ""
    Write-Host "  下次开机将自动启动服务" -ForegroundColor Cyan
    Write-Host "  访问地址: http://localhost:10010" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "  手动启动: 双击 start-silent.vbs（无窗口）" -ForegroundColor Yellow
    Write-Host "  手动启动: 双击 start-bg.bat（有窗口）" -ForegroundColor Yellow
    Write-Host "  卸载自启: 右键 uninstall-startup.ps1 → 以 PowerShell 运行" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "  现在启动服务? (Y/N)" -ForegroundColor Green
    $startNow = Read-Host
    if ($startNow -eq "Y" -or $startNow -eq "y") {
        Start-Process -FilePath "wscript.exe" -ArgumentList "`"$projectDir\start-silent.vbs`"" -WindowStyle Hidden
        Write-Host "[✔] 服务已在后台启动..." -ForegroundColor Green
    }
} catch {
    Write-Host "[✘] 创建失败: $_" -ForegroundColor Red
    pause
    exit
}

pause
