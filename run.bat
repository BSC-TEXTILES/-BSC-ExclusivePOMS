@echo off
setlocal enabledelayedexpansion
title BSC Exclusive POMS - Full Project Launcher

REM ============================================================
REM  BSC Exclusive POMS - ONE-CLICK FULL PROJECT LAUNCHER (v2.0)
REM  Starts EVERYTHING in one command:
REM    1. Database : PostgreSQL (auto-start service, create schema, seed data)
REM    2. Backend  : http://localhost:4040  (Express API + WebSockets)
REM    3. Frontend : http://localhost:5173  (Vite dev server, auto-opens browser)
REM  Login: admin@bsc.local / Admin@123
REM ============================================================

cd /d "%~dp0"

echo ============================================================
echo   BSC Exclusive POMS - Full Project Launcher
echo   Database + Backend + Frontend
echo ============================================================
echo.

REM ---- 1. Ensure backend\.env exists --------------------------
if not exist "%~dp0backend\.env" (
  if exist "%~dp0backend\.env.example" (
    echo [....] No backend\.env found - creating from template...
    copy /y "%~dp0backend\.env.example" "%~dp0backend\.env" >NUL
    echo [OK]   backend\.env created (local PostgreSQL defaults).
  ) else (
    echo [WARN] backend\.env missing and no template - using built-in defaults.
  )
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
REM ---- 5b. Backup npm packages needed by the import feature -------------
REM The import routes use 'xlsx' (CSV/Excel) and 'pdf-parse' (PDF) for
REM automatic data extraction. Install them on first run if missing.
if not exist "%~dp0backend\node_modules\xlsx" (
  echo [....] Installing import dependencies (xlsx, pdf-parse)...
  pushd "%~dp0backend"
  call npm install xlsx pdf-parse --save
  popd
)
echo.

REM ---- 6. Start the backend API (own window) ------------------
start "POMS Backend" /D "%~dp0backend" cmd /k npm run dev
echo [....] Waiting for backend on http://localhost:4040 ...
set /a tries=0
:waitbackend
timeout /t 2 /nobreak >NUL
curl -s -o NUL http://localhost:4040/api/health
if not errorlevel 1 goto backendup
set /a tries+=1
if !tries! lss 20 goto waitbackend
echo [ERROR] Backend did not answer within 40s. Check the "POMS Backend" window.
pause
exit /b 1
:backendup
echo [OK]   Backend up: http://localhost:4040
echo.

REM ---- 7. Start the frontend dev server (own window) ----------
start "POMS Frontend" /D "%~dp0frontend" cmd /k npm run dev
echo [....] Waiting for frontend on http://localhost:5173 ...
set /a tries=0
:waitfrontend
timeout /t 2 /nobreak >NUL
curl -s -o NUL http://localhost:5173
if not errorlevel 1 goto frontendup
set /a tries+=1
if !tries! lss 20 goto waitfrontend
echo [WARN] Frontend did not answer within 40s. Check the "POMS Frontend" window.
:frontendup
echo [OK]   Frontend up: http://localhost:5173
echo.

REM ---- 8. Open the browser ------------------------------------
start "" http://localhost:5173

echo ============================================================
echo   POMS is running (full project):
echo     Database : PostgreSQL "poms" (schema + seed data)
echo     Backend  : http://localhost:4040  (API + WebSockets)
echo     Frontend : http://localhost:5173
echo     Login    : admin@bsc.local / Admin@123
echo   Keep the two POMS windows open. Close them to stop.
echo ============================================================
pause
exit /b 0