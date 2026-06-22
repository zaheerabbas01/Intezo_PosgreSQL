@echo off
echo ========================================
echo   Password Migration Fix Tool
echo ========================================
echo.

:menu
echo Please select an option:
echo.
echo 1. List all users and check password status
echo 2. Fix migrated passwords (restore from MongoDB)
echo 3. Test a specific user's password
echo 4. Verify password hashes
echo 5. Exit
echo.
set /p choice="Enter your choice (1-5): "

if "%choice%"=="1" goto list
if "%choice%"=="2" goto fix
if "%choice%"=="3" goto test
if "%choice%"=="4" goto verify
if "%choice%"=="5" goto end

echo Invalid choice. Please try again.
echo.
goto menu

:list
echo.
echo Listing all users...
echo.
node list-users.js
echo.
pause
goto menu

:fix
echo.
echo ========================================
echo   WARNING: This will update passwords
echo ========================================
echo.
echo This will restore original password hashes from MongoDB.
echo Make sure MongoDB is accessible.
echo.
set /p confirm="Continue? (Y/N): "
if /i "%confirm%"=="Y" (
    echo.
    echo Running password fix...
    node fix-migrated-passwords.js
    echo.
    pause
) else (
    echo Operation cancelled.
    echo.
)
goto menu

:test
echo.
set /p email="Enter email address: "
set /p password="Enter password: "
echo.
echo Testing login...
echo.
node test-password.js "%email%" "%password%"
echo.
pause
goto menu

:verify
echo.
echo Verifying password hashes...
echo.
node fix-passwords.js
echo.
pause
goto menu

:end
echo.
echo Goodbye!
exit
