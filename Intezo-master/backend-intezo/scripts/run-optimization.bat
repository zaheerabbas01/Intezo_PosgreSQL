@echo off
echo Starting database optimization...
echo.

echo Step 1: Creating basic indexes...
node create-indexes.js
if %errorlevel% neq 0 (
    echo Failed to create basic indexes
    pause
    exit /b 1
)

echo.
echo Step 2: Running advanced optimization...
node optimize-indexes.js
if %errorlevel% neq 0 (
    echo Failed to run advanced optimization
    pause
    exit /b 1
)

echo.
echo ✅ Database optimization completed successfully!
echo Your database should now perform significantly better.
pause