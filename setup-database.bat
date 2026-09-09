@echo off
REM ============================================================
REM  POMS — One-time database setup (creates schema + demo data)
REM  Run this only if the poms database does not exist yet.
REM  Prerequisite: PostgreSQL 18 service is running (start-database.bat).
REM ============================================================
set PGBIN=C:\Program Files\PostgreSQL\18\bin
set PGOPTS=-h localhost -p 5432 -U postgres
"%PGBIN%\createdb.exe" %PGOPTS% poms 2>nul
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\schema.sql" || goto :err
cd /d "%~dp0backend"
node scripts\run-all-migrations.mjs || goto :err
npm run seed || goto :err
echo.
echo Setup complete — run start-website.bat and open http://localhost:4040
pause
exit /b 0
:err
echo SETUP FAILED — see messages above.
pause
exit /b 1