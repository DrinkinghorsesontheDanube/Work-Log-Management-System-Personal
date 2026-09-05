Set WshShell = CreateObject("WScript.Shell")
Set Fso = CreateObject("Scripting.FileSystemObject")
' 工作目录切到项目根目录（server/ 的上一级），DATA_DIR 默认在根目录 data/
WshShell.CurrentDirectory = Fso.GetParentFolderName(Fso.GetParentFolderName(WScript.ScriptFullName))
WshShell.Run "node server\server.js", 0, False
