' 个人工作日志系统 - 静默启动（无窗口）
' 双击运行，后台启动两个服务，无任何窗口显示

Dim objShell
Set objShell = CreateObject("WScript.Shell")

' 启动后端（隐藏窗口）
objShell.Run "cmd /c cd /d ""d:\04-当前任务\99-其他\99-代码测试\Work Log Management System-Personal\backend"" && node server.js", 0, False

' 启动前端（隐藏窗口）
objShell.Run "cmd /c cd /d ""d:\04-当前任务\99-其他\99-代码测试\Work Log Management System-Personal\frontend"" && npm run dev", 0, False

' 等几秒后打开浏览器
WScript.Sleep 6000
objShell.Run "http://localhost:10010", 1, False

Set objShell = Nothing
