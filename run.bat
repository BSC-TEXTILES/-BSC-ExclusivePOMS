@echo off
setlocal enabledelayedexpansion
title BSC Exclusive POMS - Full Stack Launcher

REM ============================================================
REM  BSC Exclusive POMS - ONE-CLICK FULL STACK LAUNCHER
REM  Runs the ENTIRE project:
REM    1. Verifies Node.js and npm
REM    2. Detects and starts PostgreSQL service
REM    3. Installs dependencies if missing (backend & frontend)
REM    4. Verifies & initializes database, schema and seed data
REM    5. Starts backend API (http://localhost:4040)
REM    6. Starts frontend UI (http://localhost:5173)
REM    7. Opens the browser automatically
REM ============================================================

cd /d "%~dp0"

echo.
echo ============================================================
echo   BSC Exclusive POMS - Starting Full Stack Application
echo ============================================================
echo.

REM ---- 0. Verify Node.js and npm ----
where node >NUL 2>&1
if errorlevel 1 (
  echo [ERROR] Node.js is not found in PATH.
  echo         Please install Node.js from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('node -v') do set NODE_VER=%%v
echo [OK]   Node.js !NODE_VER! detected.

where npm >NUL 2>&1
if errorlevel 1 (
  echo [ERROR] npm is not found in PATH.
  echo         Please install Node.js/npm from https://nodejs.org/
  echo.
  pause
  exit /b 1
)

for /f "tokens=*" %%v in ('npm -v') do set NPM_VER=%%v
echo [OK]   npm v!NPM_VER! detected.
echo.

REM ---- 1. Detect & Ensure PostgreSQL is running ----
echo [....] Checking PostgreSQL service...
set PGSERVICE=
for %%v in (18 17 16 15 14 13 12) do (
  if not defined PGSERVICE (
    sc.exe query postgresql-x64-%%v >NUL 2>&1
    if !errorlevel!==0 set PGSERVICE=postgresql-x64-%%v
  )
  if not defined PGSERVICE (
    sc.exe query postgresql-%%v >NUL 2>&1
    if !errorlevel!==0 set PGSERVICE=postgresql-%%v
  )
)
if not defined PGSERVICE (
  sc.exe query postgresql >NUL 2>&1
  if !errorlevel!==0 set PGSERVICE=postgresql
)

if defined PGSERVICE (
  sc.exe query !PGSERVICE! | findstr /i "RUNNING" >NUL 2>&1
  if not errorlevel 1 (
    echo [OK]   PostgreSQL !PGSERVICE! is running.
  ) else (
    echo [....] Starting PostgreSQL !PGSERVICE!...
    net start !PGSERVICE! >NUL 2>&1
    if not errorlevel 1 (
      echo [OK]   PostgreSQL started successfully.
    ) else (
      echo [WARN] Could not auto-start !PGSERVICE!.
      echo         Please ensure PostgreSQL is running manually.
    )
  )
) else (
  echo [INFO] No standard local PostgreSQL service detected.
  echo         Assuming external, container, or custom DB config.
)
echo.

REM ---- 2. Install dependencies if missing ----
if not exist "%~dp0backend\node_modules\" (
  echo [....] Backend dependencies not found. Installing...
  pushd "%~dp0backend"
  call npm install
  popd
  if errorlevel 1 (
    echo [ERROR] Failed to install backend dependencies.
    echo.
    pause
    exit /b 1
  )
  echo [OK]   Backend dependencies installed.
  echo.
) else (
  echo [OK]   Backend dependencies found.
)

if not exist "%~dp0frontend\node_modules\" (
  echo [....] Frontend dependencies not found. Installing...
  pushd "%~dp0frontend"
  call npm install
  popd
  if errorlevel 1 (
    echo [ERROR] Failed to install frontend dependencies.
    echo.
    pause
    exit /b 1
  )
  echo [OK]   Frontend dependencies installed.
  echo.
) else (
  echo [OK]   Frontend dependencies found.
)
echo.

REM ---- 3. Kill stale node processes on project ports ----
echo [....] Checking for stale processes on ports 4040 and 5173...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4040 " ^| findstr "LISTENING" 2^>NUL') do (
  echo [....] Killing stale backend process PID %%p on port 4040...
  taskkill /PID %%p /F >NUL 2>&1
  if not errorlevel 1 echo [OK]   Killed stale backend process [PID %%p]
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>NUL') do (
  echo [....] Killing stale frontend process PID %%p on port 5173...
  taskkill /PID %%p /F >NUL 2>&1
  if not errorlevel 1 echo [OK]   Killed stale frontend process [PID %%p]
)
echo [OK]   Ports 4040 and 5173 are clear.
ping -n 2 127.0.0.1 >NUL 2>&1
echo.

REM ---- 4. Auto-setup & verify database ----
echo [....] Verifying database connection, schema, and seed data...
pushd "%~dp0backend"
node scripts\setup-db.mjs
set SETUP_STATUS=!errorlevel!
popd

if not "!SETUP_STATUS!"=="0" (
  echo.
  echo ============================================================
  echo   [ERROR] Database setup failed!
  echo.
  echo   Possible causes:
  echo     - PostgreSQL is not running
  echo     - DATABASE_URL in backend\.env is incorrect
  echo     - Database user/password mismatch
  echo.
  echo   Current config: backend\.env
  echo     DATABASE_URL=postgresql://postgres@localhost:5432/poms
  echo.
  echo   Fix the above and try again.
  echo ============================================================
  echo.
  pause
  exit /b 1
)
echo.

REM ---- 5. Start backend API ----
echo [....] Starting backend API on http://localhost:4040...
start "POMS Backend" /D "%~dp0backend" cmd /k "title POMS Backend [port 4040] && npm run dev"

REM Wait for backend to be ready
set /a b_tries=0
:waitbackend
ping -n 2 127.0.0.1 >NUL 2>&1
set /a b_tries+=1
curl -s -o NUL -w "%%{http_code}" http://127.0.0.1:4040/api/health 2>NUL | findstr "200" >NUL 2>&1
if not errorlevel 1 (
  echo [OK]   Backend is up on http://localhost:4040
  goto backend_done
)
if !b_tries! lss 30 goto waitbackend
echo [WARN] Backend did not respond within 30s.
echo         Check the "POMS Backend" window for errors.
echo         Proceeding anyway...
:backend_done
echo.

REM ---- 6. Start frontend UI ----
echo [....] Starting frontend UI on http://localhost:5173...
start "POMS Frontend" /D "%~dp0frontend" cmd /k "title POMS Frontend [port 5173] && npm run dev"

REM Wait for frontend to be ready
set /a f_tries=0
:waitfrontend
ping -n 2 127.0.0.1 >NUL 2>&1
set /a f_tries+=1
curl -s -o NUL http://localhost:5173 >NUL 2>&1
if not errorlevel 1 (
  echo [OK]   Frontend is up on http://localhost:5173
  goto frontend_done
)
if !f_tries! lss 30 goto waitfrontend
echo [WARN] Frontend did not respond within 30s.
echo         Check the "POMS Frontend" window for errors.
:frontend_done
echo.

REM ---- 7. Open browser ----
echo [....] Opening browser...
timeout /t 2 /nobreak >NUL
start "" http://localhost:5173

echo.
echo ============================================================
echo.
echo   BSC Exclusive POMS is running!
echo.
echo     Frontend : http://localhost:5173
echo     Backend  : http://localhost:4040
echo     Database : PostgreSQL (localhost:5432/poms)
echo.
echo   Demo Credentials:
echo     Super Admin : admin@bsc.local / Admin@123
echo     Supervisor  : men.supervisor@bsc.local / DS@12345
echo     Buyer / PE  : buyer.dvg@bsc.local / PE@12345
echo.
echo   Keep the POMS Backend and Frontend windows open.
echo   Close them when you want to stop the application.
echo.
echo ============================================================
echo.
pause
