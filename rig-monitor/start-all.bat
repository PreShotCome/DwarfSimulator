@echo off
REM ── rig-monitor one-click launcher ────────────────────────────────────
REM Starts the NiceHash proxy and the dashboard, each in its own window.
REM Double-click this after a reboot instead of typing the commands.
REM (Your miner — lolMiner — is launched separately from its own folder.)

start "rig-monitor proxy"     cmd /k "cd /d %~dp0server && npm run dev"
start "rig-monitor dashboard" cmd /k "cd /d %~dp0dashboard && npm run dev"

echo Launched proxy (http://localhost:4100) and dashboard (http://localhost:5174).
echo Monitor from your phone at http://<this-PC-IP>:5174
