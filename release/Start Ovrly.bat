@echo off
rem Double-click launcher (Windows): runs the bundled Node on the server and opens the UI.
cd /d "%~dp0"
set NODE_ENV=production
start "" cmd /c "timeout /t 2 >nul & start http://localhost:6875"
node\node.exe server\index.js
pause
