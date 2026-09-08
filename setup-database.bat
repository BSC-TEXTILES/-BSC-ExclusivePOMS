@echo off
REM ============================================================
REM  POMS — One-time database setup (creates schema + demo data)
REM  Run this only if the poms database does not exist yet.
REM  Prerequisite: start-database.bat has been run once.
REM ============================================================
set PGBIN=C:\Program Files\PostgreSQL\17\bin
set PGOPTS=-h localhost -p 5433 -U postgres
"%PGBIN%\createdb.exe" %PGOPTS% poms
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\schema.sql" || goto :err
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\migrations\001_chat.sql" || goto :err
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\migrations\002_ui_upgrade.sql" || goto :err
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\migrations\003_mens_apparel.sql" || goto :err
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\migrations\004_apparel_junctions.sql" || goto :err
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\migrations\005_videos.sql" || goto :err
"%PGBIN%\psql.exe" %PGOPTS% -d poms -v ON_ERROR_STOP=1 -f "%~dp0database\migrations\006_locations_brands_products.sql" || goto :err
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
