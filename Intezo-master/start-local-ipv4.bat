@echo off
title Intezo App - Local IPv4 (202.47.48.188)
echo ========================================
echo Starting Intezo App on IPv4: 202.47.48.188
echo ========================================

echo Step 1: Starting backend server...
start "Backend" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\backend-intezo && npm run dev"

timeout /t 5

echo Step 2: Starting web dashboard (development mode)...
start "Web Dashboard" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard && npm start"

echo.
echo ========================================
echo All services started!
echo ========================================
echo Backend API: http://202.47.48.188:3000
echo Web Dashboard: http://202.47.48.188:3001
echo.
echo Your app is now accessible on your local network!
echo Make sure your firewall allows connections on ports 3000 and 3001
pause
