@echo off
setlocal enabledelayedexpansion
title BSC Exclusive POMS - Full Stack Launcher

REM ============================================================
REM  BSC Exclusive POMS - ONE-CLICK FULL STACK LAUNCHER
REM  Runs the ENTIRE project:
REM    1. Detects and starts PostgreSQL service (auto-detects 14-18)
REM    2. Installs dependencies if missing
REM    3. Verifies & initializes database, schema and seed data
REM    4. Starts backend API (http://localhost:4040)
REM    5. Starts frontend UI (http://localhost:5173)
REM    6. Opens the browser automatically
REM ============================================================

cd /d "%~dp0"

echo ============================================================
echo   BSC Exclusive POMS - Starting Full Stack Application
echo ============================================================
echo.

REM ---- 0. Verify Node.js and npm ----
where node >NUL 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not found in PATH.
  echo         Please install Node.js from https://nodejs.org/
  pause
  exit /b 1
)

REM ---- 1. Detect & Ensure PostgreSQL is running ----
echo [....] Checking PostgreSQL service...
set PGSERVICE=
for %%v in (18 17 16 15 14) do (
  if not defined PGSERVICE (
    sc query postgresql-x64-%%v >NUL 2>&1
    if !errorlevel!==0 set PGSERVICE=postgresql-x64-%%v
  )
)
if not defined PGSERVICE (
  sc query postgresql >NUL 2>&1
  if !errorlevel!==0 set PGSERVICE=postgresql
)

if defined PGSERVICE (
  sc query !PGSERVICE! | findstr /i "RUNNING" >NUL 2>&1
  if not errorlevel 1 (
    echo [OK]   PostgreSQL !PGSERVICE! is running.
  ) else (
    echo [....] Starting PostgreSQL !PGSERVICE!...
    net start !PGSERVICE! >NUL 2>&1
    if not errorlevel 1 (
      echo [OK]   PostgreSQL started successfully.
    ) else (
      echo [WARN] Could not auto-start !PGSERVICE! service. Ensure PostgreSQL is running.
    )
  )
) else (
  echo [INFO] No standard local PostgreSQL service detected. Assuming external or custom DB.
)
echo.

REM ---- 2. Install dependencies on first run ----
if not exist "%~dp0backend\node_modules" (
  echo [....] Installing backend dependencies...
  pushd "%~dp0backend"
  call npm install
  popd
)
if not exist "%~dp0frontend\node_modules" (
  echo [....] Installing frontend dependencies...
  pushd "%~dp0frontend"
  call npm install
  popd
)
echo.

REM ---- 3. Auto-setup & verify database ----
echo [....] Verifying database connection, schema, and seed data...
pushd "%~dp0backend"
node scripts\setup-db.mjs
set SETUP_STATUS=%errorlevel%
popd

if not "%SETUP_STATUS%"=="0" (
  echo.
  echo [ERROR] Database setup or verification failed.
  echo         Check backend\.env configuration for DATABASE_URL.
  pause
  exit /b 1
)
echo.

REM ---- 4. Start backend API if not already active ----
set BACKEND_RUNNING=0
curl.exe -s -o NUL -f http://127.0.0.1:4040/api/health >NUL 2>&1
if not errorlevel 1 set BACKEND_RUNNING=1

if "%BACKEND_RUNNING%"=="1" (
  echo [OK]   Backend is already running on http://localhost:4040
) else (
  echo [....] Starting backend on http://localhost:4040 ...
  start "POMS Backend" /D "%~dp0backend" cmd /k npm run dev
  set /a b_tries=0
  :waitbackend
  ping -n 2 127.0.0.1 >NUL 2>&1
  curl.exe -s -o NUL -f http://127.0.0.1:4040/api/health >NUL 2>&1
  if not errorlevel 1 (
    echo [OK]   Backend is up on http://localhost:4040
  ) else (
    set /a b_tries+=1
    if !b_tries! lss 30 goto waitbackend
    echo [WARN] Backend did not respond within 30s. Check the POMS Backend window.
  )
)
echo.

REM ---- 5. Start frontend UI if not already active ----
set FRONTEND_RUNNING=0
curl.exe -s -o NUL http://localhost:5173 >NUL 2>&1
if not errorlevel 1 set FRONTEND_RUNNING=1

if "%FRONTEND_RUNNING%"=="1" (
  echo [OK]   Frontend is already running on http://localhost:5173
) else (
  echo [....] Starting frontend on http://localhost:5173 ...
  start "POMS Frontend" /D "%~dp0frontend" cmd /k npm run dev
  set /a f_tries=0
  :waitfrontend
  ping -n 2 127.0.0.1 >NUL 2>&1
  curl.exe -s -o NUL http://localhost:5173 >NUL 2>&1
  if not errorlevel 1 (
    echo [OK]   Frontend is up on http://localhost:5173
  ) else (
    set /a f_tries+=1
    if !f_tries! lss 30 goto waitfrontend
    echo [WARN] Frontend did not respond within 30s. Check the POMS Frontend window.
  )
)
echo.

REM ---- 6. Open browser ----
echo [....] Opening browser...
start "" http://localhost:5173

echo ============================================================
echo   BSC Exclusive POMS is running!
echo.
echo     Frontend : http://localhost:5173
echo     Backend  : http://localhost:4040
echo.
echo     Demo Credentials:
echo       Super Admin : admin@bsc.local / Admin@123
echo       Supervisor  : men.supervisor@bsc.local / DS@12345
echo       Buyer / PE  : buyer.dvg@bsc.local / PE@12345
echo.
echo   Keep the POMS Backend and Frontend windows open.
echo   Close them when you want to stop the application.
echo ============================================================
echo.
pause