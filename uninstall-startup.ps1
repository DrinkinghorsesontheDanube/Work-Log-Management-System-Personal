# 卸载开机自启 - 右键"以 PowerShell 管理员身份运行"

$taskName = "WorkLogSystem"

$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "请右键选择「以 PowerShell 管理员身份运行」！" -ForegroundColor Red
    pause
    exit
}

Write-Host "正在停止并移除开机自启..." -ForegroundColor Yellow

# 停止服务
try {
    Stop-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
} catch {}

# 删除任务
try {
    Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
    Write-Host "[✔] 开机自启已卸载" -ForegroundColor Green
} catch {
    Write-Host "[✘] 未找到自启任务" -ForegroundColor Red
}

pause
