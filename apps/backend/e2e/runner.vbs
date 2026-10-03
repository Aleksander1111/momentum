' Opens the Momentum test runner without a terminal window: what the "Momentum tests" shortcut starts
Set fso = CreateObject("Scripting.FileSystemObject")
backend = fso.GetParentFolderName(fso.GetParentFolderName(WScript.ScriptFullName))
repo = fso.GetParentFolderName(fso.GetParentFolderName(backend))
Set sh = CreateObject("WScript.Shell")
sh.CurrentDirectory = backend
sh.Run "node """ & repo & "\node_modules\tsx\dist\cli.mjs"" e2e\runner.ts", 0, False
