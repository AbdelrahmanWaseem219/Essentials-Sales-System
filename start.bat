@echo off
REM ===== Essentials Sales — start the FAST (production) build locally =====
cd /d "%~dp0"

echo.
echo [1/3] Starting database + cache (Docker)...
docker compose up -d
if errorlevel 1 (
  echo.
  echo ERROR: Docker isn't running. Open "Docker Desktop", wait for "Engine running", then run this again.
  pause
  exit /b 1
)

echo [2/3] Starting the API server (new window)...
start "Essentials API" /D "%~dp0" cmd /k "corepack pnpm --filter @essentials/api start:prod"

echo [3/3] Starting the Web app (new window)...
start "Essentials Web" /D "%~dp0" cmd /k "corepack pnpm --filter @essentials/web start"

echo.
echo Waiting for the app to come up...
timeout /t 10 /nobreak >nul
start "" http://localhost:3000

echo.
echo ============================================================
echo  Essentials Sales is running (fast production mode):
echo    Dashboard : http://localhost:3000
echo    API docs  : http://localhost:4000/docs
echo.
echo  Keep the two "Essentials API" / "Essentials Web" windows open
echo  while you use the system. Run stop.bat to shut everything down.
echo.
echo  (If you ever change the code, run build.bat first, then start.bat.)
echo ============================================================
echo.
pause
