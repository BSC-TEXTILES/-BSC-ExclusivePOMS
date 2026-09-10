@echo off
setlocal enabledelayedexpansion
title BSC Exclusive POMS - Launch

REM ============================================================
REM  BSC Exclusive POMS - ONE-CLICK LAUNCHER (v1.0)
REM  Runs the ENTIRE project: PostgreSQL check + backend + frontend
REM  Backend:  http://localhost:4040/api/health
REM  Frontend: http://localhost:5173   (auto-opens in your browser)
REM  Login:    admin@bsc.local / Admin@123
REM ============================================================

cd /d "%~dp0"

echo ============================================================
echo   BSC Exclusive POMS - starting the full project...
echo ============================================================
echo.

REM ---- 1. Make sure PostgreSQL is running (Windows service) ----
sc query postgresql-x64-18 >NUL 2>&1
if %errorlevel%==0 (
  sc query postgresql-x64-18 | findstr /i "RUNNING" >NUL
  if not errorlevel 1 (
    echo [OK]   PostgreSQL is running on port 5432.
  ) else (
    echo [....] Starting PostgreSQL service...
    net start postgresql-x64-18 >NUL 2>&1
    if not errorlevel 1 ( echo [OK]   PostgreSQL started. ) else ( echo [WARN] Could not start PostgreSQL service - continuing. )
  )
) else (
  echo [WARN] PostgreSQL service not found. If you use a remote/Supabase DB, that is fine.
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

REM ---- 3. Verify the database (gives a precise error if it fails) ----
pushd "%~dp0backend"
node scripts\check-db.mjs
set DBOK=%errorlevel%
popd
if not "%DBOK%"=="0" (
  echo.
  echo [WARN] The database could not be reached, OR is not set up yet.
  echo        This is normal on a fresh machine.
  echo.
  set /p FIRST="First-time setup: create the database + schema + demo data now? (Y/N) "
  if /i "!FIRST!"=="Y" (
    echo.
    echo [....] Running one-time database setup...
    set PGBIN=C:\Program Files\PostgreSQL\18\bin
    set PGOPTS=-h localhost -p 5432 -U postgres
    if not exist "%PGBIN%\psql.exe" (
      echo [ERROR] PostgreSQL tools not found at %PGBIN%.
      echo         Install PostgreSQL 18, or set DATABASE_URL in backend\.env for a remote DB.
      pause
      exit /b 1
    )
    "%PGBIN%\createdb.exe" %PGOPTS% poms 2>nul
    "%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\schema.sql" || goto :setupfail
    pushd "%~dp0backend"
    node scripts\run-all-migrations.mjs || (popd & goto :setupfail)
    call npm run seed || (popd & goto :setupfail)
    popd
    echo [OK]   Database created and seeded.
    echo.
    echo [....] Starting the project now...
  ) else (
    echo [ERROR] Cannot continue without a database.
    echo         Run run.bat again and choose Y for first-time setup, OR
    echo         fix backend\.env (DATABASE_URL) to a working database.
    echo.
    pause
    exit /b 1
  )
)
echo.

REM ---- 4. Start the backend API (own window) ----
start "POMS Backend" /D "%~dp0backend" cmd /k npm run dev
echo [....] Waiting for backend on http://localhost:4040 ...
set /a tries=0
:waitbackend
timeout /t 2 /nobreak >NUL
curl -s -o NUL http://localhost:4040/api/health
if not errorlevel 1 goto backendup
set /a tries+=1
if !tries! lss 20 goto waitbackend
echo [ERROR] Backend did not answer within 40s. Check the POMS Backend window.
pause
exit /b 1
:backendup
echo [OK]   Backend is up on http://localhost:4040
echo.

REM ---- 5. Start the frontend dev server (own window) ----
start "POMS Frontend" /D "%~dp0frontend" cmd /k npm run dev
echo [....] Waiting for frontend on http://localhost:5173 ...
set /a tries=0
:waitfrontend
timeout /t 2 /nobreak >NUL
curl -s -o NUL http://localhost:5173
if not errorlevel 1 goto frontendup
set /a tries+=1
if !tries! lss 20 goto waitfrontend
echo [WARN] Frontend did not answer within 40s. Check the POMS Frontend window.
:frontendup
echo [OK]   Frontend is up.
echo.

REM ---- 6. Open the browser ----
start "" http://localhost:5173

echo ============================================================
echo   POMS is running:
echo     Frontend : http://localhost:5173
echo     Backend  : http://localhost:4040
echo     Login    : admin@bsc.local / Admin@123
echo   Keep the two POMS windows open. Close them to stop.
echo ============================================================
pause
exit /b 0

:setupfail
echo.
echo [ERROR] Database setup failed - see the messages above.
echo         Common cause: Postgres password. Edit backend\.env and set
echo         DATABASE_URL=postgresql://postgres:YOURPASSWORD@localhost:5432/poms
pause
exit /b 1