@echo off
REM ============================================================
REM  Mine NICEHASH (QuickMiner / BTC)  -  one-click launcher
REM  Stops the Ergo miner, ensures the monitor stack is up,
REM  then launches NiceHash QuickMiner.
REM  Settings are loaded from rig-config.bat (gitignored).
REM ============================================================
set "RIGMON=%~dp0"

if not exist "%RIGMON%rig-config.bat" (
  echo ERROR: rig-config.bat not found.
  echo Copy rig-config.example.bat to rig-config.bat and edit your paths/address.
  pause
  exit /b
)
call "%RIGMON%rig-config.bat"

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
  echo    Fix QUICKMINER_EXE in rig-config.bat.
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
