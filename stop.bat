@echo off
REM ===== Essentials Sales — stop everything =====
cd /d "%~dp0"

echo Stopping API and Web windows...
taskkill /FI "WINDOWTITLE eq Essentials API*" /T /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq Essentials Web*" /T /F >nul 2>&1

echo Stopping database + cache (Docker)...
docker compose stop

echo.
echo Stopped. Your data is safe (kept in Docker volumes).
echo Run start.bat to bring it back up.
echo.
pause
