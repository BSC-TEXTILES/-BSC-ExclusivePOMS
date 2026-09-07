@echo off
REM ============================================================
REM  POMS — Start the full website (API + frontend) on ONE server
REM  URL: http://localhost:4040        Login: admin@bsc.local / Admin@123
REM  Requires the database to be running first (start-database.bat)
REM ============================================================
cd /d "%~dp0backend"
echo Starting POMS on http://localhost:4040 ...
npm start
pause
