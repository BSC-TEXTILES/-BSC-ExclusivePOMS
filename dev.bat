@echo off
title BSC Exclusive POMS - Dev Launcher
echo ============================================
 echo  BSC Exclusive POMS - starting full stack
 echo ============================================
 cd /d "%~dp0backend"
 start "POMS API (backend :4040)" cmd /k "node scripts/check-db.mjs && npm run dev"
 cd /d "%~dp0frontend"
 start "POMS Web (frontend :5173)" cmd /k "npm run dev"
 echo.
 echo  Backend  : http://localhost:4040/api/health
 echo  Frontend : http://localhost:5173/
 echo.
 echo  Both started in separate windows.
 echo  If the backend window shows a DATABASE FAIL,
 echo  fix PostgreSQL first (hints are printed there).
 echo.
pause
