@echo off
echo Stopping La Quincailler Servers...
cd /d "%~dp0"
call npx -y pm2 stop all
echo Servers stopped successfully.
pause
