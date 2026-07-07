$WshShell = New-Object -comObject WScript.Shell
$ShortcutPath = "c:\Users\ayoub\Desktop\La Quincailler.lnk"
$Shortcut = $WshShell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "c:\Users\ayoub\Desktop\laQuincailler\start_app.bat"
$Shortcut.WorkingDirectory = "c:\Users\ayoub\Desktop\laQuincailler"
$Shortcut.Save()
Write-Output "Shortcut created successfully"
