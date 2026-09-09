@echo off
REM ============================================================
REM  POMS — Start the PostgreSQL 18 database (port 5432)
REM  Runs as the Windows service "postgresql-x64-18".
REM ============================================================
net start postgresql-x64-18 >nul 2>&1
if %errorlevel%==0 (
  echo PostgreSQL 18 started.
) else (
  echo PostgreSQL 18 already running, or the service was not found.
)
echo.
echo Database ready on postgresql://localhost:5432/poms
pause