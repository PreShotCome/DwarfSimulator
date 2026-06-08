@echo off
REM ============================================================
REM  Mine NICEHASH (QuickMiner / BTC)  -  one-click launcher
REM  Stops the Ergo miner, ensures the monitor stack is up,
REM  then launches NiceHash QuickMiner.
REM ============================================================

REM ============ EDIT THIS ONCE ============
REM  Find it: right-click the QuickMiner Start Menu shortcut
REM  -> Open file location -> note the .exe name/path.
set "QUICKMINER_EXE=%LOCALAPPDATA%\Programs\NiceHash QuickMiner\nhqm.exe"
REM =======================================
set "RIGMON=%~dp0"

echo == Mine NiceHash (QuickMiner / BTC) ==
echo [1/3] Stopping Ergo miner (lolMiner)...
taskkill /F /IM lolMiner.exe >nul 2>&1

echo [2/3] Ensuring monitor stack (proxy + dashboard)...
call :ensure 4100 "rig-monitor proxy" "%RIGMON%server"
call :ensure 5174 "rig-monitor dashboard" "%RIGMON%dashboard"

echo [3/3] Starting NiceHash QuickMiner...
if exist "%QUICKMINER_EXE%" (
  start "" "%QUICKMINER_EXE%"
) else (
  echo    Could not find QuickMiner at:
  echo    "%QUICKMINER_EXE%"
  echo    Edit QUICKMINER_EXE at the top of this file.
)

echo.
echo Mining via NiceHash. Dashboard: http://localhost:5174  (NiceHash profile)
timeout /t 4 >nul
exit /b

:ensure
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue) { exit 0 } else { exit 1 }"
if errorlevel 1 (
  echo    starting %~2 ...
  start "%~2" /D "%~3" cmd /k npm run dev
) else (
  echo    %~2 already running.
)
exit /b
