@echo off
rem Starts ContracTech CCTV Design and opens it in the browser. Double-click to run.
rem Runs Vite through node directly, so PowerShell's script policy (which blocks npm.ps1) does not matter.
setlocal
cd /d "%~dp0"
if exist "C:\Users\Admin\n24\node-v24.21.0-win-x64\node.exe" set "PATH=C:\Users\Admin\n24\node-v24.21.0-win-x64;%PATH%"
where node >/dev/null 2>nul
if errorlevel 1 (
  echo Node.js was not found. Install it from https://nodejs.org and try again.
  pause
  exit /b 1
)
netstat -ano | findstr /r /c:":5173 .*LISTENING" >nul
if not errorlevel 1 (
  echo The app already seems to be running. Open http://localhost:5173 in your browser.
  pause
  exit /b 0
)
echo Starting ContracTech CCTV Design at http://localhost:5173 ...
echo Keep this window open while you use the app. Close it, or press Ctrl+C, to stop.
node node_modules\vite\bin\vite.js --port 5173 --strictPort --open
if errorlevel 1 pause
