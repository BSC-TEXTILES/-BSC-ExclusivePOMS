@echo off
REM ============================================================
REM  POMS — Start both backend API and frontend dev server
REM  Backend: http://localhost:4040 (API)
REM  Frontend: http://localhost:5173 (Vite dev server with proxy)
REM  Requires database to be running first (start-database.bat)
REM ============================================================

echo Starting POMS development environment...
echo.

REM Start backend in a separate window
start "POMS Backend" cmd /k "cd /d \"%~dp0backend\" && echo Starting backend on http://localhost:4040... && npm run dev"

REM Give backend a moment to start
timeout /t 3 /nobreak >nul

REM Start frontend in a separate window
start "POMS Frontend" cmd /k "cd /d \"%~dp0frontend\" && echo Starting frontend on http://localhost:5173... && npm run dev"

echo.
echo Both servers should be starting now:
echo   - Backend API: http://localhost:4040
echo   - Frontend Dev: http://localhost:5173
echo.
echo Open http://localhost:5173 in your browser to use the app.
echo Login with: admin@bsc.local / Admin@123
