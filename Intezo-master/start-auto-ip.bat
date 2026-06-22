@echo off
title Intezo - Auto IP Detection
echo ========================================
echo  Intezo - Detecting Local IP...
echo ========================================

:: Get the local IPv4 address (first non-loopback)
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R /C:"IPv4 Address"') do (
    set RAW_IP=%%a
    goto :found
)
:found
:: Trim leading space
set LOCAL_IP=%RAW_IP: =%
echo Detected IP: %LOCAL_IP%

if "%LOCAL_IP%"=="" (
    echo ERROR: Could not detect local IP. Using localhost.
    set LOCAL_IP=localhost
)

echo.
echo Updating .env files with IP: %LOCAL_IP%

:: Update frontend-intezo .env
echo REACT_APP_API_URL=http://%LOCAL_IP%:3000/api> "c:\Projects\intezo-postgreSQL\Intezo-master\frontend-intezo\.env"
echo REACT_APP_SOCKET_URL=http://%LOCAL_IP%:3000>> "c:\Projects\intezo-postgreSQL\Intezo-master\frontend-intezo\.env"
echo PORT=3001>> "c:\Projects\intezo-postgreSQL\Intezo-master\frontend-intezo\.env"

:: Update mobile_app .env
echo API_BASE_URL=http://%LOCAL_IP%:3000/api> "c:\Projects\intezo-postgreSQL\Intezo-master\mobile_app-intezo\.env"
echo SOCKET_BASE_URL=http://%LOCAL_IP%:3000>> "c:\Projects\intezo-postgreSQL\Intezo-master\mobile_app-intezo\.env"

:: Update clinic_dashboard .env if it exists
if exist "c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard\.env" (
    echo REACT_APP_API_URL=http://%LOCAL_IP%:3000/api> "c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard\.env"
    echo REACT_APP_SOCKET_URL=http://%LOCAL_IP%:3000>> "c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard\.env"
    echo PORT=3001>> "c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard\.env"
)

echo All .env files updated!
echo.
echo ========================================
echo  Starting services...
echo ========================================

echo Starting Backend...
start "Backend - Intezo" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\backend-intezo && npm run dev"

timeout /t 5 /nobreak > nul

echo Starting Web Dashboard...
start "Dashboard - Intezo" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard && npm start"

echo.
echo ========================================
echo  Services started!
echo  Backend:   http://%LOCAL_IP%:3000
echo  Dashboard: http://%LOCAL_IP%:3001
echo  Mobile:    auto-detected at runtime
echo ========================================
pause
