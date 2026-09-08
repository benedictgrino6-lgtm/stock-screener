@echo off
REM Runs the data agent and logs to data\fetch.log. Called by the Windows scheduled task.
cd /d "%~dp0"
echo. >> data\fetch.log
echo ===== %DATE% %TIME% ===== >> data\fetch.log
call npm run fetch >> data\fetch.log 2>&1
