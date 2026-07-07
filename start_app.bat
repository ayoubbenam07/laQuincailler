@echo off
echo Starting La Quincailler Backend, Frontend, and Sync Worker in the background...
cd /d "%~dp0"
call npx -y pm2 start ecosystem.config.cjs

echo Waiting a few seconds for servers to start...
timeout /t 8 /nobreak > nul

echo Opening the application in your default browser...
start http://localhost:8080

echo.
echo Servers are now running silently in the background!
echo - To view logs: npx pm2 logs
echo - To stop servers: run stop_app.bat (or npx pm2 stop all)
echo.

pause
exit /b
