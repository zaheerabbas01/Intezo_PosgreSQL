@echo off
title Intezo App - Multi-Access (Domain + IPv4)
echo ========================================
echo Starting Intezo App
echo Accessible via Domain AND IPv4
echo ========================================

echo Step 1: Starting backend server...
start "Backend" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\backend-intezo && npm run dev"

timeout /t 5

echo Step 2: Starting web dashboard...
start "Web Dashboard" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard && npm start"

echo.
echo ========================================
echo All services started!
echo ========================================
echo.
echo LOCAL ACCESS:
echo   Backend API: http://localhost:3000
echo   Web Dashboard: http://localhost:3001
echo.
echo NETWORK ACCESS (IPv4):
echo   Backend API: http://202.47.48.188:3000
echo   Web Dashboard: http://202.47.48.188:3001
echo.
echo PRODUCTION (Domain):
echo   Web Dashboard: https://web.intezo.online
echo   API Backend: https://api.intezo.online
echo.
echo ========================================
echo The app automatically detects which URL you're using!
echo ========================================
pause
