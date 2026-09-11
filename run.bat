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

REM ---- 1b. Kill stale node processes on project ports -----------
echo [....] Checking for stale processes on ports 4040 and 5173...
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":4040 " ^| findstr "LISTENING" 2^>NUL') do (
  taskkill /PID %%p /F >NUL 2>&1
  if not errorlevel 1 echo [OK]   Killed stale backend process on port 4040 (PID %%p).
)
for /f "tokens=5" %%p in ('netstat -ano ^| findstr ":5173 " ^| findstr "LISTENING" 2^>NUL') do (
  taskkill /PID %%p /F >NUL 2>&1
  if not errorlevel 1 echo [OK]   Killed stale frontend process on port 5173 (PID %%p).
)
timeout /t 1 /nobreak >NUL
echo.

REM ---- 2. Ensure PostgreSQL is running ------------------------
set "PGSVC="
for /f "tokens=2 delims=: " %%a in ('sc query type^= service state^= all ^| findstr /i "SERVICE_NAME:.*postgres"') do if not defined PGSVC set "PGSVC=%%a"

if defined PGSVC (
  sc query "!PGSVC!" | findstr /i "RUNNING" >NUL
  if not errorlevel 1 (
    echo [OK]   PostgreSQL service "!PGSVC!" is running.
  ) else (
    echo [....] Starting PostgreSQL service "!PGSVC!" ...
    net start "!PGSVC!" >NUL 2>&1
    if not errorlevel 1 ( echo [OK]   PostgreSQL started. ) else ( echo [WARN] Could not start "!PGSVC!" - database steps may fail. )
  )
) else (
  echo [INFO] No local PostgreSQL service found - assuming a remote/Supabase database.
)
echo.

REM ---- 3. Locate psql and detect local vs remote database -----
set "PGBIN="
for %%V in (18 17 16 15 14 13 12) do (
  if not defined PGBIN if exist "C:\Program Files\PostgreSQL\%%V\bin\psql.exe" set "PGBIN=C:\Program Files\PostgreSQL\%%V\bin"
)

if defined PGBIN (
  set "PATH=!PGBIN!;%PATH%"
  set "PSQL=!PGBIN!\psql.exe"
) else (
  set "PSQL="
  where psql >NUL 2>&1
  if not errorlevel 1 set "PSQL=psql"
)

set "DATABASE_URL="
if exist "%~dp0backend\.env" (
  for /f "usebackq tokens=1,* delims==" %%a in ("%~dp0backend\.env") do if "%%a"=="DATABASE_URL" set "DATABASE_URL=%%b"
)

set "ISLOCAL=1"
if defined DATABASE_URL (
  if "!DATABASE_URL:localhost=!"=="!DATABASE_URL!" if "!DATABASE_URL:127.0.0.1=!"=="!DATABASE_URL!" set "ISLOCAL=0"
)

REM ---- 4. Database: create schema + seed data (idempotent) ----
if "!ISLOCAL!"=="1" if defined PSQL goto localdb

REM Remote DB (or psql unavailable) - verify connectivity + ensure seed
echo [....] Verifying database connectivity (remote/Supabase)...
pushd "%~dp0backend"
node scripts\check-db.mjs
set DBOK=!errorlevel!
popd
if not "!DBOK!"=="0" (
  echo.
  echo [ERROR] Database not reachable.
  echo   - Remote/Supabase: run database\complete_schema.sql in the Supabase SQL
  echo     editor, then set DATABASE_URL (and Supabase keys) in backend\.env.
  echo   - Local without psql: install PostgreSQL or add psql to PATH, then re-run.
  echo.
  pause
  exit /b 1
)
pushd "%~dp0backend"
call node scripts\ensure-seed.mjs
popd
goto dbdone

:localdb
echo [....] Ensuring local database "poms" (schema + seed data)...
createdb -h localhost -p 5432 -U postgres poms 2>NUL
"!PSQL!" -h localhost -p 5432 -U postgres -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\complete_schema.sql"
if errorlevel 1 (
  echo.
  echo [ERROR] Applying the database schema failed.
  echo         Common cause: PostgreSQL password required. Set it in backend\.env:
  echo         DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/poms
  echo.
  pause
  exit /b 1
)
echo [OK]   Schema applied (complete_schema.sql - idempotent).
pushd "%~dp0backend"
call node scripts\ensure-seed.mjs
set SEEDOK=!errorlevel!
popd
if not "!SEEDOK!"=="0" ( echo [WARN] Seed step reported an issue - see messages above. )
:dbdone

echo.

REM ---- 5. Install dependencies on first run -------------------
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
