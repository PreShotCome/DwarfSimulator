@echo off
setlocal
REM ============================================================
REM  Mine ERGO (lolMiner)  -  one-click launcher
REM  Opens proxy + dashboard + miner as TABS in one Windows
REM  Terminal window. Settings come from rig-config.bat.
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

echo Stopping any other miner...
taskkill /F /IM excavator.exe >nul 2>&1
taskkill /F /IM nhqm.exe >nul 2>&1
taskkill /F /IM "NiceHash QuickMiner.exe" >nul 2>&1
taskkill /F /IM lolMiner.exe >nul 2>&1

if not exist "%LOLMINER_DIR%\lolMiner.exe" (
  echo ERROR: lolMiner.exe not found in "%LOLMINER_DIR%"
  echo Fix LOLMINER_DIR in rig-config.bat.
  pause
  exit /b
)

where wt >nul 2>&1
if errorlevel 1 goto legacy

echo Opening monitor + miner as tabs in one window...
call :wttab 4100 "Proxy" "%RIGMON%server"
call :wttab 5174 "Dashboard" "%RIGMON%dashboard"
start "" wt -w rigmon new-tab --title "lolMiner (Ergo)" -d "%LOLMINER_DIR%" cmd /k lolMiner.exe --algo AUTOLYKOS2 --pool %POOL% --user %ERGO_ADDRESS%.%WORKER% --apiport 4444
goto done

:wttab
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue){exit 0}else{exit 1}"
if errorlevel 1 (
  start "" wt -w rigmon new-tab --title "%~2" -d "%~3" cmd /k npm run dev
  timeout /t 2 >nul
) else (
  echo    %~2 already running.
)
exit /b

:legacy
echo Windows Terminal not found - opening separate windows...
call :win 4100 "rig-monitor proxy" "%RIGMON%server"
call :win 5174 "rig-monitor dashboard" "%RIGMON%dashboard"
start "lolMiner - Ergo" /D "%LOLMINER_DIR%" cmd /k lolMiner.exe --algo AUTOLYKOS2 --pool %POOL% --user %ERGO_ADDRESS%.%WORKER% --apiport 4444
goto done

:win
powershell -NoProfile -Command "if (Get-NetTCPConnection -LocalPort %~1 -State Listen -ErrorAction SilentlyContinue){exit 0}else{exit 1}"
if errorlevel 1 ( start "%~2" /D "%~3" cmd /k npm run dev ) else ( echo    %~2 already running. )
exit /b

:done
echo.
echo Mining Ergo. Dashboard: http://localhost:5174
timeout /t 4 >nul
exit /b
