@echo off
REM Local data pull + push. Called by the Windows scheduled task `stock-screener-fetch`.
REM The cloud routine `stock-screener-daily` picks up the pushed data ~40 min later and
REM does analysis + brief + email. This script must run somewhere that can reach Yahoo
REM (the cloud sandbox cannot) — i.e. this machine, while logged in.
cd /d "%~dp0"
echo. >> data\fetch.log
echo ===== %DATE% %TIME% ===== >> data\fetch.log

REM Pull first so the cloud routine's overnight commits don't block our push.
git pull --rebase --autostash >> data\fetch.log 2>&1

call npm run fetch >> data\fetch.log 2>&1
if errorlevel 1 (
  echo FETCH FAILED - not pushing >> data\fetch.log
  exit /b 1
)

git add -A >> data\fetch.log 2>&1
git commit -m "data: automated fetch %DATE%" >> data\fetch.log 2>&1
git push >> data\fetch.log 2>&1
echo push exit: %errorlevel% >> data\fetch.log
