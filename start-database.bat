@echo off
REM ============================================================
REM  POMS — Start the PostgreSQL database (port 5433)
REM  Data directory: database\pgdata
REM ============================================================
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "%~dp0database\pgdata" -l "%~dp0database\pgdata.log" -o "-p 5433" start
echo.
echo Database ready on postgresql://localhost:5433/poms
pause
