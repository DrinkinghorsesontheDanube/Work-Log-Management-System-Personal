' 个人工作日志系统 - 静默启动
' 双击运行即可，无任何窗口弹出
' 后台启动后端和前端服务，然后自动打开浏览器

Dim objShell, fso, projectDir
Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 获取脚本所在目录（即项目根目录）
projectDir = fso.GetParentFolderName(WScript.ScriptFullName)

' 静默执行启动批处理（0=隐藏窗口）
objShell.Run """" & projectDir & "\start-bg.bat""", 0, False

' 等几秒让服务启动完成
WScript.Sleep 8000

' 打开浏览器
objShell.Run "http://localhost:10010", 1, False

Set objShell = Nothing
Set fso = Nothing
