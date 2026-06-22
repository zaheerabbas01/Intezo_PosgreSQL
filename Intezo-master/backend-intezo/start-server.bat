@echo off
echo Starting Intezo Backend Server...

echo.
echo [1/3] Checking Redis connection...
redis-cli ping >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Redis is not running. Please start Redis server first.
    echo You can start Redis by running: redis-server
    pause
    exit /b 1
) else (
    echo ✅ Redis is running
)

echo.
echo [2/3] Installing dependencies...
call npm install

echo.
echo [3/3] Starting server...
call npm run dev

pause