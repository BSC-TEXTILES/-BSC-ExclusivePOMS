@echo off
REM ============================================================
REM  POMS — Stop the PostgreSQL database
REM ============================================================
"C:\Program Files\PostgreSQL\17\bin\pg_ctl.exe" -D "%~dp0database\pgdata" stop -m fast
pause
