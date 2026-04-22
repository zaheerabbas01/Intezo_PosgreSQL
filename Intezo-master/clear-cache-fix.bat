@echo off
echo Clearing React cache and rebuilding...

cd clinic_dashboard

echo Clearing npm cache...
call npm start -- --reset-cache

echo.
echo ✅ Cache cleared! 
echo.
echo IMPORTANT: On the device with issues:
echo 1. Hard refresh browser: Ctrl+Shift+R (or Cmd+Shift+R on Mac)
echo 2. Clear browser cache completely
echo 3. Or open in incognito/private mode
echo.
pause