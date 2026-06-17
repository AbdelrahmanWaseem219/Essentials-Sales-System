@echo off
REM ===== Rebuild the production app (run this only after code changes) =====
cd /d "%~dp0"
echo Building the API...
call corepack pnpm --filter @essentials/api build
echo Building the Web app...
call corepack pnpm --filter @essentials/web build
echo.
echo Build complete. Now run start.bat to launch the fast version.
echo.
pause
