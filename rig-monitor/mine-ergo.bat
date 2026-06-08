@echo off
REM ============================================================
REM  Mine ERGO (lolMiner)  -  one-click launcher
REM  Stops any other miner, ensures the monitor stack is up,
REM  then starts lolMiner on Ergo.
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

echo == Mine Ergo (lolMiner) ==
echo [1/3] Stopping any other miner...
taskkill /F /IM excavator.exe >nul 2>&1
taskkill /F /IM nhqm.exe >nul 2>&1
taskkill /F /IM "NiceHash QuickMiner.exe" >nul 2>&1
taskkill /F /IM lolMiner.exe >nul 2>&1

echo [2/3] Ensuring monitor stack (proxy + dashboard)...
call :ensure 4100 "rig-monitor proxy" "%RIGMON%server"
call :ensure 5174 "rig-monitor dashboard" "%RIGMON%dashboard"

echo [3/3] Starting lolMiner on Ergo...
if not exist "%LOLMINER_DIR%\lolMiner.exe" (
  echo    ERROR: lolMiner.exe not found in "%LOLMINER_DIR%"
  echo    Fix LOLMINER_DIR in rig-config.bat.
  pause
  exit /b
)
start "lolMiner - Ergo" /D "%LOLMINER_DIR%" cmd /k lolMiner.exe --algo AUTOLYKOS2 --pool %POOL% --user %ERGO_ADDRESS%.%WORKER% --apiport 4444

echo.
echo Mining Ergo. Dashboard: http://localhost:5174  (Ergo or Rig-live profile)
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
