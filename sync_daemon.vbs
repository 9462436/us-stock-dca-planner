' 持仓同步守护进程启动器（带日志输出）

Set WshShell = CreateObject("WScript.Shell")
WshShell.CurrentDirectory = "H:\workbuddy2\us-stock-dca-planner"

' 启动 Python 进程（不弹窗口），输出重定向到日志
' 注意：用 0 (WshHide) 隐藏窗口；用 cmd.exe 包装来重定向输出
WshShell.Run "cmd.exe /c ""C:\Users\Z\.workbuddy\binaries\python\versions\3.13.12\python.exe"" ""H:\workbuddy2\us-stock-dca-planner\sync_daemon.py"" >> ""H:\workbuddy2\us-stock-dca-planner\sync_daemon.log"" 2>&1", 0, False