@echo off
title Intezo App with Cloudflare Tunnel
echo ========================================
echo Starting Intezo App with Cloudflare Tunnel
echo ========================================

echo Step 2: Starting backend server...
start "Backend" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\backend-intezo && npm run dev"

timeout /t 5

echo Step 3: Starting Cloudflare tunnel...
start "Cloudflare" cmd /k "cloudflared tunnel run --token eyJhIjoiY2I1YTdmZWNjMDQwZTUwMjI2OWIxZTA1ZDY0MDg5N2IiLCJzIjoiT1RreFlqYzFNalV0TmpabFpDMDBZMlJtTFdFek9ETXRZamRsT1dabU1HWTVZbU13IiwidCI6IjNiMjRjZDg3LTI0NDEtNGUwYi04YWFhLTBiM2UwMzc1ODhiYiJ9"

timeout /t 3

echo Step 4: Starting web dashboard (production build)...
start "Web Dashboard" cmd /k "cd /d c:\Projects\intezo-postgreSQL\Intezo-master\clinic_dashboard && npx serve -s build -l 3001"

echo.
echo ========================================
echo All services started!
echo ========================================
echo Backend: http://localhost:3000 or http://202.47.48.188:3000
echo Web Dashboard: http://localhost:3001 or http://202.47.48.188:3001
echo WEB DASHBOARD: https://web.intezo.online
echo API BACKEND: https://api.intezo.online
echo.
echo Your app is now accessible with a permanent URL!
pause