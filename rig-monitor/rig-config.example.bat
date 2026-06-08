@echo off
REM ============================================================
REM  Local rig config for the miner launchers.
REM
REM  COPY this file to "rig-config.bat" (same folder) and edit
REM  the values below. rig-config.bat is gitignored, so your
REM  paths + wallet survive every "git pull" with no conflicts.
REM ============================================================

REM --- Ergo (lolMiner) ---
set "LOLMINER_DIR=E:\lolMiner\lolMiner_v1.98_Win64\1.98"
set "ERGO_ADDRESS=PASTE_YOUR_9_ADDRESS_HERE"
set "WORKER=rig3060"
set "POOL=ergo.herominers.com:1180"

REM --- NiceHash (QuickMiner) ---
REM  Find it: right-click the QuickMiner Start Menu shortcut
REM  -> Open file location -> note the .exe name/path.
set "QUICKMINER_EXE=%LOCALAPPDATA%\Programs\NiceHash QuickMiner\nhqm.exe"
