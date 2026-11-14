@echo off
setlocal
cd /d "%~dp0"
where py >nul 2>nul || (echo Install Python and enable its launcher. & pause & exit /b 1)
where npm >nul 2>nul || (echo Install Node.js first. & pause & exit /b 1)
if not exist "server\venv\Scripts\python.exe" py -m venv server\venv
if errorlevel 1 (echo Could not create Python environment. & pause & exit /b 1)
"server\venv\Scripts\python.exe" -m pip install -r server\requirements.txt
if errorlevel 1 (echo Backend dependency installation failed. & pause & exit /b 1)
pushd client
call npm ci --no-audit --no-fund
if errorlevel 1 (popd & echo Frontend dependency installation failed. & pause & exit /b 1)
popd
start "PalmPay API" /D "%~dp0server" cmd /k venv\Scripts\python.exe app.py
start "PalmPay UI" /D "%~dp0client" cmd /k npm run dev
echo Wait a few seconds, then open http://localhost:5173 . Close both windows to stop the demo.
pause
