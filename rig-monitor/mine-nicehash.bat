@echo off
setlocal
REM ============================================================
REM  Mine NICEHASH (QuickMiner / BTC)  -  one-click launcher
REM  Opens proxy + dashboard as TABS in one Windows Terminal
REM  window, then launches QuickMiner (its own GUI window).
REM  Settings come from rig-config.bat.
REM ============================================================
set "RIGMON=%~dp0"

if not exist "%RIGMON%rig-config.bat" (
  echo ERROR: rig-config.bat not found next to this launcher.
  echo Copy rig-config.example.bat to rig-config.bat and edit your paths/address.
  echo Also: run this from the rig-monitor folder itself - a Desktop COPY breaks paths^; use a shortcut instead.
  pause
  exit /b
)
call "%RIGMON%rig-config.bat"

echo Stopping Ergo miner (lolMiner)...
taskkill /F /IM lolMiner.exe >nul 2>&1

where wt >nul 2>&1
if errorlevel 1 goto legacy

echo Opening monitor as tabs in one window...
call :wttab 4100 "Proxy" "%RIGMON%server"
call :wttab 5174 "Dashboard" "%RIGMON%dashboard"
goto startminer

:legacy
echo Windows Terminal not found - opening separate windows...
call :win 4100 "rig-monitor proxy" "%RIGMON%server"
call :win 5174 "rig-monitor dashboard" "%RIGMON%dashboard"
goto startminer

:startminer
echo Starting NiceHash QuickMiner...
if exist "%QUICKMINER_EXE%" (
  start "" "%QUICKMINER_EXE%"
) else (
  echo    Could not find QuickMiner at:
  echo    "%QUICKMINER_EXE%"
  echo    Fix QUICKMINER_EXE in rig-config.bat.
)
echo.
echo Mining via NiceHash. Dashboard: http://localhost:5174
timeout /t 4 >nul
exit /b

:wttab
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue){exit 0}else{exit 1}"
if errorlevel 1 (
  start "" wt -w rigmon new-tab --title "%~2" -d "%~3" cmd /k npm run dev
  timeout /t 2 >nul
) else (
  echo    %~2 already running.
)
exit /b

:win
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue){exit 0}else{exit 1}"
if errorlevel 1 ( start "%~2" /D "%~3" cmd /k npm run dev ) else ( echo    %~2 already running. )
exit /b
