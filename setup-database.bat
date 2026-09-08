@echo off
REM ============================================================
REM  POMS — One-time database setup (creates schema + demo data)
REM  Run this only if the poms database does not exist yet.
REM  Prerequisite: start-database.bat has been run once.
REM ============================================================
set PGBIN=C:\Program Files\PostgreSQL\17\bin
"%PGBIN%\createdb.exe" -h localhost -p 5433 -U postgres poms
"%PGBIN%\psql.exe" -h localhost -p 5433 -U postgres -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\schema.sql" || goto :err
"%PGBIN%\psql.exe" -h localhost -p 5433 -U postgres -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\migrations\003_order_management.sql" 2>nul
cd /d "%~dp0backend"
npm run seed || goto :err
echo.
echo Setup complete — run start-website.bat and open http://localhost:4040
pause
exit /b 0
:err
echo SETUP FAILED — see messages above.
pause
exit /b 1
