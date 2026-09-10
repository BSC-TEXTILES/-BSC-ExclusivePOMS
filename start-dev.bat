@echo off
setlocal enabledelayedexpansion
REM ============================================================
REM  POMS — Start both backend API and frontend dev server
REM  Backend:  http://localhost:4040 (API)
REM  Frontend: http://localhost:5173 (Vite dev server, /api proxied to :4040)
REM  Login:    admin@bsc.local / Admin@123
REM ============================================================

echo Starting POMS development environment...
echo.

REM ── 1. Make sure PostgreSQL is running ──────────────────────
sc query postgresql-x64-18 | findstr "RUNNING" >NUL
if not errorlevel 1 (
  echo [OK] PostgreSQL is running on port 5432.
) else (
  echo PostgreSQL not running - starting service postgresql-x64-18 ...
  net start postgresql-x64-18
)
echo.

REM ── 2. Install dependencies on first run ────────────────────
if not exist "%~dp0backend\node_modules" (
  echo Installing backend dependencies...
  pushd "%~dp0backend"
  call npm install
  popd
)
if not exist "%~dp0frontend\node_modules" (
  echo Installing frontend dependencies...
  pushd "%~dp0frontend"
  call npm install
  popd
)

REM ── 3. Start backend in its own window ──────────────────────
start "POMS Backend" /D "%~dp0backend" cmd /k npm run dev

REM ── 4. Wait until the backend answers /api/health ───────────
echo Waiting for backend to come up on http://localhost:4040 ...
set /a tries=0
:waitbackend
timeout /t 2 /nobreak >NUL
curl -s -o NUL http://localhost:4040/api/health
if not errorlevel 1 goto backendup
set /a tries+=1
if !tries! lss 15 goto waitbackend
echo.
echo [ERROR] Backend did not answer within 30 seconds.
echo Check the "POMS Backend" window for the error, then re-run this script.
pause
exit /b 1
:backendup
echo [OK] Backend is up on http://localhost:4040
echo.

REM ── 5. Start frontend in its own window ─────────────────────
start "POMS Frontend" /D "%~dp0frontend" cmd /k npm run dev

REM ── 6. Wait for Vite, then open the browser ─────────────────
echo Waiting for frontend to come up on http://localhost:5173 ...
set /a tries=0
:waitfrontend
timeout /t 2 /nobreak >NUL
curl -s -o NUL http://localhost:5173
if not errorlevel 1 goto frontendup
set /a tries+=1
if !tries! lss 15 goto waitfrontend
echo [WARN] Frontend did not answer within 30 seconds - check the "POMS Frontend" window.
pause
exit /b 1
:frontendup
echo [OK] Frontend is up.
start "" http://localhost:5173

echo.
echo ============================================================
echo   POMS is running:
echo     Frontend:  http://localhost:5173
echo     Backend:   http://localhost:4040
echo     Login:     admin@bsc.local / Admin@123
echo   Close the two server windows to stop.
echo ============================================================
pause
