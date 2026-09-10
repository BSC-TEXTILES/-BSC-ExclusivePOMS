# POMS Login & Connection Issues - Fixed

## Problem
Users were unable to login and experiencing `ECONNREFUSED` errors when trying to access the application. The frontend (Vite dev server on port 5173) was making API calls that were being proxied to `http://localhost:4040`, but the backend server was not running, causing connection refused errors.

## Root Cause
The application requires **both** the backend API server and frontend dev server to be running simultaneously for development:
- Backend server: Should run on port 4040 (as configured in `backend/.env`)
- Frontend dev server: Runs on port 5173 with Vite proxy configured to forward `/api` requests to port 4040

Users were only starting the frontend without the backend, causing all API calls to fail.

## Solutions Implemented

### 1. Created `start-dev.bat` (New File)
A convenient batch file that starts both backend and frontend dev servers simultaneously:
- Opens backend server in a separate window on port 4040
- Opens frontend dev server in a separate window on port 5173
- Provides clear instructions and expected URLs

**Usage:** Double-click `start-dev.bat` after starting the database

### 2. Added Backend Health Check Component
Created `frontend/src/components/BackendHealthCheck.jsx`:
- Automatically checks `/api/health` endpoint on app load
- Shows a user-friendly error page if backend is not running
- Provides step-by-step instructions to fix the issue
- Includes a retry button
- Periodically checks backend status

### 3. Improved API Error Messages
Enhanced `frontend/src/api.js`:
- Better error messages for network connection failures
- Specific messages for ECONNREFUSED errors
- Clear instructions on what port the backend should be running on
- Improved formatting for server errors

### 4. Updated Documentation
Modified `README.md`:
- Added `start-dev.bat` to the quick start table
- Added development workflow section explaining both servers need to run
- Clarified port numbers and proxy configuration

## How to Use the Fixed System

### Option 1: One-Click Launcher (Recommended)
1. Double-click **`run.bat`** — starts PostgreSQL, creates schema, seeds data, launches backend + frontend
2. Login with: admin@bsc.local / Admin@123

### Option 2: Development Mode
1. Run **`run.bat`** first to set up the database (once)
2. Use `start-dev.bat` for subsequent runs (starts backend + frontend only)
3. Open browser to: http://localhost:5173
4. Login with: admin@bsc.local / Admin@123

### Option 3: Manual Development
1. Start PostgreSQL
2. In terminal 1: `cd backend && npm run dev` (port 4040)
3. In terminal 2: `cd frontend && npm run dev` (port 5173)
4. Open browser to: http://localhost:5173

## Configuration Verified

### Backend Configuration
- `backend/.env`: PORT=4040 ✓
- `backend/src/server.js`: Uses process.env.PORT || 4000 ✓
- Backend serves API on /api routes ✓
- Health endpoint: /api/health ✓

### Frontend Configuration
- `frontend/vite.config.js`: Proxy /api → http://localhost:4040 ✓
- `frontend/src/api.js`: Base URL = /api ✓
- Error handling improved ✓

### Database Configuration
- `backend/src/config/db.js`: Uses DATABASE_URL from .env ✓
- PostgreSQL running on port 5432 ✓

## Files Modified
1. `start-dev.bat` - Created new file
2. `frontend/src/components/BackendHealthCheck.jsx` - Created new file
3. `frontend/src/main.jsx` - Added BackendHealthCheck wrapper
4. `frontend/src/api.js` - Improved error messages
5. `README.md` - Updated documentation

## Files Verified (No Changes Needed)
- `backend/.env` - PORT=4040 ✓
- `backend/src/server.js` - Correct port configuration ✓
- `backend/src/app.js` - API routes configured correctly ✓
- `frontend/vite.config.js` - Proxy configuration correct ✓
- `backend/src/routes/auth.js` - Login endpoint working correctly ✓

## Testing
1. Backend server starts successfully on port 4040 ✓
2. Frontend dev server starts on port 5173 ✓
3. Proxy forwards /api requests to backend ✓
4. Health check endpoint accessible ✓
5. Login works when both servers are running ✓
6. Clear error message when backend is not running ✓

## Common Issues & Fixes

### Issue: "Backend server is not running" message
**Fix:** Start the backend server using one of the methods above.

### Issue: Database connection errors
**Fix:** Run `run.bat` — it automatically starts PostgreSQL and sets up the database on first run.

### Issue: Port 4040 already in use
**Fix:** Make sure only one backend instance is running, or change the PORT in `backend/.env`.

### Issue: Port 5432 already in use
**Fix:** Make sure only one PostgreSQL instance is running.

## Demo Accounts
All demo accounts work correctly when backend is running:
- admin@bsc.local / Admin@123 (Super Admin)
- buyer.dvg@bsc.local / PE@12345 (Purchase Executive)
- pm.dvg@bsc.local / PM@12345 (Purchase Manager)
- approver.dvg@bsc.local / AP@12345 (Approver)
- receiver.dvg@bsc.local / RC@12345 (Receiving User)
- viewer@bsc.local / VW@12345 (Viewer)
- auditor@bsc.local / AU@12345 (Auditor)
- dvg.admin@bsc.local / Admin@123 (Domain Admin)
