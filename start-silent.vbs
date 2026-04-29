' WorkLog Silent Launcher - Double-click to start
' Uses absolute paths so it always works regardless of environment

Dim objShell, fso, projDir, backend, frontend
Set objShell = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' Get project directory from script location
projDir = fso.GetParentFolderName(WScript.ScriptFullName)
backend = projDir & "\backend\server.js"
frontend = projDir & "\frontend"

' Node.js locations to try (most likely first)
Dim nodePaths, nodePath, npmPath, i
nodePaths = Array( _
    "C:\Program Files\nodejs\node.exe", _
    "C:\Program Files (x86)\nodejs\node.exe", _
    "node" _
)

nodePath = ""
For i = 0 To UBound(nodePaths)
    If fso.FileExists(nodePaths(i)) Then
        nodePath = nodePaths(i)
        Exit For
    End If
Next

If nodePath = "" Then
    ' Try to find via where command
    Dim ws, exec
    Set ws = CreateObject("WScript.Shell")
    On Error Resume Next
    Set exec = ws.Exec("%comspec% /c where node")
    If Err.Number = 0 Then
        nodePath = exec.StdOut.ReadLine()
        If nodePath = "" Then nodePath = "node"
    Else
        nodePath = "node"
    End If
    On Error GoTo 0
End If

' Get npm path
Dim nodeDir, npmCmd
nodeDir = fso.GetParentFolderName(nodePath)
npmCmd = nodeDir & "\npm.cmd"
If Not fso.FileExists(npmCmd) Then npmCmd = "npm"

' Start backend (hidden window, 0 = hidden)
objShell.Run """" & nodePath & """ """ & backend & """", 0, False

' Wait 2 seconds
WScript.Sleep 2000

' Start frontend (hidden window)
objShell.Run "%comspec% /c cd /d """ & frontend & """ && " & npmCmd & " run dev", 0, False

' Wait 8 seconds for services to start
WScript.Sleep 8000

' Open browser
objShell.Run "http://localhost:10010", 1, False
